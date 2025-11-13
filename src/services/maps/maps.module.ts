import { Module, Global } from '@nestjs/common';

import { MapsService } from './maps.service';

@Global()
@Module({
  providers: [MapsService],
  exports: [MapsService],
})
export class MapsModule {}
