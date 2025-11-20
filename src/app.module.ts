import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AnalyticsModule } from './analytics';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { BranchMenuModule } from './branch-menu';
import { BranchesModule } from './branches';
import { ClerkWebhookModule } from './clerk-webhook';
import { CommonModule } from './common/common.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CompanySettingsModule } from './company-settings';
import { ConfigModule, ConfigService } from './config';
import { CustomersModule } from './customers';
import { PrismaModule } from './database';
import { HealthModule } from './health';
import { IngredientsModule } from './ingredients';
import { InventoryModule } from './inventory';
import { MenuModule } from './menu';
import { MenuProposalsModule } from './menu-proposals';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OrganizationsModule } from './organizations';
import { PlansModule } from './plans';
import { RecipesModule } from './recipes';
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
    IngredientsModule,
    RecipesModule,
    MenuModule,
    BranchMenuModule,
    CompanySettingsModule,
    MenuProposalsModule,
    InventoryModule,
    AnalyticsModule,
    CustomersModule,
    ClerkWebhookModule,
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
