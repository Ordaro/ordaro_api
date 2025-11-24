import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginationService } from '../common/services/pagination.service';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../services/cache';

import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateVariantDto,
  AttachRecipeDto,
} from './dto';

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Create a new menu item
   */
  async createMenuItem(
    dto: CreateMenuItemDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if menu item name already exists
    const existing = await this.prismaService.menuItem.findFirst({
      where: {
        companyId: organization.id,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A menu item with this name already exists in your organization',
      );
    }

    // If recipeId provided, validate it exists
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

    const portionMultiplier = dto.portionMultiplier ?? 1;
    const basePrice = new Prisma.Decimal(dto.basePrice);

    // Calculate computed cost and margin if recipe is linked
    let computedCost: Prisma.Decimal | null = null;
    let margin: Prisma.Decimal | null = null;

    if (dto.recipeId) {
      const recipe = await this.prismaService.recipe.findFirst({
        where: { id: dto.recipeId },
      });

      if (recipe) {
        // computedCost = (recipe.totalCost / recipe.yieldQuantity) * portionMultiplier
        computedCost = recipe.totalCost
          .div(recipe.yieldQuantity)
          .mul(new Prisma.Decimal(portionMultiplier));

        // margin = (basePrice - computedCost) / basePrice
        if (basePrice.gt(0)) {
          margin = basePrice.sub(computedCost).div(basePrice);
        }
      }
    }

    const menuItem = await this.prismaService.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        category: dto.category ?? null,
        basePrice,
        portionMultiplier: new Prisma.Decimal(portionMultiplier),
        computedCost,
        margin,
        companyId: organization.id,
        recipeId: dto.recipeId ?? null,
      },
    });

    this.logger.log(
      `Menu item created: ${menuItem.id} in organization ${organization.id}`,
    );

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return menuItem;
  }

  /**
   * Get all menu items with optional branch overrides
   */
  async getAllMenuItems(
    companyId: string,
    branchId?: string,
    paginationQuery?: PaginationQueryDto,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
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

    const menuItems = await this.prismaService.menuItem.findMany({
      where: {
        companyId: organization.id,
        isActive: true,
        ...cursorCondition,
      },
      include: {
        variants: {
          where: { isActive: true },
        },
        ...(branchId && {
          branchMenus: {
            where: { branchId },
            take: 1,
          },
        }),
      },
      orderBy: { createdAt: orderDir },
      take: limit + 1,
    });

    return this.paginationService.buildPaginatedResponse(menuItems, limit, {
      cursorField: 'id',
      additionalCursorFields: ['createdAt'],
    });
  }

  /**
   * Get menu item by ID with full details
   */
  async getMenuItemById(
    id: string,
    companyId: string,
    branchId?: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const menuItem = await this.prismaService.menuItem.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
      include: {
        recipe: {
          include: {
            recipeIngredients: {
              include: {
                ingredient: {
                  select: {
                    id: true,
                    name: true,
                    unit: true,
                  },
                },
              },
            },
          },
        },
        variants: {
          where: { isActive: true },
        },
        ...(branchId && {
          branchMenus: {
            where: { branchId },
            take: 1,
          },
        }),
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    return menuItem;
  }

  /**
   * Update menu item
   */
  async updateMenuItem(
    id: string,
    dto: UpdateMenuItemDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const menuItem = await this.prismaService.menuItem.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
      include: {
        recipe: true,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    // If name is being updated, check for conflicts
    if (dto.name && dto.name !== menuItem.name) {
      const existing = await this.prismaService.menuItem.findFirst({
        where: {
          companyId: organization.id,
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(
          'A menu item with this name already exists in your organization',
        );
      }
    }

    // If recipeId is being updated, validate it
    if (dto.recipeId !== undefined) {
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
    }

    // Recalculate cost if recipe or portionMultiplier changed
    const recipeId = dto.recipeId ?? menuItem.recipeId;
    const portionMultiplier = dto.portionMultiplier
      ? new Prisma.Decimal(dto.portionMultiplier)
      : menuItem.portionMultiplier;
    const basePrice = dto.basePrice
      ? new Prisma.Decimal(dto.basePrice)
      : menuItem.basePrice;

    let computedCost: Prisma.Decimal | null = null;
    let margin: Prisma.Decimal | null = null;

    if (recipeId) {
      const recipe = await this.prismaService.recipe.findFirst({
        where: { id: recipeId },
      });

      if (recipe) {
        computedCost = recipe.totalCost
          .div(recipe.yieldQuantity)
          .mul(portionMultiplier);

        if (basePrice.gt(0)) {
          margin = basePrice.sub(computedCost).div(basePrice);
        }
      }
    }

    const updated = await this.prismaService.menuItem.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && {
          description: dto.description ?? null,
        }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl ?? null }),
        ...(dto.category !== undefined && { category: dto.category ?? null }),
        ...(dto.basePrice !== undefined && { basePrice }),
        ...(dto.portionMultiplier !== undefined && { portionMultiplier }),
        ...(dto.recipeId !== undefined && { recipeId: dto.recipeId ?? null }),
        computedCost,
        margin,
      },
    });

    this.logger.log(`Menu item updated: ${id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return updated;
  }

  /**
   * Delete menu item (soft delete)
   */
  async deleteMenuItem(id: string, companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const menuItem = await this.prismaService.menuItem.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    // Soft delete
    const result = await this.prismaService.menuItem.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Menu item deleted: ${id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return result;
  }

  /**
   * Create menu variant
   */
  async createVariant(
    menuId: string,
    dto: CreateVariantDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const menuItem = await this.prismaService.menuItem.findFirst({
      where: {
        id: menuId,
        companyId: organization.id,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    // Check if variant name already exists for this menu item
    const existing = await this.prismaService.menuVariant.findFirst({
      where: {
        menuItemId: menuId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A variant with this name already exists for this menu item',
      );
    }

    // If recipeId provided, validate it
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

    const variant = await this.prismaService.menuVariant.create({
      data: {
        name: dto.name,
        price: new Prisma.Decimal(dto.price),
        portionMultiplier: new Prisma.Decimal(dto.portionMultiplier ?? 1),
        menuItemId: menuId,
        recipeId: dto.recipeId ?? null,
      },
    });

    this.logger.log(`Menu variant created: ${variant.id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return variant;
  }

  /**
   * Attach recipe to menu item
   */
  async attachRecipe(
    menuId: string,
    dto: AttachRecipeDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { clerkOrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const menuItem = await this.prismaService.menuItem.findFirst({
      where: {
        id: menuId,
        companyId: organization.id,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    const recipe = await this.prismaService.recipe.findFirst({
      where: {
        id: dto.recipeId,
        companyId: organization.id,
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    // Recalculate cost
    await this.recalculateMenuFromRecipe(menuId);

    this.logger.log(`Recipe ${dto.recipeId} attached to menu item ${menuId}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return menuItem;
  }

  /**
   * Recalculate menu cost from recipe
   */
  async recalculateMenuFromRecipe(menuId: string): Promise<void> {
    const menuItem = await this.prismaService.menuItem.findUnique({
      where: { id: menuId },
      include: {
        recipe: true,
      },
    });

    if (!menuItem || !menuItem.recipe) {
      return;
    }

    const recipe = menuItem.recipe;
    const portionMultiplier = menuItem.portionMultiplier;
    const basePrice = menuItem.basePrice;

    // Compute: menuComputedCost = (recipe.totalCost / recipe.yieldQuantity) * portionMultiplier
    const computedCost = recipe.totalCost
      .div(recipe.yieldQuantity)
      .mul(portionMultiplier);

    // Compute margin = (basePrice - computedCost) / basePrice
    let margin: Prisma.Decimal | null = null;
    if (basePrice.gt(0)) {
      margin = basePrice.sub(computedCost).div(basePrice);
    }

    // Get company settings to check margin threshold
    const organization = await this.prismaService.organization.findUnique({
      where: { id: menuItem.companyId },
      include: {
        settings: true,
      },
    });

    // Update menu item
    await this.prismaService.menuItem.update({
      where: { id: menuId },
      data: {
        computedCost,
        margin,
      },
    });

    // Check margin threshold and trigger alert if low
    if (organization?.settings && margin !== null) {
      const targetMargin = organization.settings.targetMarginThreshold;
      if (targetMargin && margin.lt(new Prisma.Decimal(targetMargin))) {
        this.logger.warn(
          `Low margin alert for menu item ${menuId}: ${margin.toNumber()} < ${targetMargin}`,
        );
        // TODO: Trigger notification/alert
      }
    }
  }

  /**
   * Get effective menu for branch (with overrides)
   */
  async getEffectiveMenuForBranch(
    companyId: string,
    branchId: string,
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

    const menuItems = await this.prismaService.menuItem.findMany({
      where: {
        companyId: organization.id,
        isActive: true,
      },
      include: {
        variants: {
          where: { isActive: true },
        },
        branchMenus: {
          where: {
            branchId,
            isActive: true,
          },
          take: 1,
        },
      },
    });

    // Merge with branch overrides
    return menuItems.map((item) => {
      const branchOverride = item.branchMenus[0];
      return {
        ...item,
        effectivePrice: branchOverride?.localPrice ?? item.basePrice,
        availability: branchOverride?.availability ?? true,
      };
    });
  }
}
