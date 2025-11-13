import { SetMetadata } from '@nestjs/common';

import type { RateLimitOptions } from '../guards/rate-limit.guard';

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Decorator to apply rate limiting to an endpoint
 * @param options Rate limit configuration
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Convenience decorator for common rate limits
 */
export const RateLimitPerMinute = (maxRequests: number) =>
  RateLimit({ windowMs: 60 * 1000, maxRequests });

export const RateLimitPerHour = (maxRequests: number) =>
  RateLimit({ windowMs: 60 * 60 * 1000, maxRequests });

export const RateLimitPerDay = (maxRequests: number) =>
  RateLimit({ windowMs: 24 * 60 * 60 * 1000, maxRequests });
