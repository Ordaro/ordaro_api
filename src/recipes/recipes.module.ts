import { Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../database';
import { CacheModule } from '../services/cache';
import { QueueModule } from '../services/queue/queue.module';

import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

@Module({
  imports: [PrismaModule, QueueModule, CacheModule, CommonModule],
  controllers: [RecipesController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
