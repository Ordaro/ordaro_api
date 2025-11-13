import { Module, Global } from '@nestjs/common';

import { SMSService } from './sms.service';

@Global()
@Module({
  providers: [SMSService],
  exports: [SMSService],
})
export class SMSModule {}
