# Testing Strategy & Guide

This document outlines the comprehensive testing strategy for the Hodl.fun Backend NestJS application.

## Architecture Overview

The testing pyramid consists of:
- **Unit Tests** (70%): Domain entities, value objects, services
- **Integration Tests** (20%): Repositories, service adapters, CQRS handlers
- **E2E Tests** (10%): Full API flows, WebSocket interactions

## Test Configuration

### Jest Configuration
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm run test -- token.spec.ts

# Run E2E tests
npm run test:e2e
```

The Jest configuration is in `jest.config.ts` with:
- TypeScript support via ts-jest
- Path aliases (@domain, @infrastructure, etc.)
- Coverage reporting to `coverage/` directory
- Excluded patterns for modules and interfaces

## Unit Tests

### Domain Layer Tests
**Location:** `libs/domain/src/__tests__/`

Test domain entities and value objects with pure business logic tests:

```typescript
// Token Entity Tests
describe('Token Entity', () => {
  describe('create', () => {
    it('should create token with correct initial state');
    it('should initialize price tracking fields');
  });

  describe('updatePrice', () => {
    it('should update current price');
    it('should update ATH when price is higher');
    it('should track update timestamp');
  });

  describe('markAsLocked', () => {
    it('should mark token as locked');
  });

  describe('markAsListed', () => {
    it('should mark token as listed on DEX');
    it('should track listing timestamp');
  });
});
```

**Key Testing Areas:**
- Value object creation and validation
- Entity state transitions
- Business rule enforcement (e.g., ATH price tracking)
- Event generation
- Aggregate composition

### Service Adapter Tests
**Location:** `libs/infrastructure/src/__tests__/services/`

Test external service integrations:

#### BlockchainService Tests
```typescript
describe('BlockchainService', () => {
  describe('initialization', () => {
    it('should initialize with primary and fallback providers');
  });

  describe('getBlockNumber', () => {
    it('should fetch current block number');
    it('should use fallback provider on primary failure');
  });

  describe('getBalance', () => {
    it('should fetch account balance in wei');
  });

  describe('getTransaction', () => {
    it('should fetch transaction by hash');
    it('should validate transaction hash format');
  });

  describe('healthCheck', () => {
    it('should verify blockchain connectivity');
  });
});
```

#### CacheService Tests
```typescript
describe('CacheService', () => {
  describe('get/set', () => {
    it('should cache and retrieve values');
    it('should handle JSON serialization');
  });

  describe('delete', () => {
    it('should remove keys from cache');
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern');
  });

  describe('TTL Management', () => {
    it('should set custom TTL per entity type');
    it('should track remaining TTL');
  });

  describe('Token Cache Operations', () => {
    it('should cache token lists');
    it('should invalidate token caches');
  });

  describe('Portfolio Cache Operations', () => {
    it('should cache user portfolios');
    it('should invalidate portfolio caches');
  });
});
```

#### PriceFeedService Tests
```typescript
describe('PriceFeedService', () => {
  describe('getTokenPrice', () => {
    it('should fetch price from CoinGecko');
    it('should use in-memory cache');
    it('should handle API errors gracefully');
  });

  describe('getTokenData', () => {
    it('should fetch complete token market data');
    it('should calculate 24h price change');
  });

  describe('caching', () => {
    it('should cache prices for 1 minute');
    it('should clear cache on demand');
  });
});
```

### Value Object Tests
```typescript
// TokenAddress Tests
describe('TokenAddress Value Object', () => {
  it('should create valid Ethereum address');
  it('should validate address format');
  it('should normalize to lowercase');
  it('should implement value equality');
});

// Price Value Object Tests
describe('Price Value Object', () => {
  it('should handle big number precision');
  it('should convert to wei string');
  it('should prevent negative prices');
});
```

## Integration Tests

### Repository Tests
**Location:** `libs/infrastructure/src/__tests__/repositories/`

```typescript
describe('TokenRepository', () => {
  describe('findById', () => {
    it('should retrieve token by ID from database');
    it('should map Prisma model to domain entity');
    it('should return undefined if not found');
  });

  describe('findByAddress', () => {
    it('should find token by contract address');
  });

  describe('findAll', () => {
    it('should support pagination');
    it('should support custom sorting');
    it('should return total count');
  });

  describe('findByCreator', () => {
    it('should find all tokens created by user');
  });

  describe('save', () => {
    it('should persist new token to database');
    it('should serialize domain objects correctly');
  });

  describe('update', () => {
    it('should update existing token');
  });

  describe('delete', () => {
    it('should remove token from database');
  });
});

describe('TradeRepository', () => {
  describe('findByTokenId', () => {
    it('should retrieve all trades for token');
  });

  describe('findByUser', () => {
    it('should retrieve all trades by user');
  });

  describe('saveBatch', () => {
    it('should batch insert trades');
  });

  describe('getTokenStats', () => {
    it('should calculate trading statistics');
    it('should handle big number aggregations');
  });
});

describe('PortfolioRepository', () => {
  describe('findByUserId', () => {
    it('should retrieve or create user portfolio');
  });

  describe('update', () => {
    it('should update portfolio holdings');
    it('should serialize holdings to JSON');
  });

  describe('findPortfoliosHoldingToken', () => {
    it('should find all portfolios holding a token');
  });

  describe('findTopByValue', () => {
    it('should find top portfolios by value');
  });
});
```

### CQRS Handler Tests
**Location:** `libs/application/src/__tests__/`

```typescript
describe('CreateTokenCommandHandler', () => {
  it('should create token in database');
  it('should emit TokenCreatedEvent');
  it('should initialize bonding curve reserves');
  it('should validate creator address');
});

