# Ordaro API Improvement Plan
## Based on Coziza API Patterns & Best Practices

**Date:** 2025-01-XX  
**Status:** Planning Phase  
**Framework:** NestJS (keeping existing framework)  
**Database:** Prisma (keeping existing ORM)

---

## Executive Summary

This document outlines improvements for `ordaro-api` based on architectural patterns, best practices, and service abstractions observed in `coziza_api`. The goal is to enhance code quality, maintainability, scalability, and developer experience while maintaining the existing NestJS/Prisma stack.

---

## 1. Architecture & Code Organization

### 1.1 Module Structure Enhancement
**Current State:** Basic NestJS module structure  
**Target State:** More granular, feature-focused modules with clear separation of concerns

#### Improvements:
- [ ] **Add Serializer Layer** (like coziza's `*.serializer.ts`)
  - Create DTO serializers for transforming database models to API responses
  - Benefits: Clean separation, consistent response format, easier to test
  - Pattern: `src/modules/{module}/{module}.serializer.ts`
  
- [ ] **Standardize Module File Structure**
  ```
  modules/
    orders/
      - orders.controller.ts
      - orders.service.ts
      - orders.dto.ts          (Request/Response DTOs)
      - orders.serializer.ts   (DB → DTO transformation)
      - orders.schema.ts       (Validation schemas - optional if using class-validator)
      - orders.module.ts
      - dto/
        - create-order.dto.ts
        - update-order.dto.ts
      - index.ts               (Barrel exports)
  ```

- [ ] **Add Barrel Exports** (`index.ts` files)
  - Simplify imports: `import { OrdersService } from './orders'`
  - Better tree-shaking and cleaner imports

### 1.2 Service Layer Patterns

**Current State:** Services directly use Prisma  
**Target State:** Service layer with better abstraction

#### Improvements:
- [ ] **Add Repository Pattern** (optional but recommended for complex queries)
  - Create `orders.repository.ts` for complex database operations
  - Keep services focused on business logic
  - Example: `OrderRepository.findWithRelations()`

- [ ] **Extract Query Builders**
  - Move complex Prisma queries to helper functions
  - Reusable query fragments
  - Better testability

---

## 2. Infrastructure Services

### 2.1 Caching Service (Redis/Valkey)
**Priority:** HIGH  
**Current State:** Not implemented  
**Target State:** Redis caching layer for frequently accessed data

#### Implementation:
- [ ] Create `src/services/cache/redis.service.ts`
  - Singleton pattern (like coziza)
  - Connection management with graceful shutdown
  - Health check integration
  
- [ ] Add caching decorators/interceptors:
  ```typescript
  @Cacheable('user', 300) // Cache for 5 minutes
  async getUser(id: string) { ... }
  ```

- [ ] Cache strategies:
  - User sessions
  - Organization data
  - Menu items
  - Frequently accessed branch data

### 2.2 Queue System (BullMQ)
**Priority:** MEDIUM  
**Current State:** Not implemented  
**Target State:** Background job processing for async operations

#### Implementation:
- [ ] Create `src/services/queue/bull-mq.service.ts`
  - Singleton service managing queues
  - Worker initialization
  - Job type enums
  
- [ ] Use cases for Ordaro:
  - Order processing (WhatsApp orders)
  - Email notifications (order confirmations)
  - SMS notifications (delivery updates)
  - Analytics aggregation
  - Inventory sync across branches

- [ ] Job types enum:
  ```typescript
  enum ORDARO_JOB_TYPES {
    PROCESS_WHATSAPP_ORDER = 'PROCESS_WHATSAPP_ORDER',
    SEND_ORDER_NOTIFICATION = 'SEND_ORDER_NOTIFICATION',
    SYNC_INVENTORY = 'SYNC_INVENTORY',
    AGGREGATE_ANALYTICS = 'AGGREGATE_ANALYTICS',
  }
  ```

### 2.3 File Storage Service (S3)
**Priority:** HIGH  
**Current State:** Not implemented  
**Target State:** S3 integration for file uploads

#### Implementation:
- [ ] Create `src/services/s3/s3.service.ts`
  - Presigned URL generation for uploads
  - File deletion
  - File metadata management
  
- [ ] Use cases:
  - Menu item images
  - User profile pictures
  - Organization logos
  - Receipt/Invoice PDFs

### 2.4 External Service Integrations

#### SMS Service
- [ ] Create `src/services/sms/sms.service.ts`
  - Support multiple providers (Twilio, Mnotify, Nalo)
  - Abstract interface for easy provider switching
  - Use for: OTP, order notifications, delivery updates

#### Email Service
- [ ] Create `src/services/email/email.service.ts`
  - Template-based emails
  - Queue integration for async sending
  - Use for: Invitations, order confirmations, reports

#### Maps Service
- [ ] Create `src/services/maps/maps.service.ts`
  - Geocoding (address → coordinates)
  - Reverse geocoding
  - Distance calculation
  - Use for: Branch locations, delivery addresses

#### Search Service (Algolia/Elasticsearch)
- [ ] Create `src/services/search/search.service.ts`
  - Menu item search
  - Customer search
  - Order history search
  - Index management

---

## 3. Pagination Improvements

### 3.1 Enhanced Keyset Pagination
**Current State:** Basic cursor pagination  
**Target State:** Advanced keyset pagination with field-specific sorting

#### Improvements:
- [ ] **Upgrade PaginationService**
  - Support multiple sort fields (like coziza's `ListingOrderByField`)
  - Field-specific cursor encoding
  - Better performance with indexed queries
  
- [ ] **Add Sort Configuration**
  ```typescript
  // orders.sort.ts
  export type OrderOrderByField = 
    | 'created_at'
    | 'updated_at'
    | 'total_amount'
    | 'status';
    
  export const OrderSortableFields: OrderOrderByField[] = [
    'created_at',
    'updated_at',
    'total_amount',
    'status',
  ];
  ```

- [ ] **Enhance Pagination DTO**
  - Add `orderBy` field selector
  - Add `orderDir` ('asc' | 'desc')
  - Validate sortable fields

- [ ] **Query Optimization**
  - Use Prisma's `orderBy` with compound indexes
  - Leverage database indexes for cursor queries
  - Implement `hasMore` detection (fetch limit+1)

### 3.2 Pagination Response Enhancement
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
    totalCount?: number; // Optional, expensive for large datasets
  };
}
```

---

## 4. Error Handling & Validation

### 4.1 Error Formatting
**Current State:** NestJS default exceptions  
**Target State:** Consistent error format with better context

#### Improvements:
- [ ] Create `src/common/utils/format-errors.util.ts`
  - Standardize error messages
  - Include request context (user, organization, branch)
  - Log errors with structured data

- [ ] **Global Exception Filter Enhancement**
  - Format validation errors consistently
  - Include error codes for frontend handling
  - Hide sensitive information in production

### 4.2 Validation Improvements
**Current State:** class-validator  
**Target State:** Enhanced validation with better error messages

#### Improvements:
- [ ] **Custom Validation Decorators**
  - Phone number validation (Ghana format)
  - Currency validation
  - Branch-specific validation
  
- [ ] **Validation Transformers**
  - Auto-transform input types
  - Sanitize user input
  - Normalize data formats

- [ ] **Schema Validation for Complex Objects**
  - Consider Zod for complex nested validation
  - Or enhance class-validator with custom validators

---

## 5. Logging & Observability

### 5.1 Structured Logging
**Current State:** NestJS Logger  
**Target State:** Pino-based structured logging

#### Improvements:
- [ ] **Replace with Pino**
  - Better performance (faster than Winston)
  - Structured JSON logs
  - Pretty printing in development
  
- [ ] **Create Logger Module**
  ```typescript
  // src/common/services/logger.service.ts
  export const logger = pino({
    level: isDev ? 'debug' : 'info',
    transport: isDev ? { target: 'pino-pretty' } : undefined,
  });
  ```

- [ ] **Add Request Logging Middleware**
  - Log request/response with correlation IDs
  - Include user context
  - Performance metrics

### 5.2 Distributed Tracing
**Priority:** MEDIUM  
**Current State:** Not implemented  
**Target State:** Request tracing across services

#### Implementation:
- [ ] Add `dd-trace` or OpenTelemetry
  - Track request flow
  - Database query tracing
  - External API call tracing
  - Performance bottleneck identification

---

## 6. Configuration Management

### 6.1 Environment Configuration
**Current State:** Basic config service  
**Target State:** Typed, validated environment configuration

#### Improvements:
- [ ] **Create `src/utils/env.ts`**
  - Centralized environment variable access
  - Type-safe environment variables
  - Default values
  - Validation on startup

- [ ] **Enhance ConfigService**
  - Type-safe getters
  - Nested configuration objects
  - Environment-specific defaults

### 6.2 Feature Flags
**Priority:** LOW  
**Current State:** Not implemented  
**Target State:** Growthbook or custom feature flags

#### Implementation:
- [ ] Integrate Growthbook (like coziza)
  - A/B testing
  - Gradual feature rollouts
  - Environment-specific features

---

## 7. Testing Infrastructure

### 7.1 Test Organization
**Current State:** Basic Jest setup  
**Target State:** Comprehensive testing structure

#### Improvements:
- [ ] **Unit Tests**
  - Service layer tests
  - Repository tests
  - Utility function tests
  
- [ ] **Integration Tests**
  - API endpoint tests
  - Database integration tests
  - External service mocks

- [ ] **E2E Tests**
  - Critical user flows
  - Order processing
  - Payment flows

### 7.2 Test Utilities
- [ ] **Test Database Setup**
  - In-memory database for tests
  - Test data factories
  - Cleanup utilities

- [ ] **Mock Services**
  - Auth0 mock
  - Payment gateway mocks
  - External API mocks

---

## 8. API Documentation

### 8.1 Swagger Enhancements
**Current State:** Basic Swagger setup  
**Target State:** Comprehensive API documentation

#### Improvements:
- [ ] **Enhanced Swagger Configuration**
  - Better descriptions
  - Example requests/responses
  - Error response documentation
  - Authentication flow documentation

- [ ] **Response DTOs**
  - Document all response types
  - Include pagination metadata
  - Error response schemas

### 8.2 API Versioning
- [ ] **Version Strategy**
  - URL versioning: `/api/v1/orders`
  - Header versioning: `Accept: application/vnd.ordaro.v1+json`
  - Document breaking changes

---

## 9. Performance Optimizations

### 9.1 Database Query Optimization
- [ ] **Query Analysis**
  - Use Prisma query logging
  - Identify N+1 queries
  - Add database indexes
  
- [ ] **Connection Pooling**
  - Configure Prisma connection pool
  - Monitor connection usage
  - Set appropriate pool size

### 9.2 Response Optimization
- [ ] **Response Compression**
  - Enable gzip compression
  - Compress large JSON responses
  
- [ ] **Field Selection**
  - Allow clients to select fields
  - GraphQL-like field selection
  - Reduce payload size

### 9.3 Caching Strategy
- [ ] **API Response Caching**
  - Cache frequently accessed endpoints
  - Invalidate on updates
  - Cache headers for static data

---

## 10. Security Enhancements

### 10.1 Rate Limiting
- [ ] **Implement Rate Limiting**
  - Per-user rate limits
  - Per-organization rate limits
  - DDoS protection

### 10.2 Input Sanitization
- [ ] **Sanitize User Input**
  - XSS prevention
  - SQL injection prevention (Prisma handles this)
  - File upload validation

### 10.3 Audit Logging
- [ ] **Audit Trail**
  - Log all data modifications
  - Track who made changes
  - Compliance requirements

---

## 11. Development Experience

### 11.1 Development Tools
- [ ] **Husky Pre-commit Hooks**
  - Lint-staged (already configured)
  - Type checking
  - Test running

- [ ] **ESLint Configuration**
  - Import sorting
  - Unused imports removal
  - Consistent code style

### 11.2 Scripts Enhancement
- [ ] **Database Scripts**
  - Seed scripts for development
  - Migration helpers
  - Database reset utilities

- [ ] **Development Workflow**
  - Hot reload improvements
  - Debug configuration
  - Environment switching

---

## 12. Migration Priority

### Phase 1: Foundation (High Priority)
1. ✅ Caching Service (Redis)
2. ✅ S3 File Storage
3. ✅ Enhanced Pagination
4. ✅ Structured Logging (Pino)
5. ✅ Error Formatting Utilities

### Phase 2: Infrastructure (Medium Priority)
6. Queue System (BullMQ)
7. SMS/Email Services
8. Maps Service
9. Environment Configuration Enhancement
10. Testing Infrastructure

### Phase 3: Advanced Features (Low Priority)
11. Search Service (Algolia)
12. Feature Flags (Growthbook)
13. Distributed Tracing
14. API Versioning
15. Advanced Caching Strategies

---

## 13. Code Examples

### Example: Enhanced Service with Caching
```typescript
// orders.service.ts
@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private cache: CacheService,
  ) {}

  @Cacheable('order', 300) // Cache for 5 minutes
  async findOne(id: string, organizationId: string) {
    return this.prisma.order.findFirst({
      where: { id, organizationId },
      include: { items: true, customer: true },
    });
  }
}
```

### Example: Queue Service Usage
```typescript
// orders.service.ts
async processWhatsAppOrder(orderData: WhatsAppOrderData) {
  // Create order in database
  const order = await this.create(orderData);
  
  // Queue background job
  await this.queueService.addJob(
    ORDARO_JOB_TYPES.PROCESS_WHATSAPP_ORDER,
    { orderId: order.id },
    { priority: 1 }
  );
  
  return order;
}
```

### Example: Enhanced Pagination
```typescript
// orders.controller.ts
@Get()
async findAll(
  @Query() pagination: PaginationQueryDto,
  @CurrentUser() user: UserPayload,
) {
  return this.ordersService.findAll(
    user.organizationId,
    {
      limit: pagination.limit,
      cursor: pagination.cursor,
      orderBy: pagination.orderBy || 'created_at',
      orderDir: pagination.orderDir || 'desc',
    }
  );
}
```

---

## 14. Dependencies to Add

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.901.0",
    "@aws-sdk/s3-request-presigner": "^3.901.0",
    "bullmq": "^5.61.0",
    "ioredis": "^5.8.1",
    "pino": "^10.0.0",
    "pino-pretty": "^13.1.1",
    "algoliasearch": "^5.40.0",
    "twilio": "^5.0.0",
    "dd-trace": "^5.70.0"
  },
  "devDependencies": {
    "@types/ioredis": "^5.0.0",
    "@types/bullmq": "^5.0.0"
  }
}
```

---

## 15. Success Metrics

### Code Quality
- [ ] Test coverage > 80%
- [ ] All services have unit tests
- [ ] Integration tests for critical flows
- [ ] Zero critical security vulnerabilities

### Performance
- [ ] API response times < 200ms (95th percentile)
- [ ] Database query optimization
- [ ] Cache hit rate > 70% for frequently accessed data

### Developer Experience
- [ ] Clear module structure
- [ ] Comprehensive documentation
- [ ] Easy onboarding for new developers
- [ ] Consistent code style

---

## Notes

- Keep existing NestJS/Prisma stack (no framework migration)
- Maintain backward compatibility during migration
- Implement incrementally (one service at a time)
- Test thoroughly before production deployment
- Document all new services and patterns

---

## Next Steps

1. Review and prioritize this plan
2. Create detailed implementation tickets
3. Set up development branches
4. Begin Phase 1 implementation
5. Regular code reviews and progress updates

