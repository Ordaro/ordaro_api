# API Versioning Guide

## Current Setup

Your API is currently on **v1** and uses URL-based versioning through the `API_PREFIX` environment variable.

### Current Configuration

- **Environment Variable**: `API_PREFIX=/api/v1`
- **Global Prefix**: Applied to all routes via `app.setGlobalPrefix(apiPrefix)` in `main.ts`
- **Swagger Version**: `1.0.0` (documentation version, separate from API version)
- **Package Version**: `0.0.1` (application version)

### Current Route Structure

All routes are prefixed with `/api/v1`:

- `GET /api/v1/organizations`
- `POST /api/v1/emails/auth0`
- `GET /api/v1/subscriptions`
- etc.

## Version Control Strategy

### 1. **URL-Based Versioning (Current Approach)**

**Pros:**

- Clear and explicit in the URL
- Easy to understand and test
- Allows multiple versions to coexist

**Cons:**

- Requires updating all routes when creating new version
- Can lead to code duplication if not managed well

### 2. **Recommended Structure for Multiple Versions**

When you need to create v2, organize your code like this:

```
src/
├── v1/
│   ├── controllers/
│   │   ├── organizations.controller.ts
│   │   └── subscriptions.controller.ts
│   ├── dto/
│   └── services/
├── v2/
│   ├── controllers/
│   ├── dto/
│   └── services/
└── common/
    └── services/ (shared across versions)
```

### 3. **Version Management Best Practices**

#### Environment Variables

```bash
# .env.development
API_PREFIX=/api/v1

# .env.production
API_PREFIX=/api/v1
```

#### Version Constants

Create a version constants file:

```typescript
// src/common/constants/api-version.constants.ts
export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2',
} as const;

export const CURRENT_API_VERSION = API_VERSIONS.V1;
```

#### Controller Versioning

For future v2 controllers, use NestJS versioning:

```typescript
// src/v2/controllers/organizations.controller.ts
import { Controller, Version } from '@nestjs/common';

@Controller('organizations')
@Version('2')
export class OrganizationsV2Controller {
  // v2-specific implementation
}
```

Then in `main.ts`:

```typescript
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

## Version Release Strategy

### When to Create a New Version

Create a new API version (v2) when:

1. **Breaking Changes**: Changes that break existing client integrations
   - Removing required fields
   - Changing field types
   - Removing endpoints
   - Changing authentication methods

2. **Major Feature Additions**: Significant new functionality that changes the API structure

3. **Deprecation Timeline**: When you need to deprecate v1 with a clear timeline

### Version Lifecycle

```
v1 (Current) → v2 (New) → v3 (Future)
     ↓              ↓
  Maintain      Active
  (6-12 months)  (Primary)
```

### Deprecation Policy

1. **Announcement**: Notify users 6 months before deprecation
2. **Documentation**: Mark deprecated endpoints in Swagger
3. **Headers**: Add `Deprecation: true` header to v1 responses
4. **Sunset Date**: Set clear end-of-life date
5. **Migration Guide**: Provide detailed migration documentation

## Implementation Steps for v2

### Step 1: Update Main.ts

```typescript
import { VersioningType } from '@nestjs/common';

// Enable versioning
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
  prefix: 'v',
});

// Keep global prefix for /api
app.setGlobalPrefix('api');
```

### Step 2: Organize Controllers

```typescript
// v1 controllers keep working with @Version('1') or default
@Controller('organizations')
export class OrganizationsController {}

// v2 controllers explicitly versioned
@Controller('organizations')
@Version('2')
export class OrganizationsV2Controller {}
```

### Step 3: Update Swagger

```typescript
const swaggerConfig = new DocumentBuilder()
  .setTitle('Ordaro POS API')
  .setVersion('2.0.0') // Update when v2 is primary
  .addServer('/api/v1', 'Version 1 (Deprecated)')
  .addServer('/api/v2', 'Version 2 (Current)')
  .build();
```

### Step 4: Environment Configuration

```typescript
// src/config/configuration.ts
api: {
  prefix: process.env['API_PREFIX'], // /api
  defaultVersion: process.env['API_DEFAULT_VERSION'] || '1',
  supportedVersions: ['1', '2'],
}
```

## Version Tracking

### Package.json Versioning

- **Semantic Versioning**: `MAJOR.MINOR.PATCH`
- **API Version**: Separate from package version
- **Example**: Package `1.2.3` can serve API `v1` or `v2`

### Changelog

Maintain `CHANGELOG.md`:

```markdown
# Changelog

## [2.0.0] - 2024-XX-XX

### Added

- New organizations endpoint with enhanced filtering
- Batch operations support

### Changed

- Breaking: `GET /organizations` now requires pagination

### Deprecated

- v1 endpoints will be removed on 2025-XX-XX

## [1.0.0] - 2024-XX-XX

### Initial Release
```

## Testing Multiple Versions

### Version-Specific Tests

```typescript
// test/v1/organizations.e2e-spec.ts
describe('Organizations API v1', () => {
  it('GET /api/v1/organizations', () => {
    // v1 tests
  });
});

// test/v2/organizations.e2e-spec.ts
describe('Organizations API v2', () => {
  it('GET /api/v2/organizations', () => {
    // v2 tests
  });
});
```

## Monitoring and Analytics

Track version usage:

```typescript
// Middleware to log API version usage
@Injectable()
export class VersionTrackingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const version = req.url.match(/\/v(\d+)/)?.[1] || '1';
    // Log to analytics
    logger.info({ version, path: req.path }, 'API version accessed');
    next();
  }
}
```

## Migration Checklist

When creating v2:

- [ ] Update `main.ts` with versioning configuration
- [ ] Create `src/v2/` directory structure
- [ ] Copy and modify controllers for v2
- [ ] Update DTOs for v2 changes
- [ ] Add version-specific tests
- [ ] Update Swagger documentation
- [ ] Create migration guide
- [ ] Update environment variables
- [ ] Add deprecation headers to v1
- [ ] Announce v2 release
- [ ] Monitor v1 usage
- [ ] Set v1 sunset date

## Current Status

✅ **You are on v1** - All routes are under `/api/v1`
✅ **Versioning is configured** - Via `API_PREFIX` environment variable
✅ **Swagger is set up** - Version `1.0.0` documented
⚠️ **No versioning module** - Consider implementing NestJS versioning for future v2

## Recommendations

1. **Stay on v1** until you have breaking changes
2. **Use feature flags** for new features instead of new versions when possible
3. **Document all changes** in CHANGELOG.md
4. **Monitor API usage** to understand impact of version changes
5. **Plan deprecation** before creating v2

## Quick Reference

```bash
# Current API endpoints
GET  /api/v1/organizations
POST /api/v1/emails/auth0
GET  /api/v1/subscriptions

# Future v2 endpoints (when needed)
GET  /api/v2/organizations
POST /api/v2/emails/auth0
GET  /api/v2/subscriptions
```

## Resources

- [NestJS Versioning Documentation](https://docs.nestjs.com/techniques/versioning)
- [REST API Versioning Best Practices](https://restfulapi.net/versioning/)
- [Semantic Versioning](https://semver.org/)
