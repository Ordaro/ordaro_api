# Ordaro API

A NestJS-based REST API for order management with secure configuration using dotenvx encryption.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
npm run start:dev

# Start staging server
npm run start:staging

# Start production server
npm run start:prod
```

## Configuration

Environment variables are encrypted using [dotenvx](https://dotenvx.com) for security.

- **Development**: Uses `.env.development`
- **Staging**: Uses `.env.staging`
- **Production**: Uses `.env.production`

See [Configuration Guide](./docs/CONFIGURATION.md) for detailed setup.

## Encryption

```bash
# Encrypt environment files
npm run env:encrypt:dev
npm run env:encrypt:staging
npm run env:encrypt:prod
```

## Quality Assurance

```bash
# Run all QA checks
npm run qa

# Run QA checks with auto-fix
npm run qa:fix

# Individual checks
npm run type-check    # TypeScript checking
npm run lint         # ESLint checking
npm run format:check # Code formatting
npm run test:cov     # Tests with coverage
```
