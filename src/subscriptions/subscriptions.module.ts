import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../database/prisma.module';
import { PlansModule } from '../plans/plans.module';

import { PaystackService } from './paystack.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ConfigModule,
    forwardRef(() => PlansModule),
  ],
  controllers: [SubscriptionsController, WebhooksController],
  providers: [SubscriptionsService, PaystackService],
  exports: [SubscriptionsService, PaystackService],
})
export class SubscriptionsModule {}
