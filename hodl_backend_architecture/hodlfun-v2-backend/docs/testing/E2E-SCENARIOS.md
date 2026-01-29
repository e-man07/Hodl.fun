# E2E Test Scenarios

This document describes the end-to-end test scenarios that verify complete user flows across the Hodl.fun V2 Backend.

## Overview

E2E tests simulate real user interactions and verify that all services work together correctly. They use real PostgreSQL and Redis instances.

## Test Files

| File | Purpose | Tests |
|------|---------|-------|
| `api.e2e-spec.ts` | API endpoint testing | 17 |
| `cross-service.e2e-spec.ts` | Cross-service data flows | 18 |
| `graduation-flow.e2e-spec.ts` | Token graduation lifecycle | 15 |

## Scenario Categories

### 1. Authentication Flow (`api.e2e-spec.ts`)

Tests the complete wallet authentication process:

```
User → Request Nonce → Sign Message → Verify Signature → Get JWT → Access Protected Endpoint
```

**Test Cases:**
- Generate nonce for wallet address
- Verify signature and receive tokens
- Access protected endpoints with JWT
- Refresh expired access tokens
- Reject invalid signatures
- Reject expired tokens

### 2. Token Operations (`api.e2e-spec.ts`)

Tests token CRUD operations via the API:

**Test Cases:**
- List all tokens with pagination
- Get single token by address
- Filter tokens by status (TRADING, LOCKED, LISTED)
- Sort tokens by various fields
- Get token trades with pagination
- Get token holders with pagination
- Get price history (candles)

### 3. User Operations (`api.e2e-spec.ts`)

Tests user-related endpoints:

**Test Cases:**
- Get user profile by wallet address
- Get user portfolio summary
- Get user holdings across tokens
- Get user trade history

### 4. Token Creation Flow (`cross-service.e2e-spec.ts`)

Simulates what happens when the indexer processes a CreateCurve event:

```
Blockchain Event → Indexer Creates Token → Cache Invalidation → API Serves Token
```

**Test Cases:**
- Token appears in API after creation
- Token has correct initial values
- Cache is properly invalidated
- Token appears in listings

### 5. Trade Flow (`cross-service.e2e-spec.ts`)

Simulates buy/sell trade processing:

```
Trade Event → Indexer Creates Trade → Holder Updated → Cache Invalidated → API Reflects Changes
```

**Test Cases:**
- Trade appears in token's trade history
- Holder balance updates on buy
- Holder balance updates on sell
- New holder created on first buy
- Holder removed when balance reaches zero
- Trade affects token price/market cap

### 6. Candle Aggregation Flow (`cross-service.e2e-spec.ts`)

Simulates OHLCV candle generation:

```
Trades Created → Worker Aggregates → Candles Created → API Serves Price History
```

**Test Cases:**
- 1-minute candles generated from trades
- OHLCV values correctly calculated
- Volume aggregated correctly
- Multiple intervals supported (1M, 5M, 15M, 1H, 4H, 1D)

### 7. Portfolio Flow (`cross-service.e2e-spec.ts`)

Simulates user portfolio tracking:

```
User Trades → Holdings Updated → Portfolio Aggregated → API Serves Portfolio
```

**Test Cases:**
- Portfolio reflects all holdings
- Total value calculated correctly
- P&L tracked accurately
- Multi-token portfolios work

### 8. Cache Invalidation Flow (`cross-service.e2e-spec.ts`)

Verifies cache behavior:

```
Data Changed → Cache Invalidated → Next Request Gets Fresh Data
```

**Test Cases:**
- Token cache invalidated on update
- Pattern invalidation works (tokens:*)
- Stale data never served after update

### 9. PubSub Event Flow (`cross-service.e2e-spec.ts`)

Verifies real-time event broadcasting:

```
Event Occurs → PubSub Publishes → Subscribers Receive
```

**Test Cases:**
- Trade events published
- Price update events published
- Token created events published
- Events contain correct data

### 10. Graduation Flow (`graduation-flow.e2e-spec.ts`)

Tests the complete token graduation lifecycle:

```
TRADING → Lock Event → LOCKED → Listing Event → LISTED
```

**Test Cases:**
- Token status changes to LOCKED on lock event
- `graduatedAt` timestamp set
- Token status changes to LISTED on listing event
- `listedAt` timestamp set
- `poolAddress` set on listing
- Cache invalidated at each stage
- PubSub events published

