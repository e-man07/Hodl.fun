# Mocking Strategies

This document describes the mocking patterns and factories used throughout the test suite.

## Overview

The test suite uses a consistent mocking strategy:

1. **Mock Factories** - Reusable functions that create mock instances
2. **Data Factories** - Functions that generate realistic test data
3. **Jest Mocks** - Direct mocking of modules and functions

## Mock Factories Location

All shared mocks are located in `test/mocks/`:

```
test/mocks/
├── index.ts              # Re-exports all mocks
├── prisma.mock.ts        # Prisma client mocks
├── redis.mock.ts         # Redis service mocks
├── ethers.mock.ts        # Ethers.js mocks
└── factories/
    ├── index.ts          # Re-exports all factories
    ├── token.factory.ts  # Token data factory
    ├── trade.factory.ts  # Trade data factory
    └── holder.factory.ts # Holder data factory
```

## Service Mocks

### PrismaService Mock

```typescript
// test/mocks/prisma.mock.ts
export const createMockPrismaService = () => ({
  token: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  trade: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  holder: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  priceHistory: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  userPortfolio: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  indexerState: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  creatorFee: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn((fn) => fn()),
  $executeRaw: jest.fn(),
});
```

### CacheService Mock

```typescript
// test/mocks/redis.mock.ts
export const createMockCacheService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  getOrSet: jest.fn().mockImplementation(async (key, ttl, fn) => fn()),
  invalidate: jest.fn(),
  invalidatePattern: jest.fn(),
});
```

### PubSubService Mock

```typescript
export const createMockPubSubService = () => ({
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
});
```

### RedisService Mock

```typescript
export const createMockRedisService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn().mockResolvedValue([]),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn().mockResolvedValue([]),
  scard: jest.fn().mockResolvedValue(0),
  expire: jest.fn(),
  ttl: jest.fn(),
});
```

### MetricsService Mock

```typescript
export const createMockMetricsService = () => ({
  httpRequestDuration: { observe: jest.fn() },
  httpRequestTotal: { inc: jest.fn() },
  activeWebsocketConnections: { inc: jest.fn(), dec: jest.fn(), set: jest.fn() },
  eventBroadcastTotal: { inc: jest.fn() },
  indexerBlockLag: { set: jest.fn() },
  indexerEventsProcessed: { inc: jest.fn() },
  tokensCreatedTotal: { inc: jest.fn() },
  tradesTotal: { inc: jest.fn() },
  tradingVolume: { inc: jest.fn() },
  cacheHitTotal: { inc: jest.fn() },
  cacheMissTotal: { inc: jest.fn() },
});
```

## Data Factories

### Token Factory

```typescript
// test/mocks/factories/token.factory.ts
import { faker } from '@faker-js/faker';

let tokenCounter = 0;

export const resetTokenCounter = () => {
  tokenCounter = 0;
};

export type TokenStatus = 'TRADING' | 'LOCKED' | 'LISTED';

export interface MockToken {
  id: string;
  address: string;
  name: string;
  symbol: string;
  // ... all token fields
}

export const createMockToken = (overrides: Partial<MockToken> = {}): MockToken => {
  tokenCounter++;
  const address = `0x${tokenCounter.toString().padStart(40, '0')}`;

  return {
    id: faker.string.uuid(),
    address,
    name: `Test Token ${tokenCounter}`,
    symbol: `TT${tokenCounter}`,
    tokenUri: `https://example.com/token/${tokenCounter}`,
    creatorAddress: `0x${'1'.repeat(40)}`,
    curveAddress: `0x${'2'.repeat(38)}${tokenCounter.toString().padStart(2, '0')}`,
    status: 'TRADING' as TokenStatus,
    currentPrice: '1000000000000000',
    marketCap: '1000000000000000000000',
    virtualNative: '1000000000000000000',
    virtualToken: '50000000000000000000000000',
    realNative: '0',
    realToken: '0',
    k: '50000000000000000000000000000000000000000000',
    athPrice: '1000000000000000',
    athMarketCap: '1000000000000000000000',
    createdAt: new Date(),
    createdBlock: BigInt(12345678),
    graduatedAt: null,
    listedAt: null,
    poolAddress: null,
    listingBlock: null,
    updatedAt: new Date(),
    ...overrides,
  };
};
```

### Trade Factory

```typescript
// test/mocks/factories/trade.factory.ts
export type TradeType = 'BUY' | 'SELL';

export interface MockTrade {
  id: string;
  tokenAddress: string;
  type: TradeType;
  traderAddress: string;
  amountIn: string;
  amountOut: string;
  price: string;
  feeAmount: string;
  txHash: string;
  blockNumber: bigint;
  timestamp: Date;
}

let tradeCounter = 0;

