import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginationService } from '../common/services/pagination.service';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../services/cache';
import { ORDARO_JOB_TYPES } from '../services/queue/job-types.enum';
import { QueueService } from '../services/queue/queue.service';

import { CreateRecipeDto, UpdateRecipeDto } from './dto';

@Injectable()
export class RecipesService {
  private readonly logger = new Logger(RecipesService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Create a new recipe with cost calculation
   */
  async createRecipe(
    dto: CreateRecipeDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if recipe name already exists
    const existing = await this.prismaService.recipe.findFirst({
      where: {
        companyId: organization.id,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A recipe with this name already exists in your organization',
      );
    }

    if (!dto.ingredients || dto.ingredients.length === 0) {
      throw new BadRequestException('Recipe must have at least one ingredient');
    }

    // Fetch all ingredients with current costs
    const ingredientIds = dto.ingredients.map((ing) => ing.ingredientId);
    const ingredients = await this.prismaService.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        companyId: organization.id,
        isActive: true,
      },
    });

    if (ingredients.length !== ingredientIds.length) {
      throw new NotFoundException('One or more ingredients not found');
    }

    // Calculate costs using FIFO cost or average cost
    const recipeIngredients = dto.ingredients.map((ingDto) => {
      const ingredient = ingredients.find(
        (ing) => ing.id === ingDto.ingredientId,
      );
      if (!ingredient) {
        throw new NotFoundException(
          `Ingredient ${ingDto.ingredientId} not found`,
        );
      }

      // Use FIFO cost if available, otherwise average cost
      const unitCost =
        ingredient.fifoUnitCost ??
        ingredient.averageUnitCost ??
        new Prisma.Decimal(0);
      const quantityUsed = new Prisma.Decimal(ingDto.quantityUsed);
      const totalCost = unitCost.mul(quantityUsed);

      return {
        ingredientId: ingredient.id,
        quantityUsed,
        unitCostAtUse: unitCost,
        totalCost,
      };
    });

    // Calculate total recipe cost
    const totalCost = recipeIngredients.reduce(
      (sum, item) => sum.add(item.totalCost),
      new Prisma.Decimal(0),
    );

    // Calculate cost per portion
    const yieldQuantity = new Prisma.Decimal(dto.yieldQuantity);
    const costPerPortion = totalCost.div(yieldQuantity);

    // Create recipe with ingredients in a transaction
    const recipe = await this.prismaService.$transaction(async (tx) => {
      const createdRecipe = await tx.recipe.create({
        data: {
          name: dto.name,
          yieldQuantity,
          totalCost,
          costPerPortion,
          companyId: organization.id,
        },
      });

      // Create recipe ingredients
      await tx.recipeIngredient.createMany({
        data: recipeIngredients.map((item) => ({
          recipeId: createdRecipe.id,
          ingredientId: item.ingredientId,
          quantityUsed: item.quantityUsed,
          unitCostAtUse: item.unitCostAtUse,
          totalCost: item.totalCost,
        })),
      });

      return createdRecipe;
    });