## Running E2E Tests

### Prerequisites

```bash
# Start test database and Redis
docker-compose -f docker-compose.test.yml up -d

# Run migrations
pnpm prisma migrate deploy
```

### Running Tests

```bash
# All E2E tests
pnpm test:e2e

# Specific file
pnpm test:e2e -- --testPathPattern="api.e2e"
pnpm test:e2e -- --testPathPattern="cross-service"
pnpm test:e2e -- --testPathPattern="graduation"

# With verbose output
pnpm test:e2e -- --verbose
```

## Test Setup

### TestAppModule

The E2E tests use a special `TestAppModule` that imports all necessary modules:

```typescript
// test/e2e/test-app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    TokensModule,
    UsersModule,
    HealthModule,
  ],
})
export class TestAppModule {}
```

### Database Cleanup

Each test suite cleans the database before running:

```typescript
async function cleanDatabase() {
  // Clean Redis
  const keys = await redis.keys('*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  // Clean PostgreSQL (order matters for foreign keys)
  await prisma.$executeRaw`TRUNCATE TABLE "price_history" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "trades" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "holders" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "tokens" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "user_portfolios" CASCADE`;
}
```

## Simulation Helpers

### simulateTokenCreation

Mimics the indexer processing a CreateCurve event:

```typescript
async function simulateTokenCreation(mockToken) {
  await prisma.token.create({ data: { ... } });
  await cache.invalidate(`token:${mockToken.address}`);
  await cache.invalidatePattern('tokens:*');
  await pubsub.publish('token_created', { ... });
}
```

### simulateTrade

Mimics the indexer processing a Buy/Sell event:

```typescript
async function simulateTrade(trade) {
  // Create trade record
  await prisma.trade.create({ data: { ... } });

  // Update holder balance
  await prisma.holder.upsert({ ... });

  // Update token reserves/price
  await prisma.token.update({ ... });

  // Invalidate caches
  await cache.invalidate(`token:${trade.tokenAddress}`);

  // Publish event
  await pubsub.publish('trade', { ... });
}
```

### simulateLockEvent

Mimics the indexer processing a Lock (graduation) event:

```typescript
async function simulateLockEvent(tokenAddress) {
  await prisma.token.update({
    where: { address: tokenAddress },
    data: {
      status: 'LOCKED',
      graduatedAt: new Date(),
    },
  });

  await cache.invalidate(`token:${tokenAddress}`);
  await pubsub.publish('graduation', { tokenAddress });
}
```

### simulateListingEvent

Mimics the indexer processing a Listing event:

```typescript
async function simulateListingEvent(tokenAddress, poolAddress, listingBlock) {
  await prisma.token.update({
    where: { address: tokenAddress },
    data: {
      status: 'LISTED',
      poolAddress: poolAddress.toLowerCase(),
      listedAt: new Date(),
      listingBlock,
    },
  });

  await cache.invalidate(`token:${tokenAddress}`);
  await pubsub.publish('listing', { tokenAddress, poolAddress });
}
```

## Debugging E2E Tests

### View Test Output

```bash
# Run with verbose logging
pnpm test:e2e -- --verbose

# Run single test
pnpm test:e2e -- -t "should complete full auth flow"
```

### Database State

```bash
# Connect to test database
psql postgresql://postgres:postgres@localhost:5432/hodlfun_test

# View tokens
SELECT address, status, "graduatedAt" FROM tokens;

# View trades
SELECT "tokenAddress", type, "amountIn" FROM trades;
```

### Redis State

```bash
# Connect to test Redis
redis-cli

# View all keys
KEYS *

# View cached token
GET token:0x...
```

## Best Practices

### DO

- Clean database before each test suite
- Use realistic test data
- Test error cases, not just happy paths
- Verify side effects (cache, events)
- Use descriptive test names

### DON'T

- Don't depend on test execution order
- Don't share state between tests
- Don't skip cleanup in afterAll
- Don't hardcode addresses (use factories)
- Don't test implementation details

## Related Documentation

- [README.md](./README.md) - Testing overview
- [COVERAGE.md](./COVERAGE.md) - Coverage requirements
- [MOCKING.md](./MOCKING.md) - Mock strategies
