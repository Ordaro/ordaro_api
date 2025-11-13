import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { BranchesModule } from './branches';
import { CommonModule } from './common/common.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ConfigModule, ConfigService } from './config';
import { PrismaModule } from './database';
import { HealthModule } from './health';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OrganizationsModule } from './organizations';
import { PlansModule } from './plans';
import { CacheModule } from './services/cache/cache.module';
import { EmailModule } from './services/email/email.module';
import { MapsModule } from './services/maps/maps.module';
import { QueueModule } from './services/queue/queue.module';
import { SMSModule } from './services/sms/sms.module';
import { StorageModule } from './services/storage/storage.module';
import { SubscriptionsModule } from './subscriptions';
import { UsersModule } from './users';

@Module({
  imports: [
    CommonModule,
    ConfigModule,
    PrismaModule,
    CacheModule,
    StorageModule,
    QueueModule,
    SMSModule,
    EmailModule,
    MapsModule,
    HealthModule,
    MonitoringModule,
    AuthModule,
    OrganizationsModule,
    BranchesModule,
    UsersModule,
    PlansModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, ConfigService],
  exports: [ConfigService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
