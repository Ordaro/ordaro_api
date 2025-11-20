import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginationService } from '../common/services/pagination.service';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../services/cache';
import { ORDARO_JOB_TYPES } from '../services/queue/job-types.enum';
import { QueueService } from '../services/queue/queue.service';

import {
  CreateMenuProposalDto,
  ApproveProposalDto,
  RejectProposalDto,
} from './dto';

@Injectable()
export class MenuProposalsService {
  private readonly logger = new Logger(MenuProposalsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  /**
   * Create menu proposal from branch
   */
  async proposeMenu(
    dto: CreateMenuProposalDto,
    branchId: string,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
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

    // Check if branch can create menu
    const canCreate =
      await this.companySettingsService.canBranchCreateMenu(companyId);
    if (!canCreate) {
      throw new BadRequestException(
        'Branches are not allowed to create menu items',
      );
    }

    // Validate recipe if provided
    if (dto.recipeId) {
      const recipe = await this.prismaService.recipe.findFirst({
        where: {
          id: dto.recipeId,
          companyId: organization.id,
        },
      });

      if (!recipe) {
        throw new NotFoundException('Recipe not found');
      }
    }

    const proposal = await this.prismaService.menuItemProposal.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        basePrice: new Prisma.Decimal(dto.basePrice),
        companyId: organization.id,
        branchId,
        recipeId: dto.recipeId ?? null,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Menu proposal created: ${proposal.id} from branch ${branchId}`,
    );

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return proposal;
  }

  /**
   * Approve menu proposal
   */
  async approveProposal(
    proposalId: string,
    approverId: string,
    companyId: string,
    dto?: ApproveProposalDto,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const proposal = await this.prismaService.menuItemProposal.findFirst({
      where: {
        id: proposalId,
        companyId: organization.id,
        status: 'PENDING',
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found or already processed');
    }

    const approver = await this.prismaService.user.findUnique({
      where: { auth0UserId: approverId },
    });

    if (!approver) {
      throw new NotFoundException('Approver not found');
    }

    // Create menu item from proposal
    const menuItem = await this.prismaService.menuItem.create({
      data: {
        name: proposal.name,
        description: proposal.description,
        basePrice: proposal.basePrice,
        companyId: organization.id,
        recipeId: proposal.recipeId,
        portionMultiplier: new Prisma.Decimal(1),
      },
    });

    // Calculate initial cost and margin if recipe exists
    if (proposal.recipeId) {
      const recipe = await this.prismaService.recipe.findFirst({
        where: { id: proposal.recipeId },
      });

      if (recipe) {
        const computedCost = recipe.totalCost.div(recipe.yieldQuantity);
        let margin: Prisma.Decimal | null = null;
        if (proposal.basePrice.gt(0)) {
          margin = proposal.basePrice.sub(computedCost).div(proposal.basePrice);
        }

        await this.prismaService.menuItem.update({
          where: { id: menuItem.id },
          data: {
            computedCost,
            margin,
          },
        });
      }
    }

    // Update proposal
    await this.prismaService.menuItemProposal.update({
      where: { id: proposalId },
      data: {
        status: 'APPROVED',
        menuItemId: menuItem.id,
        approverId: approver.id,
        notes: dto?.notes ?? null,
        approvedAt: new Date(),
      },
    });

    // If auto-propagate enabled, enqueue menu cascade job
    const settings = (await this.companySettingsService.getSettings(
      companyId,
    )) as { autoPropagateApprovedMenus: boolean };
    if (settings.autoPropagateApprovedMenus) {
      await this.queueService.addJob(ORDARO_JOB_TYPES.MENU_CASCADE, {
        menuItemId: menuItem.id,
        companyId: organization.id,
      });
    }

    this.logger.log(
      `Proposal ${proposalId} approved, menu item ${menuItem.id} created`,
    );

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return {
      proposal,
      menuItem,
    };
  }

  /**
   * Reject menu proposal
   */
  async rejectProposal(
    proposalId: string,
    approverId: string,
    dto: RejectProposalDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const proposal = await this.prismaService.menuItemProposal.findFirst({
      where: {
        id: proposalId,
        companyId: organization.id,
        status: 'PENDING',
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found or already processed');
    }

    const approver = await this.prismaService.user.findUnique({
      where: { auth0UserId: approverId },
    });

    if (!approver) {
      throw new NotFoundException('Approver not found');
    }

    const updated = await this.prismaService.menuItemProposal.update({
      where: { id: proposalId },
      data: {
        status: 'REJECTED',
        approverId: approver.id,
        notes: dto.reason,
        rejectedAt: new Date(),
      },
    });

    this.logger.log(`Proposal ${proposalId} rejected`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return updated;
  }

  /**
   * List proposals
   */
  async listProposals(
    companyId: string,
    status?: string,
    branchId?: string,
    paginationQuery?: PaginationQueryDto,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const { limit = 20, cursor, orderDir = 'desc' } = paginationQuery ?? {};

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

    const proposals = await this.prismaService.menuItemProposal.findMany({
      where: {
        companyId: organization.id,
        ...(status && {
          status: status as 'PENDING' | 'APPROVED' | 'REJECTED',
        }),
        ...(branchId && { branchId }),
        ...cursorCondition,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        recipe: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: orderDir },
      take: limit + 1,
    });

    return this.paginationService.buildPaginatedResponse(proposals, limit, {
      cursorField: 'id',
      additionalCursorFields: ['createdAt'],
    });
  }
}
