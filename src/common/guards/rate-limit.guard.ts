import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

import { RedisService } from '../../services/cache/redis.service';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get rate limit options from metadata
    const options = this.getRateLimitOptions(
      handler as unknown as (...args: unknown[]) => unknown,
      controller as unknown as (...args: unknown[]) => unknown,
    );

    if (!options) {
      // No rate limit configured, allow request
      return true;
    }

    const key = this.generateKey(request, options);
    const current = await this.getRequestCount(key);

    if (current >= options.maxRequests) {
      throw new HttpException(
        {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(options.windowMs / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.incrementRequestCount(key, options.windowMs);
    return true;
  }

  private generateKey(request: Request, options: RateLimitOptions): string {
    if (options.keyGenerator) {
      return options.keyGenerator(request);
    }

    // Default: rate limit by IP + user (if authenticated)
    const user = (request as Request & { user?: { clerkUserId?: string } })
      .user;
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const userId = user?.clerkUserId || 'anonymous';

    return `ratelimit:${ip}:${userId}`;
  }

  private async getRequestCount(key: string): Promise<number> {
    if (!this.redisService.isConnected()) {
      // If Redis is not connected, allow request (fail open)
      return 0;
    }

    const count = await this.redisService.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  private async incrementRequestCount(
    key: string,
    windowMs: number,
  ): Promise<void> {
    if (!this.redisService.isConnected()) {
      return;
    }

    const ttlSeconds = Math.ceil(windowMs / 1000);
    const current = await this.getRequestCount(key);
    await this.redisService.set(key, String(current + 1), ttlSeconds);
  }

  private getRateLimitOptions(
    handler: (...args: unknown[]) => unknown,
    controller: (...args: unknown[]) => unknown,
  ): RateLimitOptions | undefined {
    const handlerMetadata = Reflect.getMetadata('rateLimit', handler);
    const controllerMetadata = Reflect.getMetadata('rateLimit', controller);

    return handlerMetadata || controllerMetadata;
  }
}
