import { Module, Global } from '@nestjs/common';

import { CacheInterceptor } from './cache.interceptor';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, CacheInterceptor, CacheService],
  exports: [RedisService, CacheInterceptor, CacheService],
})
export class CacheModule {}