export const createMockBuyTrade = (overrides: Partial<MockTrade> = {}): MockTrade => {
  tradeCounter++;
  return {
    id: faker.string.uuid(),
    tokenAddress: `0x${'0'.repeat(40)}`,
    type: 'BUY',
    traderAddress: `0x${'3'.repeat(40)}`,
    amountIn: '1000000000000000000',      // 1 ETH
    amountOut: '1000000000000000000000',  // 1000 tokens
    price: '1000000000000000',
    feeAmount: '10000000000000000',       // 0.01 ETH
    txHash: `0x${tradeCounter.toString().padStart(64, '0')}`,
    blockNumber: BigInt(12345678 + tradeCounter),
    timestamp: new Date(),
    ...overrides,
  };
};

export const createMockSellTrade = (overrides: Partial<MockTrade> = {}): MockTrade => {
  tradeCounter++;
  return {
    id: faker.string.uuid(),
    tokenAddress: `0x${'0'.repeat(40)}`,
    type: 'SELL',
    traderAddress: `0x${'3'.repeat(40)}`,
    amountIn: '1000000000000000000000',   // 1000 tokens
    amountOut: '900000000000000000',      // 0.9 ETH
    price: '900000000000000',
    feeAmount: '9000000000000000',
    txHash: `0x${tradeCounter.toString().padStart(64, '0')}`,
    blockNumber: BigInt(12345678 + tradeCounter),
    timestamp: new Date(),
    ...overrides,
  };
};
```

### Holder Factory

```typescript
// test/mocks/factories/holder.factory.ts
export interface MockHolder {
  id: string;
  tokenAddress: string;
  holderAddress: string;
  balance: string;
  firstBuyTimestamp: Date;
  lastActivityTimestamp: Date;
}

export const createMockHolder = (overrides: Partial<MockHolder> = {}): MockHolder => ({
  id: faker.string.uuid(),
  tokenAddress: `0x${'0'.repeat(40)}`,
  holderAddress: `0x${'4'.repeat(40)}`,
  balance: '1000000000000000000000',
  firstBuyTimestamp: new Date(),
  lastActivityTimestamp: new Date(),
  ...overrides,
});
```

## Usage in Tests

### Basic Mock Usage

```typescript
import { createMockPrismaService, createMockCacheService } from '../../../test/mocks';
import { createMockToken } from '../../../test/mocks/factories';

describe('TokensService', () => {
  let service: TokensService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();

    const module = await Test.createTestingModule({
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
    expect(mockPrisma.token.findUnique).toHaveBeenCalledWith({
      where: { address: mockToken.address },
    });
  });
});
```

### Mocking with Custom Data

```typescript
it('should handle graduated token', async () => {
  const graduatedToken = createMockToken({
    status: 'LISTED',
    graduatedAt: new Date(),
    listedAt: new Date(),
    poolAddress: '0x' + 'a'.repeat(40),
  });

  mockPrisma.token.findUnique.mockResolvedValue(graduatedToken);

  const result = await service.findByAddress(graduatedToken.address);

  expect(result.status).toBe('LISTED');
  expect(result.poolAddress).toBeDefined();
});
```

### Mocking Error Cases

```typescript
it('should throw when token not found', async () => {
  mockPrisma.token.findUnique.mockResolvedValue(null);

  await expect(service.findByAddress('0x...')).rejects.toThrow(NotFoundException);
});

it('should handle database errors', async () => {
  mockPrisma.token.findUnique.mockRejectedValue(new Error('Connection failed'));

  await expect(service.findByAddress('0x...')).rejects.toThrow('Connection failed');
});
```

### Resetting Mocks

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  resetTokenCounter(); // Reset factory counters
});
```

## Module Mocking

### Mocking ethers.js

```typescript
// At the top of test file
jest.mock('ethers', () => ({
  ethers: {
    Interface: jest.fn().mockImplementation(() => ({
      parseLog: jest.fn(),
      getEvent: jest.fn(),
    })),
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBlockNumber: jest.fn(),
      getLogs: jest.fn(),
    })),
    Wallet: {
      createRandom: jest.fn().mockReturnValue({
        address: '0x' + '1'.repeat(40),
        signMessage: jest.fn(),
      }),
    },
    verifyMessage: jest.fn(),
  },
}));
```

### Mocking ConfigService

```typescript
const createMockConfigService = () => ({
  get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1h',
      REDIS_URL: 'redis://localhost:6379',
    };
    return config[key] ?? defaultValue;
  }),
});
```

## Best Practices

### DO

- Use factory functions for consistent test data
- Reset mocks and counters in `beforeEach`
- Mock at the service boundary, not internal methods
- Use `mockResolvedValue` for async mocks
- Verify mock calls with `toHaveBeenCalledWith`

### DON'T

- Don't mock too many layers deep
- Don't share mock state between tests
- Don't mock what you don't control
- Don't forget to mock all dependencies
- Don't use real services in unit tests

## Related Documentation

- [README.md](./README.md) - Testing overview
- [COVERAGE.md](./COVERAGE.md) - Coverage requirements
- [E2E-SCENARIOS.md](./E2E-SCENARIOS.md) - E2E test scenarios
