import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

import { UserRole } from '../auth/enums/user-role.enum';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginationService } from '../common/services/pagination.service';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../services/cache';

import { CreateBranchDto, UpdateBranchDto } from './dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly cacheService: CacheService,
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  /**
   * Create a new branch
   */
  async create(
    createBranchDto: CreateBranchDto,
    organizationId: string,
    creatorUserId: string,
  ) {
    // Get organization from database
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if branch name already exists in this organization
    const existingBranch = await this.prismaService.branch.findFirst({
      where: {
        organizationId: organization.id,
        name: createBranchDto.name,
      },
    });

    if (existingBranch) {
      throw new ConflictException(
        'A branch with this name already exists in your organization',
      );
    }

    // Create branch
    const branch = await this.prismaService.branch.create({
      data: {
        name: createBranchDto.name,
        address: createBranchDto.address,
        phone: createBranchDto.phone ?? null,
        organizationId: organization.id,
      },
    });

    // Get creator user from database
    const creatorUser = await this.prismaService.user.findUnique({
      where: { auth0UserId: creatorUserId },
    });

    // If creator is a Manager, automatically assign them to this branch
    if (creatorUser && creatorUser.role === 'MANAGER') {
      await this.prismaService.userBranch.create({
        data: {
          userId: creatorUser.id,
          branchId: branch.id,
        },
      });
    }

    this.logger.log(
      `Branch created: ${branch.id} in organization ${organization.id}`,
    );

    // If auto-propagate enabled, create BranchMenu entries for all company menu items
    const settings = (await this.companySettingsService.getSettings(
      organizationId,
    )) as { autoPropagateApprovedMenus: boolean };
    if (settings.autoPropagateApprovedMenus) {
      const menuItems = await this.prismaService.menuItem.findMany({
        where: {
          companyId: organization.id,
          isActive: true,
        },
        select: { id: true },
      });

      if (menuItems.length > 0) {
        const branchMenuData = menuItems.map((menuItem) => ({
          branchId: branch.id,
          menuItemId: menuItem.id,
        }));

        await this.prismaService.branchMenu.createMany({
          data: branchMenuData,
          skipDuplicates: true,
        });

        this.logger.log(
          `Menu items propagated to new branch ${branch.id}: ${menuItems.length} items`,
        );
      }
    }

    // Invalidate cache for this organization's branches
    await this.cacheService.invalidateOrganization(organizationId);

    return branch;
  }

  /**
   * Get all branches accessible to a user
   */
  async findAll(
    organizationId: string,
    userRole: UserRole,
    userId: string,
    paginationQuery: PaginationQueryDto,
  ) {
    const { limit = 20, cursor, orderDir = 'desc' } = paginationQuery;

    // Get organization
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    let cursorCondition = {};
    if (cursor) {
      const decodedCursor = this.paginationService.decodeCursor(cursor);
      if (decodedCursor && typeof decodedCursor.tieBreakerValue === 'string') {
        cursorCondition = {
          id:
            orderDir === 'desc'
              ? { lt: decodedCursor.tieBreakerValue }
              : { gt: decodedCursor.tieBreakerValue },
        };
      }
    }

    // Owners can see all branches
    if (userRole === UserRole.OWNER) {
      const branches = await this.prismaService.branch.findMany({
        where: {
          organizationId: organization.id,
          isActive: true,
          ...cursorCondition,
        },
        include: {
          _count: {
            select: {
              userBranches: true,
            },
          },
        },
        orderBy: { createdAt: orderDir },
        take: limit + 1,
      });

      return this.paginationService.buildPaginatedResponse(branches, limit, {
        cursorField: 'id',
        additionalCursorFields: ['createdAt'],
      });
    }

    // Other roles: only see assigned branches
    const user = await this.prismaService.user.findUnique({
      where: { auth0UserId: userId },
      include: {
        branches: {
          where: {
            branch: {
              isActive: true,
              organizationId: organization.id,
              ...cursorCondition,
            },
          },
          include: {
            branch: {
              include: {
                _count: {
                  select: {
                    userBranches: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: orderDir },
          take: limit + 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const branches = user.branches.map((ub) => ub.branch) as Array<
      Record<string, unknown>
    >;

    return this.paginationService.buildPaginatedResponse(branches, limit, {
      cursorField: 'id',
      additionalCursorFields: ['createdAt'],
    });
  }

  /**
   * Get branch by ID
   */
  async findOne(id: string, organizationId: string) {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const branch = await this.prismaService.branch.findFirst({
      where: {
        id,
        organizationId: organization.id,
      },
      include: {
        userBranches: {
          include: {
            user: {
              select: {
                id: true,
                auth0UserId: true,
                email: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  /**
   * Update branch
   */
  async update(
    id: string,
    updateBranchDto: UpdateBranchDto,
    organizationId: string,
  ) {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const branch = await this.prismaService.branch.findFirst({
      where: {
        id,
        organizationId: organization.id,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // If name is being updated, check for conflicts
    if (updateBranchDto.name) {
      const existingBranch = await this.prismaService.branch.findFirst({
        where: {
          organizationId: organization.id,
          name: updateBranchDto.name,
          id: { not: id },
        },
      });

      if (existingBranch) {
        throw new ConflictException(
          'A branch with this name already exists in your organization',
        );
      }
    }

    const updated = await this.prismaService.branch.update({
      where: { id },
      data: updateBranchDto,
    });

    // Invalidate cache for this organization's branches
    await this.cacheService.invalidateOrganization(organizationId);

    return updated;
  }

  /**
   * Get users assigned to a specific branch
   */
  async getBranchUsers(
    branchId: string,
    organizationId: string,
    requesterAuth0Id: string,
    requesterRole: UserRole,
  ) {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Get the branch
    const branch = await this.prismaService.branch.findFirst({
      where: {
        id: branchId,
        organizationId: organization.id,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check permissions: Non-Owner/Manager users can only view users in branches they're assigned to
    if (
      requesterRole !== UserRole.OWNER &&
      requesterRole !== UserRole.MANAGER
    ) {
      const requesterUser = await this.prismaService.user.findUnique({
        where: { auth0UserId: requesterAuth0Id },
      });

      if (!requesterUser) {
        throw new NotFoundException('Requester user not found');
      }

      const userBranchAssignment =
        await this.prismaService.userBranch.findUnique({
          where: {
            userId_branchId: {
              userId: requesterUser.id,
              branchId: branchId,
            },
          },
        });

      if (!userBranchAssignment) {
        throw new ForbiddenException(
          'You can only view users in branches you are assigned to',
        );
      }
    }

    // Get users assigned to this branch
    const userBranches = await this.prismaService.userBranch.findMany({
      where: { branchId: branchId },
      include: {
        user: {
          select: {
            id: true,
            auth0UserId: true,
            email: true,
            name: true,
            phone: true,
            profilePicture: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            organizationId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      branchId: branch.id,
      branchName: branch.name,
      branchAddress: branch.address,
      users: userBranches.map((ub) => ({
        id: ub.user.id,
        auth0UserId: ub.user.auth0UserId,
        email: ub.user.email,
        name: ub.user.name,
        phone: ub.user.phone,
        profilePicture: ub.user.profilePicture,
        role: ub.user.role,
        createdAt: ub.user.createdAt,
        updatedAt: ub.user.updatedAt,
        organizationId: ub.user.organizationId,
        assignedAt: ub.createdAt,
      })),
    };
  }

  /**
   * Soft delete branch (set isActive = false)
   */
  async remove(id: string, organizationId: string) {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const branch = await this.prismaService.branch.findFirst({
      where: {
        id,
        organizationId: organization.id,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const result = await this.prismaService.branch.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate cache for this organization's branches
    await this.cacheService.invalidateOrganization(organizationId);

    return result;
  }
}
