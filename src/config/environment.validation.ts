import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export enum NodeEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test',
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export enum LogFormat {
  DEV = 'dev',
  JSON = 'json',
}

export class EnvironmentVariables {
  // Application
  @IsEnum(NodeEnvironment)
  NODE_ENV!: NodeEnvironment;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  APP_BASE_URL!: string;

  // Database
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  DATABASE_HOST!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(65535)
  DATABASE_PORT!: number;

  @IsString()
  DATABASE_NAME!: string;

  @IsString()
  DATABASE_USER!: string;

  @IsString()
  DATABASE_PASSWORD!: string;

  // Redis
  @IsString()
  REDIS_URL!: string;

  @IsString()
  REDIS_HOST!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT!: number;

  // Auth0
  @IsString()
  AUTH0_DOMAIN!: string;

  @IsString()
  AUTH0_TENANT_DOMAIN!: string;

  @IsString()
  AUTH0_AUDIENCE!: string;

  @IsString()
  AUTH0_ISSUER_URL!: string;

  @IsString()
  AUTH0_FRONTEND_CLIENT_ID!: string;

  @IsString()
  AUTH0_MANAGEMENT_CLIENT_ID!: string;

  @IsString()
  AUTH0_MANAGEMENT_CLIENT_SECRET!: string;

  @IsString()
  AUTH0_MANAGEMENT_AUDIENCE!: string;

  @IsString()
  AUTH0_OWNER_ROLE_ID!: string;

  @IsString()
  AUTH0_MANAGER_ROLE_ID!: string;

  @IsString()
  AUTH0_WAITER_ROLE_ID!: string;

  @IsString()
  AUTH0_CHEF_ROLE_ID!: string;

  @IsString()
  AUTH0_GOOGLE_CON_ID!: string;

  @IsString()
  AUTH0_CUSTOM_CLAIMS_NAMESPACE!: string;

  @IsString()
  AUTH0_EMAIL_API_KEY!: string;

  // Clerk
  @IsString()
  CLERK_SECRET_KEY!: string;

  @IsString()
  CLERK_PUBLISHABLE_KEY!: string;

  @IsString()
  CLERK_SIGNING_SECRET!: string;

  @IsString()
  CLERK_ISSUER_URL!: string;

  @IsString()
  CLERK_JWT_AUDIENCE!: string;

  @IsString()
  CLERK_JWT_TEMPLATE_ID!: string;

  @IsString()
  CLERK_FRONTEND_API!: string;

  @IsString()
  API_INTERNAL_TOKEN!: string;

  // API
  @IsString()
  API_PREFIX!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  API_RATE_LIMIT!: number;

  // External Services
  @IsString()
  STRIPE_SECRET_KEY!: string;

  @IsString()
  STRIPE_WEBHOOK_SECRET!: string;

  @IsString()
  EMAIL_SERVICE_API_KEY!: string;

  @IsString()
  SMS_SERVICE_API_KEY!: string;

  // Paystack
  @IsString()
  PAYSTACK_SECRET_KEY!: string;

  @IsString()
  PAYSTACK_PUBLIC_KEY!: string;

  @IsOptional()
  @IsString()
  PAYSTACK_BASE_URL?: string;

  @IsOptional()
  @IsString()
  PAYSTACK_CURRENCY?: string;

  // Logging
  @IsEnum(LogLevel)
  LOG_LEVEL!: LogLevel;

  @IsEnum(LogFormat)
  LOG_FORMAT!: LogFormat;

  // File Upload
  @Type(() => Number)
  @IsNumber()
  @Min(1024) // Minimum 1KB
  MAX_FILE_SIZE!: number;

  @IsString()
  UPLOAD_PATH!: string;

  // CORS
  @IsString()
  CORS_ORIGIN!: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  CORS_CREDENTIALS!: boolean;

  // Security
  @Type(() => Number)
  @IsNumber()
  @Min(4)
  @Max(20)
  BCRYPT_ROUNDS!: number;

  @IsString()
  SESSION_SECRET!: string;

  // Feature Flags
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  ENABLE_SWAGGER!: boolean;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  ENABLE_METRICS!: boolean;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  ENABLE_DEBUG_ROUTES!: boolean;
}
