import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../database/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ConfigModule,
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
