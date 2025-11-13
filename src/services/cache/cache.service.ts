import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate cache key for a resource
   */
  generateKey(
    prefix: string,
    params: Record<string, string | number | undefined> = {},
  ): string {
    const parts = [prefix];
    Object.keys(params)
      .sort()
      .forEach((key) => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          parts.push(`${key}:${value}`);
        }
      });
    return parts.join(':');
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redisService.isConnected()) {
      this.logger.warn(
        `Redis not connected, skipping cache invalidation for pattern: ${pattern}`,
      );
      return;
    }

    try {
      const client = this.redisService.getClient();
      if (!client) {
        return;
      }

      // Use SCAN to find matching keys (safer for production than KEYS)
      const stream = client.scanStream({
        match: pattern,
        count: 100,
      });

      const keys: string[] = [];
      stream.on('data', (resultKeys: string[]) => {
        keys.push(...resultKeys);
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', () => {
          resolve();
        });
        stream.on('error', reject);
      });

      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.log(
          `Invalidated ${keys.length} cache keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error invalidating cache pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Invalidate cache by exact key
   */
  async invalidateKey(key: string): Promise<void> {
    if (!this.redisService.isConnected()) {
      return;
    }

    try {
      await this.redisService.del(key);
      this.logger.debug(`Invalidated cache key: ${key}`);
    } catch (error) {
      this.logger.error(
        `Error invalidating cache key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Invalidate all cache entries for an organization
   */
  async invalidateOrganization(organizationId: string): Promise<void> {
    await this.invalidatePattern(`cache:*:org:${organizationId}:*`);
  }

  /**
   * Invalidate all cache entries for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.invalidatePattern(`cache:*:user:${userId}:*`);
  }

  /**
   * Invalidate cache for a specific resource type
   */
  async invalidateResource(
    resourceType: string,
    organizationId?: string,
    resourceId?: string,
  ): Promise<void> {
    let pattern = `cache:*`;
    if (organizationId) {
      pattern += `:org:${organizationId}`;
    }
    // Match resource type in URL path (e.g., branches, users, plans)
    pattern += `:*${resourceType}*`;
    if (resourceId) {
      pattern += `:*${resourceId}*`;
    }
    pattern += `*`;
    await this.invalidatePattern(pattern);
  }
}
