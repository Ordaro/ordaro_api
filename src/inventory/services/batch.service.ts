import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Create a new batch
   */
  async createBatch(
    ingredientId: string,
    qty: Prisma.Decimal,
    unitCost: Prisma.Decimal,
    totalCost: Prisma.Decimal,
    receiptRef: string | null,
    expiresAt: Date | null,
    branchId: string | null,
  ): Promise<unknown> {
    const batch = await this.prismaService.ingredientBatch.create({
      data: {
        ingredientId,
        remainingQty: qty,
        unitCost,
        totalCost,
        receiptRef,
        expiresAt,
        branchId,
      },
    });

    this.logger.log(
      `Batch created: ${batch.id} for ingredient ${ingredientId}`,
    );

    return batch;
  }

  /**
   * Close empty batches
   */
  async closeEmptyBatches(ingredientId: string): Promise<void> {
    await this.prismaService.ingredientBatch.updateMany({
      where: {
        ingredientId,
        remainingQty: { lte: 0 },
        isClosed: false,
      },
      data: {
        isClosed: true,
      },
    });
  }
}
