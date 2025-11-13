import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly config: RedisOptions;

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.get<{
      url?: string;
      host?: string;
      port?: number;
      password?: string;
      db?: number;
    }>('app.redis');

    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    const useTLS = nodeEnv === 'production' || nodeEnv === 'staging';

    const password = redisConfig?.password || process.env['REDIS_PASSWORD'];
    this.config = {
      host: redisConfig?.host || process.env['REDIS_HOST'] || 'localhost',
      port:
        redisConfig?.port || parseInt(process.env['REDIS_PORT'] || '6379', 10),
      ...(password && { password }),
      db: redisConfig?.db || parseInt(process.env['REDIS_DB'] || '0', 10),
      maxRetriesPerRequest: null,
      name: 'ordaro-api-redis-client',
      ...(useTLS && { tls: {} }),
      ...(redisConfig?.url && { url: redisConfig.url }),
    };
  }

  async onModuleInit() {
    try {
      this.client = new Redis(this.config);

      this.client.on('connect', () => {
        this.logger.log('Redis client connected successfully.');
      });

      this.client.on('error', (error) => {
        this.logger.error(`Redis client error: ${error.message}`, error.stack);
      });

      this.client.on('ready', () => {
        this.logger.log('Redis client is ready.');
      });

      this.client.on('close', () => {
        this.logger.warn('Redis client connection closed.');
      });

      // Test connection
      await this.client.ping();
      this.logger.log('Redis connection established and tested.');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - allow app to start without Redis in development
      if (this.configService.get<string>('app.nodeEnv') === 'production') {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis client disconnected.');
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected()) {
      this.logger.warn(`Redis not connected, skipping get for key: ${key}`);
      return null;
    }
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(
        `Error getting key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected()) {
      this.logger.warn(`Redis not connected, skipping set for key: ${key}`);
      return false;
    }
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Error setting key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected()) {
      this.logger.warn(`Redis not connected, skipping del for key: ${key}`);
      return false;
    }
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected()) {
      return false;
    }
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Error checking existence of key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client || !this.isConnected()) {
      return false;
    }
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Error setting expiration on key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get JSON value (helper method)
   */
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set JSON value (helper method)
   */
  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value);
      return await this.set(key, jsonString, ttlSeconds);
    } catch (error) {
      this.logger.error(
        `Error serializing JSON for key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
