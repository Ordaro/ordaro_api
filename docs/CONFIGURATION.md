# Configuration Management Guide

This guide explains how to use the configuration system with dotenvx encryption for the Ordaro API.

## Overview

The configuration system provides:

- **Environment-specific configuration** (development, staging, production)
- **Type-safe configuration** with validation
- **Encrypted environment files** using dotenvx
- **Centralized configuration service**

## File Structure

```
├── .env.development          # Development environment (gitignored)
├── .env.staging             # Staging environment (gitignored)
├── .env.production          # Production environment (gitignored)
├── .env.development.encrypted # Encrypted development (committed)
├── .env.staging.encrypted   # Encrypted staging (committed)
├── .env.production.encrypted # Encrypted production (committed)
├── .env.keys               # Encryption keys (gitignored)
├── src/config/
│   ├── config.module.ts    # Configuration module
│   ├── config.service.ts   # Configuration service
│   ├── configuration.ts    # Configuration factory
│   ├── environment.validation.ts # Validation schemas
│   ├── dotenvx.loader.ts   # dotenvx loader
│   └── index.ts           # Exports
└── scripts/
    ├── encrypt-env.js     # Encryption script
    └── decrypt-env.js     # Decryption script
```

## Environment Files

### Development (.env.development)

Used for local development with debug settings enabled.

### Staging (.env.staging)

Used for staging environment with production-like settings but with debugging enabled.

### Production (.env.production)

Used for production with optimized security settings and debugging disabled.

## Configuration Categories

### Application Settings

- `NODE_ENV`: Environment (development/staging/production)
- `PORT`: Server port

### Database Configuration

- `DATABASE_URL`: Full database connection string
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`: Individual database settings

### Redis Configuration

- `REDIS_URL`: Full Redis connection string
- `REDIS_HOST`, `REDIS_PORT`: Individual Redis settings

### JWT Configuration

- `JWT_SECRET`: JWT signing secret
- `JWT_EXPIRATION`: JWT token expiration
- `JWT_REFRESH_SECRET`: Refresh token secret
- `JWT_REFRESH_EXPIRATION`: Refresh token expiration

### External Services

- `STRIPE_SECRET_KEY`: Stripe payment processing
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook verification
- `EMAIL_SERVICE_API_KEY`: Email service API key
- `SMS_SERVICE_API_KEY`: SMS service API key

### Security Settings

- `BCRYPT_ROUNDS`: Password hashing rounds
- `SESSION_SECRET`: Session signing secret

### Feature Flags

- `ENABLE_SWAGGER`: Enable/disable Swagger documentation
- `ENABLE_METRICS`: Enable/disable metrics collection
- `ENABLE_DEBUG_ROUTES`: Enable/disable debug endpoints

## Usage

### In Your Code

```typescript
import { ConfigService } from './config';

@Injectable()
export class SomeService {
  constructor(private readonly configService: ConfigService) {}

  someMethod() {
    // Get database configuration
    const dbConfig = this.configService.databaseConfig;

    // Check environment
    if (this.configService.isDevelopment) {
      // Development-specific logic
    }

    // Get JWT configuration
    const jwtSecret = this.configService.jwtConfig.secret;

    // Get feature flags
    if (this.configService.featuresConfig.swagger) {
      // Enable Swagger
    }
  }
}
```

### Environment Detection

The system automatically detects the environment from `NODE_ENV`:

```typescript
// Check current environment
configService.nodeEnv; // 'development' | 'staging' | 'production' | 'test'
configService.isDevelopment; // boolean
configService.isStaging; // boolean
configService.isProduction; // boolean
configService.isTest; // boolean
```

## dotenvx Encryption/Decryption

### How it Works

dotenvx automatically handles encryption, decryption, and loading of environment variables. No manual scripts or loaders needed!

### Initial Setup

1. **Encrypt your environment files**:

```bash
npm run env:encrypt:dev      # Encrypts .env.development
npm run env:encrypt:staging  # Encrypts .env.staging
npm run env:encrypt:prod     # Encrypts .env.production
```

2. **Keys are automatically managed**:
   - Private keys are stored in `.env.keys` (gitignored)
   - Public keys are added to the encrypted files
   - dotenvx uses these automatically

### Manual Commands (if needed)

```bash
# Encrypt a specific file
npx @dotenvx/dotenvx encrypt -f .env.development

