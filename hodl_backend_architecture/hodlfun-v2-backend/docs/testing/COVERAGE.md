# Test Coverage Guide

This document outlines coverage requirements, how to generate reports, and strategies for improving coverage.

## Coverage Targets

| Metric | Minimum | Target | Critical Paths |
|--------|---------|--------|----------------|
| Statements | 60% | 70% | 80% |
| Branches | 50% | 60% | 70% |
| Functions | 60% | 70% | 80% |
| Lines | 60% | 70% | 80% |

## Generating Coverage Reports

### Unit Test Coverage

```bash
# Generate coverage for all unit tests
pnpm test:cov

# Generate coverage for specific service
pnpm --filter api test -- --coverage
pnpm --filter @hodlfun/common test -- --coverage
```

### View Coverage Report

```bash
# Open HTML report in browser
open coverage/lcov-report/index.html

# View summary in terminal
cat coverage/coverage-summary.json | jq '.total'
```

## Critical Files (Highest Coverage Priority)

These files handle critical business logic and require 80%+ coverage:

### Indexer Service
| File | Priority | Target |
|------|----------|--------|
| `event-processor.service.ts` | CRITICAL | 80% |
| `rpc.service.ts` | HIGH | 75% |

### API Service
| File | Priority | Target |
|------|----------|--------|
| `tokens.service.ts` | CRITICAL | 80% |
| `wallet-auth.service.ts` | CRITICAL | 85% |
| `jwt-auth.service.ts` | CRITICAL | 85% |
| `users.service.ts` | HIGH | 75% |

### Shared Libraries
| File | Priority | Target |
|------|----------|--------|
| `libs/common/src/utils/bigint.utils.ts` | CRITICAL | 90% |
| `libs/common/src/validators/address.validator.ts` | CRITICAL | 90% |
| `libs/redis/src/cache.service.ts` | CRITICAL | 80% |
| `libs/redis/src/pubsub.service.ts` | CRITICAL | 80% |

### Worker Service
| File | Priority | Target |
|------|----------|--------|
| `candle.service.ts` | HIGH | 75% |
| `candle.processor.ts` | HIGH | 75% |
| `metrics.processor.ts` | MEDIUM | 70% |

## Coverage by Service

### Current Coverage Summary

| Service | Statements | Branches | Functions | Lines |
|---------|------------|----------|-----------|-------|
| @hodlfun/common | - | - | - | - |
| @hodlfun/database | - | - | - | - |
| @hodlfun/redis | - | - | - | - |
| api | - | - | - | - |
| websocket | - | - | - | - |
| indexer | - | - | - | - |
| worker | - | - | - | - |

*Run `pnpm test:cov` to generate actual coverage numbers.*

## Improving Coverage

### 1. Identify Uncovered Code

```bash
# Generate detailed report
pnpm test:cov

# View uncovered lines in specific file
open coverage/lcov-report/apps/api/src/tokens/tokens.service.ts.html
```

### 2. Common Coverage Gaps

**Error Handling Branches**
```typescript
// Often missed - test error cases
it('should throw NotFoundException when token not found', async () => {
  mockPrisma.token.findUnique.mockResolvedValue(null);
  await expect(service.findByAddress('0x...')).rejects.toThrow(NotFoundException);
});
```

**Edge Cases**
```typescript
// Test boundary conditions
it('should handle empty array', async () => {
  mockPrisma.token.findMany.mockResolvedValue([]);
  const result = await service.findAll({ page: 1, limit: 20 });
  expect(result.data).toHaveLength(0);
});
```

**Async Error Paths**
```typescript
// Test rejection paths
it('should handle database errors', async () => {
  mockPrisma.token.create.mockRejectedValue(new Error('DB Error'));
  await expect(service.create(data)).rejects.toThrow('DB Error');
});
```

### 3. Exclude Non-Critical Code

In `jest.config.js`:

```javascript
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',           // Entry point
    '!src/**/*.module.ts',    // Module definitions
    '!src/**/*.dto.ts',       // DTOs are data classes
    '!src/**/*.d.ts',         // Type definitions
    '!src/**/index.ts',       // Re-exports
  ],
};
```

## Coverage in CI/CD

The GitHub Actions workflow uploads coverage reports as artifacts:

```yaml
- name: Upload coverage
  uses: actions/upload-artifact@v4
  with:
    name: coverage-${{ matrix.service }}
    path: coverage/
```

### Failing on Low Coverage

Add coverage thresholds to `jest.config.js`:

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
    './libs/common/src/utils/': {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
};
```

## Coverage Best Practices

### DO

- Test all public methods
- Test error handling paths
- Test edge cases (empty arrays, null values, boundaries)
- Test async rejection paths
- Focus coverage on business logic

### DON'T

- Don't test private methods directly
- Don't aim for 100% coverage at the expense of test quality
- Don't test framework code (NestJS decorators, etc.)
- Don't test trivial getters/setters
- Don't test third-party library code

## Related Documentation

- [README.md](./README.md) - Testing overview
- [MOCKING.md](./MOCKING.md) - Mock strategies
- [E2E-SCENARIOS.md](./E2E-SCENARIOS.md) - E2E test scenarios
