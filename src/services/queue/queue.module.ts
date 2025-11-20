import { Module, Global, forwardRef } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { SMSModule } from '../sms/sms.module';

import { QueueService } from './queue.service';
import { CostUpdateWorker } from './workers/cost-update.worker';
import { InventoryWorker } from './workers/inventory.worker';
import { MenuCascadeWorker } from './workers/menu-cascade.worker';
import { NotificationWorker } from './workers/notification.worker';

@Global()
@Module({
  imports: [forwardRef(() => EmailModule), SMSModule],
  providers: [
    QueueService,
    NotificationWorker,
    CostUpdateWorker,
    MenuCascadeWorker,
    InventoryWorker,
  ],
  exports: [QueueService],
})
export class QueueModule {}
