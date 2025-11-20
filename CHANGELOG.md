# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-XX

### Added

#### Authentication & Authorization

- Auth0 integration with JWT authentication
- Role-based access control (Owner, Manager, Waiter, Chef)
- Branch-based access control
- API key authentication guard
- Auth0 Management API integration
- Custom JWT payload with organization and branch context

#### Core Features

- **Organizations**: Multi-tenant organization management
- **Branches**: Restaurant location/branch management
- **Users**: User invitation and member management with role assignment
- **Plans**: Subscription plan management
- **Subscriptions**: Paystack integration for subscription management
- **Webhooks**: Paystack webhook event handling

#### Services

- **Email Service**:
  - Resend integration for transactional emails
  - Email queue system with BullMQ
  - Spam prevention utilities
  - Auth0 custom email provider integration
  - Support for verification, password reset, welcome, MFA, and invitation emails
- **SMS Service**: SMS notification service
- **Storage Service**: Cloudinary integration for file uploads
- **Maps Service**: Geocoding and distance calculation
- **Queue Service**: Background job processing with BullMQ and Redis
- **Cache Service**: Redis-based caching with interceptors

#### Infrastructure

- Prisma ORM with PostgreSQL database
- Redis for caching and queue management
- Swagger/OpenAPI documentation
- Comprehensive error handling and validation
- Request logging middleware
- Rate limiting guard
- Health check endpoints
- Monitoring endpoints
- Cursor-based pagination
- Environment-based configuration management
- TypeScript strict mode
- ESLint and Prettier code quality tools
- Husky pre-commit hooks

#### Developer Experience

- Development, staging, and production environment support
- Database migration system
- Seed scripts
- Comprehensive test setup (unit, integration, e2e)
- Type-safe DTOs with class-validator
- Structured logging with Pino

### Security

- Environment variable encryption with dotenvx
- Secure API key management
- CORS configuration
- Input validation and sanitization
- SQL injection prevention via Prisma
- XSS protection in email templates

---

## [Unreleased]

### Added

- Features and changes that are not yet released

### Changed

- Changes to existing functionality

### Deprecated

- Features that will be removed in upcoming releases

### Removed

- Removed features

### Fixed

- Bug fixes

### Security

- Security improvements
