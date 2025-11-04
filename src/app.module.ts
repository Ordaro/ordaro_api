import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { BranchesModule } from './branches';
import { CommonModule } from './common/common.module';
import { ConfigModule, ConfigService } from './config';
import { PrismaModule } from './database';
import { HealthModule } from './health';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OrganizationsModule } from './organizations';
import { UsersModule } from './users';
import { PlansModule } from './plans';
import { SubscriptionsModule } from './subscriptions';
import { CacheModule } from './services/cache/cache.module';
import { StorageModule } from './services/storage/storage.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
    CommonModule,
    ConfigModule,
    PrismaModule,
    CacheModule,
    StorageModule,
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
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
