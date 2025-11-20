import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CogsService {
  private readonly logger = new Logger(CogsService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Record order COGS
   */
  async recordOrderCogs(
    orderId: string,
    totalCost: Prisma.Decimal,
    metadata: Record<string, unknown> | null,
    companyId: string,
  ): Promise<unknown> {
    const cogsLedger = await this.prismaService.cogsLedger.create({
      data: {
        orderId,
        totalCost,
        metadata: metadata as Prisma.InputJsonValue,
        companyId,
      },
    });

    this.logger.log(
      `COGS recorded: ${cogsLedger.id} for order ${orderId}, cost: ${totalCost.toString()}`,
    );

    return cogsLedger;
  }
}