describe('GetTokensQueryHandler', () => {
  it('should retrieve tokens with pagination');
  it('should apply filtering');
  it('should sort by specified field');
  it('should use cache when available');
});

describe('PortfolioSyncEventHandler', () => {
  it('should update portfolio on new trade');
  it('should recalculate P&L');
  it('should track cost basis');
});
```

## Controller Tests

### HTTP Controller Tests
**Location:** `libs/presentation/src/__tests__/controllers/`

```typescript
describe('TokenController', () => {
  describe('create', () => {
    it('should validate input DTOs');
    it('should execute CreateTokenCommand');
    it('should return TokenResponseDto');
    it('should handle validation errors');
  });

  describe('getByAddress', () => {
    it('should retrieve token by address');
    it('should throw 404 if not found');
    it('should validate Ethereum address format');
  });

  describe('list', () => {
    it('should return paginated list');
    it('should cap limit to 100');
    it('should support filtering');
    it('should support sorting');
  });

  describe('getTrending', () => {
    it('should return trending tokens');
    it('should support different timeframes');
    it('should support different metrics');
  });
});

describe('TradeController', () => {
  describe('buy', () => {
    it('should execute buy command');
    it('should validate slippage');
    it('should return transaction hash');
  });

  describe('sell', () => {
    it('should execute sell command');
    it('should return transaction hash');
  });

  describe('getByToken', () => {
    it('should retrieve trades for token');
  });

  describe('getByUser', () => {
    it('should retrieve trades for user');
  });

  describe('getStats', () => {
    it('should return trade statistics');
  });
});

describe('PortfolioController', () => {
  describe('getPortfolio', () => {
    it('should retrieve full portfolio');
    it('should include all holdings');
  });

  describe('getPortfolioSummary', () => {
    it('should return portfolio summary');
    it('should calculate top holding');
  });

  describe('getTopPortfolios', () => {
    it('should return leaderboard');
    it('should support metric sorting');
  });
});
```

## E2E Tests

### Token Trading Flow
**Location:** `apps/api/src/__tests__/e2e/`

```typescript
describe('Token Trading E2E', () => {
  describe('Token Creation Flow', () => {
    it('should create new token');
    it('should retrieve token by address');
    it('should list all tokens');
    it('should return proper response format');
  });

  describe('Token Trading Flow', () => {
    it('should execute buy trade');
    it('should execute sell trade');
    it('should retrieve trade history');
    it('should retrieve trade statistics');
  });

  describe('Portfolio Tracking', () => {
    it('should retrieve user portfolio');
    it('should calculate P&L correctly');
    it('should track holdings');
    it('should show leaderboard');
  });

  describe('Error Handling', () => {
    it('should validate input parameters');
    it('should handle invalid addresses');
    it('should return proper error codes');
    it('should include error messages');
  });

  describe('Response Format', () => {
    it('should wrap responses in standard format');
    it('should include success flag');
    it('should include status code');
    it('should include timestamp');
    it('should include data payload');
  });
});
```

## Test Helpers & Factories

Create factory functions for common test setup:

```typescript
// Domain factory helpers
class TokenFactory {
  static create(overrides?: Partial<IToken>): Token
  static createWithId(id: string, overrides?: Partial<IToken>): Token
  static createMultiple(count: number): Token[]
}

class TradeFactory {
  static create(overrides?: Partial<ITrade>): Trade
  static createBuyTrade(...): Trade
  static createSellTrade(...): Trade
}

class PortfolioFactory {
  static create(overrides?: Partial<IPortfolio>): Portfolio
  static createWithHoldings(holdings: any[]): Portfolio
}

// Common test utilities
export function createTestAddress(index: number): EthereumAddress
export function createTestTxHash(index: number): TransactionHash
export function createTestPrice(wei: string): Price
```

## Mocking Strategy

### Database Mocking
```typescript
const mockPrismaService = {
  token: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
```

### Service Mocking
```typescript
const mockBlockchainService = {
  getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
  getBlockNumber: jest.fn().mockResolvedValue(12345),
  getTransaction: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};
```

### CQRS Bus Mocking
```typescript
const mockQueryBus = {
  execute: jest.fn(),
};

const mockCommandBus = {
  execute: jest.fn(),
};
```

## Coverage Targets

- **Overall:** > 80%
- **Domain Layer:** > 90% (critical business logic)
- **Infrastructure:** > 70% (some external services harder to test)
- **Presentation:** > 60% (controllers heavily dependent on CQRS buses)

## Running Tests

```bash
# Unit tests
npm run test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:cov

# Specific test file
npm run test -- token.spec.ts

# E2E tests (when configured)
npm run test:e2e

# All tests before commit
npm run test -- --coverage --bail
```

## CI/CD Integration

Tests run automatically in CI on:
- Pull requests
- Pre-commit hooks (via husky)
- Before deployment

Failing tests block merge/deployment.

## Best Practices

1. **Isolated Tests**: Each test should be independent
2. **Clear Names**: Test names should describe what they test
3. **AAA Pattern**: Arrange, Act, Assert
4. **Minimal Mocking**: Only mock external dependencies
5. **Fast Execution**: Unit tests < 5ms, integration tests < 100ms
6. **Coverage**: Aim for > 80% but don't mock everything
7. **Readable Assertions**: Use `.toBe()` instead of `.toEqual()` when possible
8. **Avoid Test Interdependencies**: Tests should not depend on execution order

## Future Enhancements

- [ ] Setup Cypress for frontend testing
- [ ] Integration with SonarQube for code quality
- [ ] Performance profiling tests
- [ ] Load testing with k6
- [ ] Contract testing with Pact.js
- [ ] Mutation testing with Stryker
- [ ] API documentation from tests (OpenAPI)
