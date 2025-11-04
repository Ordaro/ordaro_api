import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { NodeEnvironment } from './environment.validation';

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService) {}

  // Application
  get nodeEnv(): NodeEnvironment {
    return this.configService.get<NodeEnvironment>(
      'app.nodeEnv',
      NodeEnvironment.DEVELOPMENT,
    );
  }

  get port(): number {
    return this.configService.get<number>('app.port', 3000);
  }

  get isDevelopment(): boolean {
    return this.configService.get<boolean>('app.isDevelopment', false);
  }

  get isStaging(): boolean {
    return this.configService.get<boolean>('app.isStaging', false);
  }

  get isProduction(): boolean {
    return this.configService.get<boolean>('app.isProduction', false);
  }

  get isTest(): boolean {
    return this.configService.get<boolean>('app.isTest', false);
  }

  // Database
  get databaseConfig() {
    return {
      url: this.configService.get<string>('app.database.url'),
      host: this.configService.get<string>('app.database.host'),
      port: this.configService.get<number>('app.database.port'),
      name: this.configService.get<string>('app.database.name'),
      user: this.configService.get<string>('app.database.user'),
      password: this.configService.get<string>('app.database.password'),
    };
  }

  // Redis
  get redisConfig() {
    return {
      url: this.configService.get<string>('app.redis.url'),
      host: this.configService.get<string>('app.redis.host'),
      port: this.configService.get<number>('app.redis.port'),
    };
  }

  // AUTH0

  // API
  get apiConfig() {
    return {
      prefix: this.configService.get<string>('app.api.prefix'),
      rateLimit: this.configService.get<number>('app.api.rateLimit'),
    };
  }

  // External Services
  get stripeConfig() {
    return {
      secretKey: this.configService.get<string>('app.stripe.secretKey'),
      webhookSecret: this.configService.get<string>('app.stripe.webhookSecret'),
    };
  }

  get paystackConfig() {
    return {
      secretKey: this.configService.get<string>('app.paystack.secretKey'),
      publicKey: this.configService.get<string>('app.paystack.publicKey'),
      baseUrl: this.configService.get<string>('app.paystack.baseUrl'),
      currency: this.configService.get<string>('app.paystack.currency', 'GHS'),
    };
  }

  get emailConfig() {
    return {
      apiKey: this.configService.get<string>('app.email.apiKey'),
    };
  }

  get smsConfig() {
    return {
      apiKey: this.configService.get<string>('app.sms.apiKey'),
    };
  }

  // Logging
  get loggingConfig() {
    return {
      level: this.configService.get<string>('app.logging.level'),
      format: this.configService.get<string>('app.logging.format'),
    };
  }

  // File Upload
  get uploadConfig() {
    return {
      maxFileSize: this.configService.get<number>('app.upload.maxFileSize'),
      path: this.configService.get<string>('app.upload.path'),
    };
  }

  // CORS
  get corsConfig() {
    return {
      origin: this.configService.get<string[]>('app.cors.origin'),
      credentials: this.configService.get<boolean>('app.cors.credentials'),
    };
  }

  // Security
  get securityConfig() {
    return {
      bcryptRounds: this.configService.get<number>('app.security.bcryptRounds'),
      sessionSecret: this.configService.get<string>(
        'app.security.sessionSecret',
      ),
    };
  }

  // Feature Flags
  get featuresConfig() {
    return {
      swagger: this.configService.get<boolean>('app.features.swagger'),
      metrics: this.configService.get<boolean>('app.features.metrics'),
      debugRoutes: this.configService.get<boolean>('app.features.debugRoutes'),
    };
  }

  // Utility methods
  get<T = any>(key: string, defaultValue?: T): T | undefined {
    if (defaultValue !== undefined) {
      return this.configService.get<T>(key, defaultValue);
    }
    return this.configService.get<T>(key);
  }

  getOrThrow<T = any>(key: string): T {
    return this.configService.getOrThrow<T>(key);
  }
}
