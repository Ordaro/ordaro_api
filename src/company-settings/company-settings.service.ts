import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../services/cache';

import { UpdateSettingsDto } from './dto';

@Injectable()
export class CompanySettingsService {
  private readonly logger = new Logger(CompanySettingsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get or create default settings
   */
  async getSettings(companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    let settings = await this.prismaService.companySetting.findUnique({
      where: { companyId: organization.id },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await this.prismaService.companySetting.create({
        data: {
          companyId: organization.id,
          canBranchCreateMenu: false,
          requiresApprovalForProposals: true,
          allowBranchPriceOverride: true,
          autoPropagateApprovedMenus: true,
          targetMarginThreshold: new Prisma.Decimal(0.3), // 30%
          expiresSoonWarningDays: 7,
        },
      });
    }

    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(
    companyId: string,
    dto: UpdateSettingsDto,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Ensure settings exist
    await this.getSettings(companyId);

    const updated = await this.prismaService.companySetting.update({
      where: { companyId: organization.id },
      data: {
        ...(dto.canBranchCreateMenu !== undefined && {
          canBranchCreateMenu: dto.canBranchCreateMenu,
        }),
        ...(dto.requiresApprovalForProposals !== undefined && {
          requiresApprovalForProposals: dto.requiresApprovalForProposals,
        }),
        ...(dto.allowBranchPriceOverride !== undefined && {
          allowBranchPriceOverride: dto.allowBranchPriceOverride,
        }),
        ...(dto.autoPropagateApprovedMenus !== undefined && {
          autoPropagateApprovedMenus: dto.autoPropagateApprovedMenus,
        }),
        ...(dto.targetMarginThreshold !== undefined && {
          targetMarginThreshold: new Prisma.Decimal(dto.targetMarginThreshold),
        }),
      },
    });

    this.logger.log(`Company settings updated for ${organization.id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return updated;
  }

  /**
   * Helper: Check if branches can create menu
   */
  async canBranchCreateMenu(companyId: string): Promise<boolean> {
    const settings = (await this.getSettings(companyId)) as {
      canBranchCreateMenu: boolean;
    };
    return settings.canBranchCreateMenu;
  }

  /**
   * Helper: Check if approval required for proposals
   */
  async requiresApprovalForProposals(companyId: string): Promise<boolean> {
    const settings = (await this.getSettings(companyId)) as {
      requiresApprovalForProposals: boolean;
    };
    return settings.requiresApprovalForProposals;
  }

  /**
   * Helper: Check if branch price override allowed
   */
  async allowBranchPriceOverride(companyId: string): Promise<boolean> {
    const settings = (await this.getSettings(companyId)) as {
      allowBranchPriceOverride: boolean;
    };
    return settings.allowBranchPriceOverride;
  }

  /**
   * Helper: Get target margin threshold
   */
  async getTargetMarginThreshold(companyId: string): Promise<number | null> {
    const settings = (await this.getSettings(companyId)) as {
      targetMarginThreshold: Prisma.Decimal | null;
    };
    return settings.targetMarginThreshold?.toNumber() ?? null;
  }
}
