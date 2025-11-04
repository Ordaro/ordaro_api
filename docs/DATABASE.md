# Database & Prisma Integration Guide

This document outlines the comprehensive Prisma setup for the Ordaro API project, including connection management, best practices, and usage examples.

## Overview

Our database integration provides:

- **Singleton Prisma Client** - Single connection pool across the application
- **Type-safe database operations** - Full TypeScript support
- **Connection monitoring** - Health checks and status monitoring
- **Graceful shutdown** - Proper cleanup on application termination
- **Performance monitoring** - Query timing and logging
- **Transaction support** - Simplified transaction handling

## Architecture

### Prisma Service (`src/database/prisma.service.ts`)

- Extends `PrismaClient` for full functionality
- Implements NestJS lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`)
- Provides singleton pattern through NestJS DI container
- Includes connection management and health monitoring

### Prisma Module (`src/database/prisma.module.ts`)

- Global module for application-wide access
- Proper provider configuration for singleton behavior
- Exports PrismaService for dependency injection

### Health Module (`src/health/`)

- Database connection monitoring endpoints
- Real-time status reporting
- Performance metrics

## Key Features

### ✅ **Singleton Pattern Implementation**

```typescript
// NestJS handles singleton behavior through DI container
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useClass: PrismaService,
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### ✅ **Connection Management**

- Automatic connection on module initialization
- Lazy connection with explicit `$connect()` call
- Proper disconnection on module destruction
- Connection status tracking

### ✅ **Health Monitoring**

```typescript
// Check database health
const health = await prismaService.healthCheck();

// Get connection status
const status = await prismaService.getConnectionStatus();
```

### ✅ **Performance Monitoring**

- Query timing middleware (development only)
- Structured logging with different levels
- Performance metrics collection

### ✅ **Graceful Shutdown**

- Handles SIGINT, SIGTERM, SIGQUIT signals
- Proper cleanup on uncaught exceptions
- Database disconnection before process exit

### ✅ **Transaction Support**

```typescript
// Simple transaction usage
const result = await prismaService.executeTransaction(async (prisma) => {
  const user = await prisma.user.create({ data: userData });
  const profile = await prisma.profile.create({
    data: { ...profileData, userId: user.id },
  });
  return { user, profile };
});
```

## Configuration

### Environment Variables

```bash
# Database connection
DATABASE_URL="postgresql://user:password@localhost:5432/ordaro"
DATABASE_HOST="localhost"
DATABASE_PORT="5432"
DATABASE_NAME="ordaro"
DATABASE_USER="user"
DATABASE_PASSWORD="password"
```

### Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Connection Pool Settings

- Connection timeout: 30 seconds
- Query timeout: 60 seconds
- Pool size: Automatically configured based on CPU cores

## Usage Examples

### Basic Operations

```typescript
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(data: CreateUserDto) {
    return await this.prisma.user.create({
      data,
      include: {
        profile: true,
      },
    });
  }

  async findUsers() {
    return await this.prisma.user.findMany({
      where: {
        deletedAt: null, // Soft delete support
      },
    });
  }
}
```

### Transaction Example

```typescript
async transferFunds(fromUserId: string, toUserId: string, amount: number) {
  return await this.prisma.executeTransaction(async (prisma) => {
    // Debit from source account
    await prisma.account.update({
      where: { userId: fromUserId },
      data: { balance: { decrement: amount } },
    });

    // Credit to destination account
    await prisma.account.update({
      where: { userId: toUserId },
      data: { balance: { increment: amount } },
    });

    // Create transaction record
    return await prisma.transaction.create({
      data: {
        fromUserId,
        toUserId,
        amount,
        type: 'TRANSFER',
      },
    });
  });
}
```

### Health Check Usage

```typescript
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('database')
  async checkDatabase() {
    const health = await this.prisma.healthCheck();
    const status = await this.prisma.getConnectionStatus();

    return {
      database: health,
      connection: status,
      timestamp: new Date().toISOString(),
    };
  }
}
```

## Available Scripts

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Create and apply migrations
npm run db:migrate

# Deploy migrations (production)
npm run db:migrate:deploy

# Reset database
npm run db:migrate:reset

# Seed database
npm run db:seed

# Open Prisma Studio
npm run db:studio

# Format schema file
npm run db:format

# Validate schema
npm run db:validate
```

## Health Endpoints

### GET `/health`

Returns overall application health including database status.

### GET `/health/database`

Returns detailed database health information.

### GET `/health/connection`

Returns database connection status and configuration.

## Best Practices

### ✅ **Do's**

- Use the injected PrismaService throughout your application
- Leverage TypeScript types generated by Prisma
- Use transactions for multi-step operations
- Monitor database health in production
- Use proper error handling with try-catch blocks

### ❌ **Don'ts**

- Don't create multiple PrismaClient instances
- Don't forget to handle connection errors
- Don't use raw SQL queries unless absolutely necessary
- Don't ignore transaction rollbacks
- Don't skip database migrations in production

## Monitoring & Debugging

### Query Logging

- Enabled in development environment
- Includes query text, parameters, and execution time
- Structured logging with different levels

### Performance Monitoring

- Query timing middleware
- Connection pool metrics
- Health check endpoints

### Error Handling

- Comprehensive error logging
- Graceful degradation on connection issues
- Proper cleanup on application shutdown

## Migration Strategy

### Development

```bash
# Create new migration
npm run db:migrate

# Apply pending migrations
npm run db:migrate:deploy
```

### Production

```bash
# Deploy migrations
npm run db:migrate:deploy

# Verify deployment
npm run db:validate
```

## Troubleshooting

### Common Issues

#### Connection Timeout

```bash
# Check database connectivity
npm run health:database

# Verify environment variables
npm run env:decrypt:prod
```

#### Migration Errors

```bash
# Reset database (development only)
npm run db:migrate:reset

# Check migration status
npx prisma migrate status
```

#### Type Generation Issues

```bash
# Regenerate Prisma client
npm run db:generate

# Clear node_modules and reinstall
rm -rf node_modules generated
npm install
```

## Security Considerations

- Database credentials are encrypted using dotenvx
- Connection strings use environment variables
- Prepared statements prevent SQL injection
- Connection pooling limits resource usage
- Graceful shutdown prevents data corruption

## Performance Optimization

- Connection pooling configured for optimal performance
- Query timing monitoring in development
- Efficient transaction handling
- Proper indexing in database schema
- Health monitoring for proactive issue detection

---

**Remember**: The Prisma service is globally available throughout your NestJS application. Use dependency injection to access it in your services and controllers! 🚀