# Encrypt all .env files
npx @dotenvx/dotenvx encrypt
```

## Running the Application

### Development

```bash
npm run start:dev
# Uses .env.development
```

### Staging

```bash
npm run start:staging
# Uses .env.staging
```

### Production

```bash
npm run start:prod
# Uses .env.production
```

## Validation

The system validates all environment variables on startup:

- **Type validation**: Ensures correct data types
- **Range validation**: Validates numeric ranges
- **Required fields**: Ensures all required variables are present
- **Format validation**: Validates URLs, emails, etc.

If validation fails, the application will not start and will show detailed error messages.

## Security Best Practices

### 1. Environment File Management

- ✅ **DO**: Commit encrypted `.env.*.encrypted` files
- ❌ **DON'T**: Commit unencrypted `.env.*` files
- ❌ **DON'T**: Commit `.env.keys` file

### 2. Key Management

- Store encryption keys securely (use secret management systems in production)
- Rotate keys regularly
- Use different keys for different environments

### 3. Production Settings

- Use strong, unique secrets
- Disable debug features
- Use appropriate bcrypt rounds (12-15 for production)
- Enable only necessary features

### 4. Access Control

- Limit access to environment files
- Use principle of least privilege
- Audit access to configuration

## Troubleshooting

### Configuration Validation Errors

If you see validation errors on startup:

1. Check that all required environment variables are set
2. Verify data types match the validation schema
3. Ensure numeric values are within valid ranges
4. Check that URLs and other formats are valid

### Encryption/Decryption Issues

If encryption/decryption fails:

1. Ensure dotenvx is installed: `npm install @dotenvx/dotenvx`
2. Check that encryption keys are properly set in `.env.keys`
3. Verify file permissions
4. Ensure the target environment file exists

### Environment Loading Issues

If environment variables aren't loading:

1. Check the `NODE_ENV` value
2. Verify the corresponding `.env.*` file exists
3. Check file permissions
4. Review the dotenvx loader configuration

## Example Configuration

Here's an example of how to add a new configuration section:

### 1. Add to Environment Validation

```typescript
// src/config/environment.validation.ts
export class EnvironmentVariables {
  // ... existing properties

  @IsString()
  NEW_SERVICE_API_KEY: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  NEW_SERVICE_TIMEOUT: number;
}
```

### 2. Add to Configuration Factory

```typescript
// src/config/configuration.ts
export default registerAs('app', () => ({
  // ... existing configuration

  newService: {
    apiKey: process.env.NEW_SERVICE_API_KEY,
    timeout: parseInt(process.env.NEW_SERVICE_TIMEOUT, 10),
  },
}));
```

### 3. Add to Configuration Service

```typescript
// src/config/config.service.ts
export class ConfigService {
  // ... existing methods

  get newServiceConfig() {
    return {
      apiKey: this.configService.get<string>('app.newService.apiKey'),
      timeout: this.configService.get<number>('app.newService.timeout'),
    };
  }
}
```

### 4. Update Environment Files

Add the new variables to all environment files:

```bash
# .env.development
NEW_SERVICE_API_KEY=dev_api_key
NEW_SERVICE_TIMEOUT=5000

# .env.staging
NEW_SERVICE_API_KEY=staging_api_key
NEW_SERVICE_TIMEOUT=10000

# .env.production
NEW_SERVICE_API_KEY=prod_api_key
NEW_SERVICE_TIMEOUT=15000
```

## Support

For issues or questions about the configuration system:

1. Check this documentation
2. Review the validation error messages
3. Check the console logs for detailed error information
4. Verify your environment files match the expected format
