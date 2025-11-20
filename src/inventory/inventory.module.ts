import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../database';
import { RecipesModule } from '../recipes';
import { CacheModule } from '../services/cache';
import { QueueModule } from '../services/queue/queue.module';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { BatchService } from './services/batch.service';
import { CogsService } from './services/cogs.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    CacheModule,
    forwardRef(() => RecipesModule),
  ],
  controllers: [InventoryController],
  providers: [InventoryService, BatchService, CogsService],
  exports: [InventoryService, BatchService, CogsService],
})
export class InventoryModule {}
