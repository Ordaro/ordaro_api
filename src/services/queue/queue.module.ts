import { Module, Global, forwardRef } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { SMSModule } from '../sms/sms.module';

import { QueueService } from './queue.service';
import { NotificationWorker } from './workers/notification.worker';

@Global()
@Module({
  imports: [forwardRef(() => EmailModule), SMSModule],
  providers: [QueueService, NotificationWorker],
  exports: [QueueService],
})
export class QueueModule {}
