import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../database/prisma.module';
import { QueueModule } from '../services/queue/queue.module';

import { ClerkWebhookController } from './clerk-webhook.controller';

@Module({
  imports: [ConfigModule, PrismaModule, QueueModule],
  controllers: [ClerkWebhookController],
})
export class ClerkWebhookModule {}
