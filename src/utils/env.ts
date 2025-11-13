/**
 * Centralized environment variable access
 * Provides type-safe access to environment variables with defaults
 */

export const env = {
  // Application
  NODE_ENV: (process.env['NODE_ENV'] || 'development') as
    | 'development'
    | 'production'
    | 'staging'
    | 'test',
  PORT: parseInt(process.env['PORT'] || '3000', 10),
  APP_BASE_URL: process.env['APP_BASE_URL'] || 'http://localhost:3000',

  // Database
  DATABASE_URL: process.env['DATABASE_URL'] || '',
  DATABASE_HOST: process.env['DATABASE_HOST'],
  DATABASE_PORT: parseInt(process.env['DATABASE_PORT'] || '5432', 10),
  DATABASE_NAME: process.env['DATABASE_NAME'],
  DATABASE_USER: process.env['DATABASE_USER'],
  DATABASE_PASSWORD: process.env['DATABASE_PASSWORD'],

  // Redis
  REDIS_URL: process.env['REDIS_URL'],
  REDIS_HOST: process.env['REDIS_HOST'] || 'localhost',
  REDIS_PORT: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  REDIS_PASSWORD: process.env['REDIS_PASSWORD'],
  REDIS_DB: parseInt(process.env['REDIS_DB'] || '0', 10),

  // Auth0
  AUTH0_DOMAIN: process.env['AUTH0_DOMAIN'] || '',
  AUTH0_TENANT_DOMAIN: process.env['AUTH0_TENANT_DOMAIN'],
  AUTH0_AUDIENCE: process.env['AUTH0_AUDIENCE'] || '',
  AUTH0_ISSUER_URL: process.env['AUTH0_ISSUER_URL'],
  AUTH0_FRONTEND_CLIENT_ID: process.env['AUTH0_FRONTEND_CLIENT_ID'],
  AUTH0_MANAGEMENT_CLIENT_ID: process.env['AUTH0_MANAGEMENT_CLIENT_ID'],
  AUTH0_MANAGEMENT_CLIENT_SECRET: process.env['AUTH0_MANAGEMENT_CLIENT_SECRET'],
  AUTH0_MANAGEMENT_AUDIENCE: process.env['AUTH0_MANAGEMENT_AUDIENCE'],
  AUTH0_CUSTOM_CLAIMS_NAMESPACE: process.env['AUTH0_CUSTOM_CLAIMS_NAMESPACE'],

  // API
  API_PREFIX: process.env['API_PREFIX'],
  API_INTERNAL_TOKEN: process.env['API_INTERNAL_TOKEN'],
  API_RATE_LIMIT: parseInt(process.env['API_RATE_LIMIT'] || '100', 10),

  // External Services
  PAYSTACK_SECRET_KEY: process.env['PAYSTACK_SECRET_KEY'],
  PAYSTACK_PUBLIC_KEY: process.env['PAYSTACK_PUBLIC_KEY'],
  PAYSTACK_BASE_URL:
    process.env['PAYSTACK_BASE_URL'] || 'https://api.paystack.co',
  PAYSTACK_CURRENCY: process.env['PAYSTACK_CURRENCY'] || 'GHS',

  STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'],
  STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'],

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env['CLOUDINARY_CLOUD_NAME'] || '',
  CLOUDINARY_API_KEY: process.env['CLOUDINARY_API_KEY'] || '',
  CLOUDINARY_SECRET: process.env['CLOUDINARY_SECRET'] || '',
  CLOUDINARY_SECURE: process.env['CLOUDINARY_SECURE'] !== 'false',

  // Email & SMS
  EMAIL_SERVICE_API_KEY: process.env['EMAIL_SERVICE_API_KEY'],
  EMAIL_SERVICE_API_URL: process.env['EMAIL_SERVICE_API_URL'],
  EMAIL_FROM: process.env['EMAIL_FROM'],
  EMAIL_FROM_NAME: process.env['EMAIL_FROM_NAME'],
  SMS_SERVICE_API_KEY: process.env['SMS_SERVICE_API_KEY'],

  // Maps
  MAPS_API_KEY: process.env['MAPS_API_KEY'],
  MAPS_PROVIDER: (process.env['MAPS_PROVIDER'] || 'google') as
    | 'google'
    | 'mapbox'
    | 'openstreetmap',

  // Logging
  LOG_LEVEL:
    process.env['LOG_LEVEL'] ||
    (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
  LOG_FORMAT: process.env['LOG_FORMAT'] || 'json',

  // File Upload
  MAX_FILE_SIZE: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10), // 10MB default
  UPLOAD_PATH: process.env['UPLOAD_PATH'],

  // CORS
  CORS_ORIGIN: process.env['CORS_ORIGIN']?.split(',') || [],
  CORS_CREDENTIALS: process.env['CORS_CREDENTIALS'] === 'true',

  // Security
  BCRYPT_ROUNDS: parseInt(process.env['BCRYPT_ROUNDS'] || '10', 10),
  SESSION_SECRET: process.env['SESSION_SECRET'],

  // Feature Flags
  ENABLE_SWAGGER: process.env['ENABLE_SWAGGER'] === 'true',
  ENABLE_METRICS: process.env['ENABLE_METRICS'] === 'true',
  ENABLE_DEBUG_ROUTES: process.env['ENABLE_DEBUG_ROUTES'] === 'true',
} as const;

/**
 * Validate required environment variables
 */
export function validateEnv(): void {
  const required = ['DATABASE_URL', 'AUTH0_DOMAIN', 'AUTH0_AUDIENCE'];

  const missing: string[] = [];

  for (const key of required) {
    if (!env[key as keyof typeof env] || env[key as keyof typeof env] === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Check if running in staging
 */
export function isStaging(): boolean {
  return env.NODE_ENV === 'staging';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return env.NODE_ENV === 'test';
}
