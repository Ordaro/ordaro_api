import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PrismaService } from '../../../database/prisma.service';
import { QueueService, JobData } from '../queue.service';

@Injectable()
export class MenuCascadeWorker implements OnModuleInit {
  private readonly logger = new Logger(MenuCascadeWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prismaService: PrismaService,
  ) {}

  onModuleInit() {
    // Create worker for menu-cascade queue
    this.queueService.createWorker(
      'menu-cascade',
      async (job: Job<JobData>) => {
        return this.processMenuCascadeJob(job);
      },
    );

    this.logger.log('Menu cascade worker initialized');
  }

  private async processMenuCascadeJob(job: Job<JobData>): Promise<unknown> {
    const attemptNumber = (job.attemptsMade ?? 0) + 1;
    const maxAttempts = job.opts.attempts ?? 3;

    this.logger.log(
      `Processing menu cascade job ${job.id ?? 'unknown'} - Attempt ${attemptNumber}/${maxAttempts}`,
    );

    try {
      const data = job.data as Record<string, unknown>;
      const menuItemId = data['menuItemId'] as string;
      const companyId = data['companyId'] as string;

      if (!menuItemId || !companyId) {
        throw new Error('menuItemId and companyId are required');
      }

      // Verify menu item exists
      const menuItem = await this.prismaService.menuItem.findUnique({
        where: { id: menuItemId },
      });

      if (!menuItem) {
        throw new Error(`Menu item not found: ${menuItemId}`);
      }

      // Get all branches for the company
      const branches = await this.prismaService.branch.findMany({
        where: {
          organizationId: companyId,
          isActive: true,
        },
        select: { id: true },
      });

      // Create BranchMenu entries for each branch
      const branchMenuData = branches.map((branch) => ({
        branchId: branch.id,
        menuItemId,
      }));

      // Use createMany with skipDuplicates to avoid conflicts
      const result = await this.prismaService.branchMenu.createMany({
        data: branchMenuData,
        skipDuplicates: true,
      });

      this.logger.log(
        `Menu cascade completed: ${menuItemId} propagated to ${result.count} branches`,
      );

      return {
        menuItemId,
        branchesProcessed: result.count,
        totalBranches: branches.length,
      };
    } catch (error) {
      this.logger.error(
        `Error processing menu cascade job ${job.id ?? 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
