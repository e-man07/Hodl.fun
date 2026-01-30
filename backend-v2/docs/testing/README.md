# Hodl.fun V2 Backend - Testing Guide

This document provides an overview of the testing strategy, structure, and commands for the Hodl.fun V2 Backend.

## Overview

The testing suite consists of three levels:

| Level | Purpose | Database | Redis | Count |
|-------|---------|----------|-------|-------|
| **Unit Tests** | Test individual components in isolation | Mocked | Mocked | 511 |
| **Integration Tests** | Test component interactions with real services | Real | Real | 124 |
| **E2E Tests** | Test complete user flows across services | Real | Real | 67 |

**Total: 702 tests**

## Quick Start

```bash
# Run all unit tests
pnpm test

# Run all integration tests (requires Docker)
pnpm test:integration

# Run all E2E tests (requires Docker)
pnpm test:e2e

# Run tests for a specific service
pnpm --filter api test
pnpm --filter indexer test
pnpm --filter worker test
pnpm --filter websocket test

# Run tests with coverage
pnpm test:cov
```

## Test Structure

```
hodlfun-v2-backend/
├── test/
│   ├── mocks/                    # Shared mock factories
│   │   ├── factories/
│   │   │   ├── token.factory.ts
│   │   │   ├── trade.factory.ts
│   │   │   └── holder.factory.ts
│   │   ├── prisma.mock.ts
│   │   ├── redis.mock.ts
│   │   └── ethers.mock.ts
│   ├── integration/              # Cross-library integration tests
│   │   ├── database.integration.spec.ts
│   │   └── redis.integration.spec.ts
│   └── e2e/                      # End-to-end tests
│       ├── api.e2e-spec.ts
│       ├── cross-service.e2e-spec.ts
│       └── graduation-flow.e2e-spec.ts
├── libs/
│   ├── common/src/__tests__/unit/    # 152 tests
│   ├── database/src/__tests__/unit/  # 15 tests
│   └── redis/src/__tests__/unit/     # 58 tests
└── apps/
    ├── api/src/__tests__/
    │   ├── unit/                     # 116 tests
    │   └── integration/              # 3 files
    ├── websocket/src/__tests__/
    │   ├── unit/                     # 81 tests
    │   └── integration/              # 1 file
    ├── indexer/src/__tests__/
    │   ├── unit/                     # 35 tests
    │   └── integration/              # 1 file
    └── worker/src/__tests__/
        ├── unit/                     # 54 tests
        └── integration/              # 1 file
```

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Unit Tests | `*.spec.ts` | `tokens.service.spec.ts` |
| Integration Tests | `*.integration.spec.ts` | `auth.integration.spec.ts` |
| E2E Tests | `*.e2e-spec.ts` | `api.e2e-spec.ts` |

## Running Tests

### Unit Tests

Unit tests run in isolation with all dependencies mocked:

```bash
# All unit tests (via Turborepo)
pnpm test

# Specific service
pnpm --filter api test
pnpm --filter @hodlfun/common test

# Watch mode
pnpm --filter api test -- --watch

# Single test file
pnpm --filter api test -- tokens.service.spec.ts
```

### Integration Tests

Integration tests require PostgreSQL and Redis:

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Run migrations
pnpm prisma migrate deploy

# Run integration tests
pnpm test:integration

# Stop services
docker-compose -f docker-compose.test.yml down
```

### E2E Tests

E2E tests simulate complete user flows:

```bash
# Ensure services are running
docker-compose -f docker-compose.test.yml up -d

# Run E2E tests
pnpm test:e2e

# Run specific E2E test file
pnpm test:e2e -- --testPathPattern="graduation"
```

## Test Coverage

Generate coverage reports:

```bash
# Unit test coverage
pnpm test:cov

# View coverage report
open coverage/lcov-report/index.html
```

### Coverage Targets

| Category | Target | Current |
|----------|--------|---------|
| Statements | 70% | - |
| Branches | 60% | - |
| Functions | 70% | - |
| Lines | 70% | - |

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

See `.github/workflows/test.yml` for the complete workflow.

### Pipeline Stages

1. **Unit Tests** - Run in parallel for each service
2. **Integration Tests** - Run after unit tests pass
3. **E2E Tests** - Run after integration tests pass
4. **Coverage Report** - Aggregate and report coverage

## Writing Tests

### Unit Test Example

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TokensService } from './tokens.service';
import { createMockPrismaService, createMockCacheService } from '../../../test/mocks';

describe('TokensService', () => {
  let service: TokensService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: createMockCacheService() },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
  });

  it('should find token by address', async () => {
    const mockToken = createMockToken();
    mockPrisma.token.findUnique.mockResolvedValue(mockToken);

    const result = await service.findByAddress(mockToken.address);

    expect(result).toEqual(mockToken);
  });
});
```

### Integration Test Example

```typescript
describe('Auth Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should complete full auth flow', async () => {
    // Get nonce
    const nonceResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/nonce')
      .send({ walletAddress: testWallet.address });

    // Sign and verify
    const signature = await testWallet.signMessage(nonceResponse.body.data.nonce);
    const verifyResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/verify')
      .send({ walletAddress: testWallet.address, signature });

    expect(verifyResponse.body.data.accessToken).toBeDefined();
  });
});
```

## Troubleshooting

### Jest doesn't exit after tests

Add `--forceExit` flag or check for open handles:

```bash
pnpm test:integration -- --detectOpenHandles
```

### Database connection errors

Ensure PostgreSQL is running and `DATABASE_URL` is set:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hodlfun_test"
```

### Redis connection errors

Ensure Redis is running and `REDIS_URL` is set:

```bash
export REDIS_URL="redis://localhost:6379"
```

## Related Documentation

- [COVERAGE.md](./COVERAGE.md) - Coverage requirements and reporting
- [MOCKING.md](./MOCKING.md) - Mock strategies and factories
- [E2E-SCENARIOS.md](./E2E-SCENARIOS.md) - E2E test scenarios
