import { Module, forwardRef } from '@nestjs/common';

import { BranchMenuModule } from '../branch-menu';
import { CommonModule } from '../common/common.module';
import { CompanySettingsModule } from '../company-settings';
import { PrismaModule } from '../database';
import { MenuModule } from '../menu';
import { CacheModule } from '../services/cache';
import { QueueModule } from '../services/queue/queue.module';

import { MenuProposalsController } from './menu-proposals.controller';
import { MenuProposalsService } from './menu-proposals.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    CacheModule,
    CommonModule,
    forwardRef(() => MenuModule),
    forwardRef(() => BranchMenuModule),
    CompanySettingsModule,
  ],
  controllers: [MenuProposalsController],
  providers: [MenuProposalsService],
  exports: [MenuProposalsService],
})
export class MenuProposalsModule {}
