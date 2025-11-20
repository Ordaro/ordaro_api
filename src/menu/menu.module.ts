import { Module, forwardRef } from '@nestjs/common';

import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../database';
import { RecipesModule } from '../recipes';
import { CacheModule } from '../services/cache';
import { QueueModule } from '../services/queue/queue.module';

import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    CacheModule,
    CommonModule,
    forwardRef(() => RecipesModule),
  ],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
