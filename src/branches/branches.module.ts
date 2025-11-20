import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CompanySettingsModule } from '../company-settings';
import { PrismaModule } from '../database/prisma.module';
import { QueueModule } from '../services/queue/queue.module';

import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [PrismaModule, AuthModule, QueueModule, CompanySettingsModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
