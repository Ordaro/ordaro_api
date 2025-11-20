import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import { ORDARO_JOB_TYPES } from '../job-types.enum';
import { QueueService, JobData } from '../queue.service';

@Injectable()
export class CostUpdateWorker implements OnModuleInit {
  private readonly logger = new Logger(CostUpdateWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prismaService: PrismaService,
  ) {}

  onModuleInit() {
    // Create worker for cost-updates queue
    this.queueService.createWorker(
      'cost-updates',
      async (job: Job<JobData>) => {
        return this.processCostUpdateJob(job);
      },
    );

    this.logger.log('Cost update worker initialized');
  }

  private async processCostUpdateJob(job: Job<JobData>): Promise<unknown> {
    const attemptNumber = (job.attemptsMade ?? 0) + 1;
    const maxAttempts = job.opts.attempts ?? 3;

    this.logger.log(
      `Processing cost update job ${job.id ?? 'unknown'} (${job.name ?? 'unknown'}) - Attempt ${attemptNumber}/${maxAttempts}`,
    );

    try {
      const jobName = job.name as ORDARO_JOB_TYPES;
      const data = job.data as Record<string, unknown>;

      switch (jobName) {
        case ORDARO_JOB_TYPES.INGREDIENT_COST_UPDATE: {
          const ingredientId = data['ingredientId'] as string;
          if (!ingredientId) {
            throw new Error('ingredientId is required');
          }

          // Find all recipes using this ingredient
          const recipeIngredients =
            await this.prismaService.recipeIngredient.findMany({
              where: { ingredientId },
              select: { recipeId: true },
              distinct: ['recipeId'],
            });

          // Enqueue recipe cost update for each unique recipe
          for (const ri of recipeIngredients) {
            await this.queueService.addJob(
              ORDARO_JOB_TYPES.RECIPE_COST_UPDATE,
              {
                recipeId: ri.recipeId,
              },
            );
          }

          this.logger.log(
            `Ingredient cost update: ${ingredientId} affects ${recipeIngredients.length} recipes`,
          );

          return { ingredientId, affectedRecipes: recipeIngredients.length };
        }

        case ORDARO_JOB_TYPES.RECIPE_COST_UPDATE: {
          const recipeId = data['recipeId'] as string;
          if (!recipeId) {
            throw new Error('recipeId is required');
          }

          // Load recipe with ingredients
          const recipe = await this.prismaService.recipe.findUnique({
            where: { id: recipeId },
            include: {
              recipeIngredients: {
                include: {
                  ingredient: true,
                },
              },
            },
          });

          if (!recipe) {
            throw new Error(`Recipe not found: ${recipeId}`);
          }

          // Recalculate costs
          let totalCost = new Prisma.Decimal(0);

          for (const ri of recipe.recipeIngredients) {
            const currentUnitCost =
              ri.ingredient.fifoUnitCost ??
              ri.ingredient.averageUnitCost ??
              new Prisma.Decimal(0);
            const ingredientTotalCost = currentUnitCost.mul(ri.quantityUsed);

            // Update recipe ingredient with new cost snapshot
            await this.prismaService.recipeIngredient.update({
              where: { id: ri.id },
              data: {
                unitCostAtUse: currentUnitCost,
                totalCost: ingredientTotalCost,
              },
            });

            totalCost = totalCost.add(ingredientTotalCost);
          }

          // Update recipe
          const version = recipe.version + 1;
          await this.prismaService.recipe.update({
            where: { id: recipeId },
            data: {
              totalCost,
              version,
            },
          });

          // Find all menu items using this recipe
          const menuItems = await this.prismaService.menuItem.findMany({
            where: {
              recipeId,
              isActive: true,
            },
            select: { id: true },
          });

          // Enqueue menu cost update for each menu item
          for (const menuItem of menuItems) {
            await this.queueService.addJob(ORDARO_JOB_TYPES.MENU_COST_UPDATE, {
              menuItemId: menuItem.id,
            });
          }

          this.logger.log(
            `Recipe cost update: ${recipeId} (v${version}), affects ${menuItems.length} menu items`,
          );

          return {
            recipeId,
            version,
            totalCost,
            affectedMenuItems: menuItems.length,
          };
        }

        case ORDARO_JOB_TYPES.MENU_COST_UPDATE: {
          const menuItemId = data['menuItemId'] as string;
          if (!menuItemId) {
            throw new Error('menuItemId is required');
          }

          const menuItem = await this.prismaService.menuItem.findUnique({
            where: { id: menuItemId },
            include: {
              recipe: true,
            },
          });

          if (!menuItem || !menuItem.recipe) {
            this.logger.warn(
              `Menu item ${menuItemId} not found or has no recipe`,
            );
            return { menuItemId, skipped: true };
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

          // Get company settings for margin threshold
          const organization = await this.prismaService.organization.findUnique(
            {
              where: { id: menuItem.companyId },
              include: {
                settings: true,
              },
            },
          );

          // Update menu item
          await this.prismaService.menuItem.update({
            where: { id: menuItemId },
            data: {
              computedCost,
              margin,
            },
          });

          // Check margin threshold
          if (organization?.settings && margin !== null) {
            const targetMargin = organization.settings.targetMarginThreshold;
            if (targetMargin && margin.lt(targetMargin)) {
              this.logger.warn(
                `Low margin alert for menu item ${menuItemId}: ${margin.toNumber()} < ${targetMargin.toNumber()}`,
              );
              // TODO: Trigger notification/alert
            }
          }

          this.logger.log(
            `Menu cost update: ${menuItemId}, computedCost: ${computedCost.toString()}, margin: ${margin?.toString() ?? 'null'}`,
          );

          return { menuItemId, computedCost, margin };
        }

        default:
          throw new Error(`Unknown job type: ${jobName}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing cost update job ${job.id ?? 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
