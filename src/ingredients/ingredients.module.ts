import { Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../database';
import { CacheModule } from '../services/cache';
import { QueueModule } from '../services/queue/queue.module';

import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

@Module({
  imports: [PrismaModule, QueueModule, CacheModule, CommonModule],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