    this.logger.log(
      `Recipe created: ${recipe.id} in organization ${organization.id}`,
    );

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return recipe;
  }

  /**
   * Recalculate recipe cost
   */
  async recalculateCost(recipeId: string, companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const recipe = await this.prismaService.recipe.findFirst({
      where: {
        id: recipeId,
        companyId: organization.id,
      },
      include: {
        recipeIngredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    // Recalculate costs with current ingredient costs
    const recipeIngredients = recipe.recipeIngredients.map((ri) => {
      const ingredient = ri.ingredient;
      const unitCost =
        ingredient.fifoUnitCost ??
        ingredient.averageUnitCost ??
        new Prisma.Decimal(0);
      const quantityUsed = ri.quantityUsed;
      const totalCost = unitCost.mul(quantityUsed);

      return {
        id: ri.id,
        unitCostAtUse: unitCost,
        totalCost,
      };
    });

    // Calculate new totals
    const totalCost = recipeIngredients.reduce(
      (sum, item) => sum.add(item.totalCost),
      new Prisma.Decimal(0),
    );
    const costPerPortion = totalCost.div(recipe.yieldQuantity);

    // Update recipe and recipe ingredients in transaction
    const updated = await this.prismaService.$transaction(async (tx) => {
      // Update recipe
      const updatedRecipe = await tx.recipe.update({
        where: { id: recipeId },
        data: {
          totalCost,
          costPerPortion,
          version: recipe.version + 1,
        },
      });

      // Update recipe ingredients
      for (const ri of recipeIngredients) {
        await tx.recipeIngredient.update({
          where: { id: ri.id },
          data: {
            unitCostAtUse: ri.unitCostAtUse,
            totalCost: ri.totalCost,
          },
        });
      }

      return updatedRecipe;
    });

    // Enqueue menu cost update for all linked menu items
    const menuItems = await this.prismaService.menuItem.findMany({
      where: {
        recipeId: recipeId,
        isActive: true,
      },
      select: { id: true },
    });

    for (const menuItem of menuItems) {
      await this.queueService.addJob(ORDARO_JOB_TYPES.MENU_COST_UPDATE, {
        menuItemId: menuItem.id,
      });
    }

    this.logger.log(`Recipe cost recalculated: ${recipeId}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return updated;
  }

  /**
   * Get recipe details with ingredient snapshots
   */
  async getRecipeDetails(id: string, companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const recipe = await this.prismaService.recipe.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
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
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    return recipe;
  }

  /**
   * Update recipe
   */
  async updateRecipe(
    id: string,
    dto: UpdateRecipeDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const recipe = await this.prismaService.recipe.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    // If name is being updated, check for conflicts
    if (dto.name && dto.name !== recipe.name) {
      const existing = await this.prismaService.recipe.findFirst({
        where: {
          companyId: organization.id,
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(
          'A recipe with this name already exists in your organization',
        );
      }
    }

    // If ingredients are being updated, recalculate
    if (dto.ingredients) {
      if (dto.ingredients.length === 0) {
        throw new BadRequestException(
          'Recipe must have at least one ingredient',
        );
      }

      // Fetch ingredients
      const ingredientIds = dto.ingredients.map((ing) => ing.ingredientId);
      const ingredients = await this.prismaService.ingredient.findMany({
        where: {
          id: { in: ingredientIds },
          companyId: organization.id,
          isActive: true,
        },
      });

      if (ingredients.length !== ingredientIds.length) {
        throw new NotFoundException('One or more ingredients not found');
      }

      // Calculate new costs
      const recipeIngredients = dto.ingredients.map((ingDto) => {
        const ingredient = ingredients.find(
          (ing) => ing.id === ingDto.ingredientId,
        );
        if (!ingredient) {
          throw new NotFoundException(
            `Ingredient ${ingDto.ingredientId} not found`,
          );
        }

        const unitCost =
          ingredient.fifoUnitCost ??
          ingredient.averageUnitCost ??
          new Prisma.Decimal(0);
        const quantityUsed = new Prisma.Decimal(ingDto.quantityUsed);
        const totalCost = unitCost.mul(quantityUsed);

        return {
          ingredientId: ingredient.id,
          quantityUsed,
          unitCostAtUse: unitCost,
          totalCost,
        };
      });

      const totalCost = recipeIngredients.reduce(
        (sum, item) => sum.add(item.totalCost),
        new Prisma.Decimal(0),
      );
      const yieldQuantity = dto.yieldQuantity
        ? new Prisma.Decimal(dto.yieldQuantity)
        : recipe.yieldQuantity;
      const costPerPortion = totalCost.div(yieldQuantity);

      // Update in transaction
      const updated = await this.prismaService.$transaction(async (tx) => {
        // Update recipe
        const updatedRecipe = await tx.recipe.update({
          where: { id },
          data: {
            ...(dto.name && { name: dto.name }),
            ...(dto.yieldQuantity && { yieldQuantity }),
            totalCost,
            costPerPortion,
            version: recipe.version + 1,
          },
        });

        // Delete old recipe ingredients
        await tx.recipeIngredient.deleteMany({
          where: { recipeId: id },
        });

        // Create new recipe ingredients
        await tx.recipeIngredient.createMany({
          data: recipeIngredients.map((item) => ({
            recipeId: id,
            ingredientId: item.ingredientId,
            quantityUsed: item.quantityUsed,
            unitCostAtUse: item.unitCostAtUse,
            totalCost: item.totalCost,
          })),
        });

        return updatedRecipe;
      });

      // Enqueue menu updates
      const menuItems = await this.prismaService.menuItem.findMany({
        where: {
          recipeId: id,
          isActive: true,
        },
        select: { id: true },
      });

      for (const menuItem of menuItems) {
        await this.queueService.addJob(ORDARO_JOB_TYPES.MENU_COST_UPDATE, {
          menuItemId: menuItem.id,
        });
      }

      this.logger.log(`Recipe updated: ${id}`);

      // Invalidate cache
      await this.cacheService.invalidateOrganization(companyId);

      return updated;
    }

    // Simple update without ingredient changes
    const updated = await this.prismaService.recipe.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.yieldQuantity && {
          yieldQuantity: new Prisma.Decimal(dto.yieldQuantity),
          costPerPortion: recipe.totalCost.div(
            new Prisma.Decimal(dto.yieldQuantity),
          ),
        }),
      },
    });

    this.logger.log(`Recipe updated: ${id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return updated;
  }

  /**
   * Link recipe to menu item
   */
  async linkRecipeToMenu(
    recipeId: string,
    menuId: string,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const recipe = await this.prismaService.recipe.findFirst({
      where: {
        id: recipeId,
        companyId: organization.id,
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
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

    // Update menu item with recipe link
    const updated = await this.prismaService.menuItem.update({
      where: { id: menuId },
      data: { recipeId },
    });

    // Enqueue menu cost update
    await this.queueService.addJob(ORDARO_JOB_TYPES.MENU_COST_UPDATE, {
      menuItemId: menuId,
    });

    this.logger.log(`Recipe ${recipeId} linked to menu item ${menuId}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return updated;
  }

  /**
   * List recipes
   */
  async listRecipes(
    companyId: string,
    paginationQuery: PaginationQueryDto,
  ): Promise<unknown> {
    const { limit = 20, cursor, orderDir = 'desc' } = paginationQuery;

    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
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

    const recipes = await this.prismaService.recipe.findMany({
      where: {
        companyId: organization.id,
        isActive: true,
        ...cursorCondition,
      },
      orderBy: { createdAt: orderDir },
      take: limit + 1,
    });

    return this.paginationService.buildPaginatedResponse(recipes, limit, {
      cursorField: 'id',
      additionalCursorFields: ['createdAt'],
    });
  }

  /**
   * Delete recipe (soft delete)
   */
  async deleteRecipe(id: string, companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const recipe = await this.prismaService.recipe.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
      include: {
        _count: {
          select: {
            menuItems: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    // Check if recipe is used in menu items
    if (recipe._count.menuItems > 0) {
      throw new ConflictException(
        'Cannot delete recipe that is used in menu items',
      );
    }

    // Soft delete
    const result = await this.prismaService.recipe.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Recipe deleted: ${id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return result;
  }
}
