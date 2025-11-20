import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import { ORDARO_JOB_TYPES } from '../job-types.enum';
import { QueueService, JobData } from '../queue.service';

@Injectable()
export class InventoryWorker implements OnModuleInit {
  private readonly logger = new Logger(InventoryWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prismaService: PrismaService,
  ) {}

  onModuleInit() {
    // Create worker for inventory queue
    this.queueService.createWorker('inventory', async (job: Job<JobData>) => {
      return this.processInventoryJob(job);
    });

    this.logger.log('Inventory worker initialized');
  }

  private async processInventoryJob(job: Job<JobData>): Promise<unknown> {
    const attemptNumber = (job.attemptsMade ?? 0) + 1;
    const maxAttempts = job.opts.attempts ?? 3;

    this.logger.log(
      `Processing inventory job ${job.id ?? 'unknown'} (${job.name ?? 'unknown'}) - Attempt ${attemptNumber}/${maxAttempts}`,
    );

    try {
      const jobName = job.name as ORDARO_JOB_TYPES;
      const data = job.data as Record<string, unknown>;

      switch (jobName) {
        case ORDARO_JOB_TYPES.INVENTORY_BATCH_CHANGE: {
          const ingredientId = data['ingredientId'] as string;
          if (!ingredientId) {
            throw new Error('ingredientId is required');
          }

          // Recalculate ingredient cached costs
          const ingredient = await this.prismaService.ingredient.findUnique({
            where: { id: ingredientId },
            include: {
              batches: {
                where: { isClosed: false },
              },
            },
          });

          if (!ingredient) {
            throw new Error(`Ingredient not found: ${ingredientId}`);
          }

          // Calculate average unit cost from all batches
          let totalValue = new Prisma.Decimal(0);
          let totalQty = new Prisma.Decimal(0);

          for (const batch of ingredient.batches) {
            const batchValue = batch.unitCost.mul(batch.remainingQty);
            totalValue = totalValue.add(batchValue);
            totalQty = totalQty.add(batch.remainingQty);
          }

          const newAverageCost = totalQty.gt(0)
            ? totalValue.div(totalQty)
            : null;

          // Get FIFO cost (oldest batch)
          const oldestBatch = ingredient.batches.sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          )[0];
          const newFifoCost = oldestBatch?.unitCost ?? null;

          // Check if costs changed
          const costChanged =
            !ingredient.averageUnitCost?.equals(
              newAverageCost ?? new Prisma.Decimal(0),
            ) ||
            !ingredient.fifoUnitCost?.equals(
              newFifoCost ?? new Prisma.Decimal(0),
            );

          // Update ingredient
          await this.prismaService.ingredient.update({
            where: { id: ingredientId },
            data: {
              averageUnitCost: newAverageCost,
              fifoUnitCost: newFifoCost,
            },
          });

          // If cost changed, enqueue ingredient cost update
          if (costChanged) {
            await this.queueService.addJob(
              ORDARO_JOB_TYPES.INGREDIENT_COST_UPDATE,
              {
                ingredientId,
              },
            );
          }

          this.logger.log(
            `Inventory batch change processed: ${ingredientId}, costChanged: ${costChanged}`,
          );

          return { ingredientId, costChanged };
        }

        case ORDARO_JOB_TYPES.CONSUME_RECIPE_FOR_ORDER: {
          // This will be implemented when OrderService is integrated
          const orderId = data['orderId'] as string;
          this.logger.log(
            `Recipe consumption for order ${orderId} - to be implemented with OrderService integration`,
          );
          return { orderId, message: 'To be implemented with OrderService' };
        }

        default:
          throw new Error(`Unknown job type: ${jobName}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing inventory job ${job.id ?? 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
