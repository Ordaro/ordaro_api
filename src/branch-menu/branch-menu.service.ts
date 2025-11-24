import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../services/cache';

import { UpdateBranchMenuDto } from './dto';

@Injectable()
export class BranchMenuService {
  private readonly logger = new Logger(BranchMenuService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  /**
   * Create branch menu link
   */
  async createBranchMenuLink(
    branchId: string,
    menuItemId: string,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const branch = await this.prismaService.branch.findFirst({
      where: {
        id: branchId,
        organizationId: organization.id,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const menuItem = await this.prismaService.menuItem.findFirst({
      where: {
        id: menuItemId,
        companyId: organization.id,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    // Check if link already exists
    const existing = await this.prismaService.branchMenu.findUnique({
      where: {
        branchId_menuItemId: {
          branchId,
          menuItemId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Menu item is already linked to this branch');
    }

    const branchMenu = await this.prismaService.branchMenu.create({
      data: {
        branchId,
        menuItemId,
      },
    });

    this.logger.log(
      `Branch menu link created: ${branchMenu.id} for branch ${branchId}`,
    );

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return branchMenu;
  }

  /**
   * Update branch menu override
   */
  async updateBranchMenu(
    id: string,
    dto: UpdateBranchMenuDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const branchMenu = await this.prismaService.branchMenu.findUnique({
      where: { id },
    });

    if (!branchMenu) {
      throw new NotFoundException('Branch menu not found');
    }

    // Verify branch belongs to organization
    const branch = await this.prismaService.branch.findFirst({
      where: {
        id: branchMenu.branchId,
        organizationId: organization.id,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch menu not found');
    }

    // Check if price change requires approval
    if (dto.localPrice !== undefined) {
      const settings = (await this.companySettingsService.getSettings(
        companyId,
      )) as { requiresApprovalForProposals: boolean };
      const requiresApproval = settings.requiresApprovalForProposals;

      if (
        requiresApproval &&
        dto.localPrice !== branchMenu.localPrice?.toNumber()
      ) {
        // Create price change request
        await this.prismaService.priceChangeRequest.create({
          data: {
            branchId: branchMenu.branchId,
            menuItemId: branchMenu.menuItemId,
            requestedPrice: new Prisma.Decimal(dto.localPrice),
            status: 'PENDING',
          },
        });

        this.logger.log(`Price change request created for branch menu ${id}`);
      }
    }

    const updated = await this.prismaService.branchMenu.update({
      where: { id },
      data: {
        ...(dto.localPrice !== undefined && {
          localPrice: new Prisma.Decimal(dto.localPrice),
        }),
        ...(dto.availability !== undefined && {
          availability: dto.availability,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Branch menu updated: ${id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return updated;
  }

  /**
   * Get branch menu list
   */
  async getBranchMenu(branchId: string, companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const branch = await this.prismaService.branch.findFirst({
      where: {
        id: branchId,
        organizationId: organization.id,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const branchMenus = await this.prismaService.branchMenu.findMany({
      where: {
        branchId,
        isActive: true,
      },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            basePrice: true,
            description: true,
            imageUrl: true,
            computedCost: true,
            margin: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return branchMenus;
  }

  /**
   * Apply branch override
   */
  async applyBranchOverride(
    branchId: string,
    menuItemId: string,
    overrideDto: UpdateBranchMenuDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if override exists
    const existing = await this.prismaService.branchMenu.findUnique({
      where: {
        branchId_menuItemId: {
          branchId,
          menuItemId,
        },
      },
    });

    if (existing) {
      return this.updateBranchMenu(existing.id, overrideDto, companyId);
    }

    // Create new override
    const branchMenu = await this.prismaService.branchMenu.create({
      data: {
        branchId,
        menuItemId,
        ...(overrideDto.localPrice !== undefined && {
          localPrice: new Prisma.Decimal(overrideDto.localPrice),
        }),
        ...(overrideDto.availability !== undefined && {
          availability: overrideDto.availability,
        }),
        ...(overrideDto.isActive !== undefined && {
          isActive: overrideDto.isActive,
        }),
      },
    });

    this.logger.log(`Branch override created: ${branchMenu.id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return branchMenu;
  }
}
