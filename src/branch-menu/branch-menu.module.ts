import { Module, forwardRef } from '@nestjs/common';

import { CompanySettingsModule } from '../company-settings';
import { PrismaModule } from '../database';
import { MenuModule } from '../menu';
import { CacheModule } from '../services/cache';

import { BranchMenuController } from './branch-menu.controller';
import { BranchMenuService } from './branch-menu.service';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    forwardRef(() => MenuModule),
    forwardRef(() => CompanySettingsModule),
  ],
  controllers: [BranchMenuController],
  providers: [BranchMenuService],
  exports: [BranchMenuService],
})
export class BranchMenuModule {}
