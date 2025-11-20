import { Module, forwardRef } from '@nestjs/common';

import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../database';
import { CacheModule } from '../services/cache';
import { EmailModule } from '../services/email/email.module';
import { QueueModule } from '../services/queue/queue.module';
import { SMSModule } from '../services/sms/sms.module';

import { CustomerAnalyticsController } from './customer-analytics.controller';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { ConsentService } from './services/consent.service';
import { CustomerAnalyticsService } from './services/customer-analytics.service';
import { NotificationService } from './services/notification.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    CacheModule,
    CommonModule,
    forwardRef(() => EmailModule),
    forwardRef(() => SMSModule),
  ],
  controllers: [CustomersController, CustomerAnalyticsController],
  providers: [
    CustomersService,
    ConsentService,
    NotificationService,
    CustomerAnalyticsService,
  ],
  exports: [
    CustomersService,
    ConsentService,
    NotificationService,
    CustomerAnalyticsService,
  ],
})
export class CustomersModule {}
