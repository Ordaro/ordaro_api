import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../services/cache';
import { ORDARO_JOB_TYPES } from '../services/queue/job-types.enum';
import { QueueService } from '../services/queue/queue.service';

import { StockEntryDto, AdjustStockDto } from './dto';
import { BatchService } from './services/batch.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
    private readonly batchService: BatchService,
  ) {}

  /**
   * Record stock entry (purchase)
   */
  async recordStockEntry(
    dto: StockEntryDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id: dto.ingredientId,
        companyId: organization.id,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const totalCost = new Prisma.Decimal(dto.totalCost);
    const unitCost = totalCost.div(quantity);

    // Create batch and stock entry in transaction
    const result = await this.prismaService.$transaction(async (tx) => {
      // Create batch
      const batch = await tx.ingredientBatch.create({
        data: {
          ingredientId: dto.ingredientId,
          remainingQty: quantity,
          unitCost,
          totalCost,
          receiptRef: dto.receiptRef ?? null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          branchId: dto.branchId ?? null,
        },
      });

      // Create stock entry
      const stockEntry = await tx.stockEntry.create({
        data: {
          type: 'PURCHASE',
          ingredientId: dto.ingredientId,
          batchId: batch.id,
          quantity,
          unitCost,
          totalCost,
          reference: dto.receiptRef ?? null,
          branchId: dto.branchId ?? null,
        },
      });

      // Update ingredient totals
      const newTotalStock = ingredient.totalStock.add(quantity);

      // Recalculate average cost: (oldTotalStock * oldAvgCost + newTotalCost) / newTotalStock
      let newAverageCost: Prisma.Decimal | null = null;
      if (ingredient.averageUnitCost) {
        const oldTotalValue = ingredient.totalStock.mul(
          ingredient.averageUnitCost,
        );
        const newTotalValue = oldTotalValue.add(totalCost);
        newAverageCost = newTotalValue.div(newTotalStock);
      } else {
        newAverageCost = unitCost;
      }

      // Update FIFO cost (cost of next available batch - which is this new batch)
      const newFifoCost = unitCost;

      await tx.ingredient.update({
        where: { id: dto.ingredientId },
        data: {
          totalStock: newTotalStock,
          averageUnitCost: newAverageCost,
          fifoUnitCost: newFifoCost,
        },
      });

      return { batch, stockEntry };
    });

    // Enqueue inventory batch change job
    await this.queueService.addJob(ORDARO_JOB_TYPES.INVENTORY_BATCH_CHANGE, {
      ingredientId: dto.ingredientId,
    });

    this.logger.log(
      `Stock entry recorded: ${result.stockEntry.id} for ingredient ${dto.ingredientId}`,
    );

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return result;
  }

  /**
   * Adjust stock (manual adjustment)
   */
  async adjustStock(dto: AdjustStockDto, companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id: dto.ingredientId,
        companyId: organization.id,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const newTotalStock = ingredient.totalStock.add(quantity);

    if (newTotalStock.lt(0)) {
      throw new BadRequestException('Insufficient stock for adjustment');
    }

    // Get current unit cost for adjustment entry
    const unitCost =
      ingredient.fifoUnitCost ??
      ingredient.averageUnitCost ??
      new Prisma.Decimal(0);
    const totalCost = unitCost.mul(quantity.abs());

    const stockEntry = await this.prismaService.stockEntry.create({
      data: {
        type: 'ADJUSTMENT',
        ingredientId: dto.ingredientId,
        quantity: quantity.abs(),
        unitCost,
        totalCost,
        reason: dto.reason,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    // Update ingredient total stock
    await this.prismaService.ingredient.update({
      where: { id: dto.ingredientId },
      data: {
        totalStock: newTotalStock,
      },
    });

    this.logger.log(
      `Stock adjusted: ${stockEntry.id} for ingredient ${dto.ingredientId}, qty: ${dto.quantity}`,
    );

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return stockEntry;
  }

  /**
   * Deduct stock using FIFO algorithm
   */
  async deductStock(
    ingredientId: string,
    qty: Prisma.Decimal,
    options: {
      orderId?: string;
      recipeId?: string;
      reason?: string;
    },
    companyId: string,
  ): Promise<{
    totalCost: Prisma.Decimal;
    deductions: Array<{
      batchId: string;
      qtyDeducted: Prisma.Decimal;
      costPerUnit: Prisma.Decimal;
      totalCost: Prisma.Decimal;
    }>;
  }> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id: ingredientId,
        companyId: organization.id,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    // Check if sufficient stock
    if (ingredient.totalStock.lt(qty)) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${ingredient.totalStock.toString()}, Required: ${qty.toString()}`,
      );
    }

    // FIFO Algorithm with transaction
    const result = await this.prismaService.$transaction(
      async (tx) => {
        // Get batches ordered by creation date (oldest first), not closed, with remaining stock
        // Note: For production, consider using raw SQL with FOR UPDATE SKIP LOCKED for better concurrency
        const batches = await tx.ingredientBatch.findMany({
          where: {
            ingredientId,
            isClosed: false,
            remainingQty: { gt: 0 },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (batches.length === 0) {
          throw new BadRequestException('No available batches for deduction');
        }

        let remainingQty = qty;
        const deductions: Array<{
          batchId: string;
          qtyDeducted: Prisma.Decimal;
          costPerUnit: Prisma.Decimal;
          totalCost: Prisma.Decimal;
        }> = [];
        let totalCost = new Prisma.Decimal(0);

        // Deduct from batches in FIFO order
        for (const batch of batches) {
          if (remainingQty.lte(0)) {
            break;
          }

          const batchRemainingQty = batch.remainingQty;
          const batchUnitCost = batch.unitCost;

          const qtyToDeduct = Prisma.Decimal.min(
            remainingQty,
            batchRemainingQty,
          );
          const deductionCost = batchUnitCost.mul(qtyToDeduct);

          // Update batch
          const newBatchQty = batchRemainingQty.sub(qtyToDeduct);
          await tx.ingredientBatch.update({
            where: { id: batch.id },
            data: {
              remainingQty: newBatchQty,
              isClosed: newBatchQty.lte(0),
            },
          });

          // Create stock deduction entry
          await tx.stockDeduction.create({
            data: {
              ingredientId,
              batchId: batch.id,
              quantityDeducted: qtyToDeduct,
              costPerUnit: batchUnitCost,
              totalCost: deductionCost,
              orderId: options.orderId ?? null,
              recipeId: options.recipeId ?? null,
              reason: options.reason ?? 'order',
            },
          });

          deductions.push({
            batchId: batch.id,
            qtyDeducted: qtyToDeduct,
            costPerUnit: batchUnitCost,
            totalCost: deductionCost,
          });

          totalCost = totalCost.add(deductionCost);
          remainingQty = remainingQty.sub(qtyToDeduct);
        }

        if (remainingQty.gt(0)) {
          throw new BadRequestException(
            `Insufficient stock in batches. Remaining: ${remainingQty.toString()}`,
          );
        }

        // Update ingredient total stock
        const newTotalStock = ingredient.totalStock.sub(qty);
        await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            totalStock: newTotalStock,
          },
        });

        // Recalculate FIFO cost (cost of next available batch)
        const nextBatch = await tx.ingredientBatch.findFirst({
          where: {
            ingredientId,
            isClosed: false,
            remainingQty: { gt: 0 },
          },
          orderBy: { createdAt: 'asc' },
        });

        const newFifoCost = nextBatch?.unitCost ?? null;

        await tx.ingredient.update({
          where: { id: ingredientId },
          data: {
            fifoUnitCost: newFifoCost,
          },
        });

        return { totalCost, deductions };
      },
      {
        maxWait: 5000, // Max wait time for transaction
        timeout: 10000, // Transaction timeout
      },
    );

    this.logger.log(
      `Stock deducted via FIFO: ${qty.toString()} from ingredient ${ingredientId}, total cost: ${result.totalCost.toString()}`,
    );

    // Close empty batches
    await this.batchService.closeEmptyBatches(ingredientId);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return result;
  }

  /**
   * Consume recipe ingredients for an order
   */
  consumeRecipeForOrder(orderId: string, _companyId: string) {
    // TODO: This will be called from OrderService
    // For now, this is a placeholder that will be implemented when OrderService is created
    // The logic should:
    // 1. Get order with order lines
    // 2. For each order line, get menu item and recipe
    // 3. Expand recipe to ingredients with quantities
    // 4. Aggregate ingredient quantities across all order lines
    // 5. For each ingredient, call deductStock
    // 6. Sum all costs and create COGS ledger entry

    this.logger.log(
      `Recipe consumption for order ${orderId} - to be implemented with OrderService`,
    );

    return { message: 'To be implemented with OrderService integration' };
  }

  /**
   * Get ingredient stock status
   */
  async getIngredientStock(
    ingredientId: string,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id: ingredientId,
        companyId: organization.id,
      },
      include: {
        batches: {
          where: { isClosed: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      totalStock: ingredient.totalStock,
      averageUnitCost: ingredient.averageUnitCost,
      fifoUnitCost: ingredient.fifoUnitCost,
      batches: ingredient.batches,
    };
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredients = await this.prismaService.ingredient.findMany({
      where: {
        companyId: organization.id,
        isActive: true,
        reorderThreshold: { not: null },
      },
    });

    const alerts = ingredients
      .filter((ing) => {
        if (!ing.reorderThreshold) {
          return false;
        }
        return ing.totalStock.lte(ing.reorderThreshold);
      })
      .map((ing) => ({
        ingredientId: ing.id,
        name: ing.name,
        totalStock: ing.totalStock,
        reorderThreshold: ing.reorderThreshold,
        unit: ing.unit,
      }));

    return alerts;
  }
}
