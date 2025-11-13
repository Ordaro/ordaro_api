import { SetMetadata } from '@nestjs/common';

import type { CacheOptions } from './cache.interceptor';

export const CACHE_KEY = 'cache';
export const CACHE_TTL = 'cache_ttl';

/**
 * Decorator to enable caching for an endpoint
 * @param options Cache configuration options
 */
export const Cache = (options: CacheOptions = {}) =>
  SetMetadata(CACHE_KEY, options);

/**
 * Decorator to set cache TTL for an endpoint
 * @param ttl Time to live in seconds
 */
export const CacheTTL = (ttl: number) => SetMetadata(CACHE_TTL, ttl);
