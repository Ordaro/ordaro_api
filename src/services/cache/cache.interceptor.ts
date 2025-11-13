import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, of, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';

import { RedisService } from './redis.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string; // Prefix for cache key
  includeUser?: boolean; // Include user ID in cache key
  includeOrg?: boolean; // Include organization ID in cache key
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(private readonly redisService: RedisService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, query } = request;

    // Only cache GET requests
    if (method !== 'GET') {
      return next.handle();
    }

    // Get cache options from metadata or use defaults
    const cacheOptions: CacheOptions = this.getCacheOptions(context);
    const cacheKey = this.generateCacheKey(request, url, query, cacheOptions);

    // Check cache first
    return from(this.redisService.getJson<any>(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          this.logger.debug(`Cache HIT for key: ${cacheKey}`);
          return of(cached);
        }

        // Cache miss - execute handler and cache response
        this.logger.debug(`Cache MISS for key: ${cacheKey}`);
        return next.handle().pipe(
          tap((data) => {
            const ttl = cacheOptions.ttl || 300; // Default 5 minutes
            this.redisService
              .setJson(cacheKey, data, ttl)
              .then((success) => {
                if (success) {
                  this.logger.debug(
                    `Cached response for key: ${cacheKey} (TTL: ${ttl}s)`,
                  );
                }
              })
              .catch((error) => {
                this.logger.warn(`Failed to cache response: ${error.message}`);
              });
          }),
        );
      }),
    );
  }

  private generateCacheKey(
    request: Request,
    url: string,
    query: Record<string, any>,
    options: CacheOptions,
  ): string {
    const parts: string[] = ['cache'];

    // Add prefix
    if (options.keyPrefix) {
      parts.push(options.keyPrefix);
    }

    // Try to get user from request (set by Auth0Guard)
    const user = (
      request as Request & {
        user?: { organizationId?: string; auth0Id?: string };
      }
    ).user;

    // Always include organization ID if available (for multi-tenant isolation)
    if (user?.organizationId) {
      parts.push(`org:${user.organizationId}`);
    }

    // Add user ID if requested
    if (options.includeUser && user?.auth0Id) {
      parts.push(`user:${user.auth0Id}`);
    }

    // Add URL path
    parts.push(url.replace(/^\//, '').replace(/\//g, ':'));

    // Add query parameters (sorted for consistency)
    const queryKeys = Object.keys(query).sort();
    if (queryKeys.length > 0) {
      const queryString = queryKeys
        .map((key) => `${key}=${String(query[key])}`)
        .join('&');
      parts.push(`q:${Buffer.from(queryString).toString('base64url')}`);
    }

    return parts.join(':');
  }

  private getCacheOptions(context: ExecutionContext): CacheOptions {
    const handler = context.getHandler();
    const controller = context.getClass();

    // Try to get cache metadata from handler or controller
    const handlerMetadata = Reflect.getMetadata('cache', handler);
    const controllerMetadata = Reflect.getMetadata('cache', controller);

    return handlerMetadata || controllerMetadata || {};
  }
}
