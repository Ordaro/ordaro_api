import { Module } from '@nestjs/common';

import { PrismaModule } from '../database';
import { CacheModule } from '../services/cache';

import { CompanySettingsController } from './company-settings.controller';
import { CompanySettingsService } from './company-settings.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [CompanySettingsController],
  providers: [CompanySettingsService],
  exports: [CompanySettingsService],
})
export class CompanySettingsModule {}
