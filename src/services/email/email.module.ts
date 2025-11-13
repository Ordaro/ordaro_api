import { Module, Global, forwardRef } from '@nestjs/common';

import { QueueModule } from '../queue/queue.module';

import { EmailService } from './email.service';
import { EmailsController } from './emails.controller';

@Global()
@Module({
  imports: [forwardRef(() => QueueModule)],
  controllers: [EmailsController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
