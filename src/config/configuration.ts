import { registerAs } from '@nestjs/config';

import { NodeEnvironment } from './environment.validation';

export default registerAs('app', () => {
  const env =
    (process.env['NODE_ENV'] as NodeEnvironment) || NodeEnvironment.DEVELOPMENT;

  return {
    // Application
    nodeEnv: env,
    port: parseInt(process.env['PORT'] || '3000', 10),
    baseUrl: process.env['APP_BASE_URL'] || 'http://localhost:3000', // Add this
    isDevelopment: env === NodeEnvironment.DEVELOPMENT,
    isStaging: env === NodeEnvironment.STAGING,
    isProduction: env === NodeEnvironment.PRODUCTION,
    isTest: env === NodeEnvironment.TEST,

    // Database
    database: {
      url: process.env['DATABASE_URL'],
      host: process.env['DATABASE_HOST'],
      port: parseInt(process.env['DATABASE_PORT'] || '5432', 10),
      name: process.env['DATABASE_NAME'],
      user: process.env['DATABASE_USER'],
      password: process.env['DATABASE_PASSWORD'],
    },

    // Redis
    redis: {
      url: process.env['REDIS_URL'],
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
      password: process.env['REDIS_PASSWORD'],
      db: parseInt(process.env['REDIS_DB'] || '0', 10),
    },

    // Auth0
    auth0: {
      domain: process.env['AUTH0_DOMAIN'],
      tenantDomain: process.env['AUTH0_TENANT_DOMAIN'], // For Management API
      audience: process.env['AUTH0_AUDIENCE'],
      issuerUrl: process.env['AUTH0_ISSUER_URL'],
      frontendClientId: process.env['AUTH0_FRONTEND_CLIENT_ID'], // Frontend app client ID
      management: {
        clientId: process.env['AUTH0_MANAGEMENT_CLIENT_ID'],
        clientSecret: process.env['AUTH0_MANAGEMENT_CLIENT_SECRET'],
        audience: process.env['AUTH0_MANAGEMENT_AUDIENCE'],
      },
      roles: {
        owner: process.env['AUTH0_OWNER_ROLE_ID'],
        manager: process.env['AUTH0_MANAGER_ROLE_ID'],
        waiter: process.env['AUTH0_WAITER_ROLE_ID'],
        chef: process.env['AUTH0_CHEF_ROLE_ID'],
      },
      connections: {
        default: process.env['AUTH0_GOOGLE_CON_ID'],
      },
      customClaimsNamespace: process.env['AUTH0_CUSTOM_CLAIMS_NAMESPACE'],
    },

    // API
    apiInternalToken: process.env['API_INTERNAL_TOKEN'],
    api: {
      prefix: process.env['API_PREFIX'],
      rateLimit: parseInt(process.env['API_RATE_LIMIT'] || '100', 10),
    },

    // External Services
    stripe: {
      secretKey: process.env['STRIPE_SECRET_KEY'],
      webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
    },
    paystack: {
      secretKey: process.env['PAYSTACK_SECRET_KEY'],
      publicKey: process.env['PAYSTACK_PUBLIC_KEY'],
      baseUrl: process.env['PAYSTACK_BASE_URL'] || 'https://api.paystack.co',
      currency: process.env['PAYSTACK_CURRENCY'] || 'GHS', // Default to GHS, can be NGN, ZAR, KES, etc.
    },

    email: {
      apiKey: process.env['EMAIL_SERVICE_API_KEY'],
    },

    sms: {
      apiKey: process.env['SMS_SERVICE_API_KEY'],
    },

    // Logging
    logging: {
      level: process.env['LOG_LEVEL'],
      format: process.env['LOG_FORMAT'],
    },

    // File Upload
    upload: {
      maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10),
      path: process.env['UPLOAD_PATH'],
    },

    // Cloudinary
    cloudinary: {
      cloudName: process.env['CLOUDINARY_CLOUD_NAME'],
      apiKey: process.env['CLOUDINARY_API_KEY'],
      apiSecret: process.env['CLOUDINARY_SECRET'],
      secure: process.env['CLOUDINARY_SECURE'] !== 'false',
    },

    // CORS
    cors: {
      origin: process.env['CORS_ORIGIN']?.split(',') || [],
      credentials: process.env['CORS_CREDENTIALS'] === 'true',
    },

    // Security
    security: {
      bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '10', 10),
      sessionSecret: process.env['SESSION_SECRET'],
    },

    // Feature Flags
    features: {
      swagger: process.env['ENABLE_SWAGGER'] === 'true',
      metrics: process.env['ENABLE_METRICS'] === 'true',
      debugRoutes: process.env['ENABLE_DEBUG_ROUTES'] === 'true',
    },
  };
});
