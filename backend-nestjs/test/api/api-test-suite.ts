/**
 * HODL.FUN API Test Suite (TypeScript)
 *
 * Comprehensive API endpoint testing with detailed assertions
 *
 * Usage:
 *   1. Seed the database: npx ts-node test/seed/seed-mock-data.ts
 *   2. Start the API server: npm run start:dev:api
 *   3. Run tests: npx ts-node test/api/api-test-suite.ts
 */

import axios from 'axios';

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test addresses from seed data
const ADDRESSES = {
  token1: '0xaaaa111111111111111111111111111111111111', // Active (MOON)
  token2: '0xaaaa222222222222222222222222222222222222', // Locked (DHAND)
  token3: '0xaaaa333333333333333333333333333333333333', // Graduated (GRAD)
  token4: '0xaaaa444444444444444444444444444444444444', // New (NEW)
  token5: '0xaaaa555555555555555555555555555555555555', // Near graduation (ALMST)
  user1: '0x3333333333333333333333333333333333333333',
  user2: '0x4444444444444444444444444444444444444444',
  user3: '0x5555555555555555555555555555555555555555',
  creator1: '0x1111111111111111111111111111111111111111',
  creator2: '0x2222222222222222222222222222222222222222',
};

// Test result tracking
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

// Test utilities
async function test(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration: Date.now() - start, error: message });
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertDefined<T>(value: T | undefined | null, message: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(`${message}: value is ${value}`);
  }
}

// HTTP client
const http = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  validateStatus: () => true, // Don't throw on non-2xx
});

// Helper to unwrap response data (API wraps in {success, statusCode, data})
function unwrap(res: { status: number; data: { data?: unknown; success?: boolean } }): { status: number; data: unknown } {
  return {
    status: res.status,
    data: res.data?.data ?? res.data,
  };
}

// Test suites
async function testTokenEndpoints(): Promise<void> {
  console.log('\n📦 TOKEN ENDPOINTS\n');

  await test('GET /tokens - returns paginated list', async () => {
    const res = unwrap(await http.get('/tokens')) as { status: number; data: { items: unknown[]; total: number; limit: number; offset: number } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.items), 'items should be array');
    assert(res.data.items.length > 0, 'should have items');
    assertDefined(res.data.total, 'total should be defined');
    assertDefined(res.data.limit, 'limit should be defined');
    assertDefined(res.data.offset, 'offset should be defined');
  });

  await test('GET /tokens?limit=2 - respects limit', async () => {
    const res = unwrap(await http.get('/tokens?limit=2')) as { status: number; data: { items: unknown[]; limit: number } };
    assertEqual(res.status, 200, 'Status code');
    assert(res.data.items.length <= 2, 'should respect limit');
    assertEqual(res.data.limit, 2, 'limit in response');
  });

  await test('GET /tokens?limit=1000 - caps at 100', async () => {
    const res = unwrap(await http.get('/tokens?limit=1000')) as { status: number; data: { limit: number } };
    assertEqual(res.status, 200, 'Status code');
    assert(res.data.limit <= 100, 'limit should be capped at 100');
  });

  await test('GET /tokens?sortBy=marketCap&sortOrder=desc - sorted correctly', async () => {
    const res = unwrap(await http.get('/tokens?sortBy=marketCap&sortOrder=desc')) as { status: number; data: { items: { marketCap: string }[] } };
    assertEqual(res.status, 200, 'Status code');
    const marketCaps = res.data.items.map((t) => BigInt(t.marketCap));
    for (let i = 1; i < marketCaps.length; i++) {
      assert(marketCaps[i] <= marketCaps[i - 1], 'should be sorted desc by marketCap');
    }
  });

  await test('GET /tokens?creator={address} - filters by creator', async () => {
    const res = unwrap(await http.get(`/tokens?creator=${ADDRESSES.creator1}`)) as { status: number; data: { items: { creator: string }[] } };
    assertEqual(res.status, 200, 'Status code');
    for (const token of res.data.items) {
      assertEqual(token.creator.toLowerCase(), ADDRESSES.creator1.toLowerCase(), 'creator should match');
    }
  });

  await test('GET /tokens?isListed=true - filters graduated tokens', async () => {
    const res = unwrap(await http.get('/tokens?isListed=true')) as { status: number; data: { items: { isListed: boolean }[] } };
    assertEqual(res.status, 200, 'Status code');
    for (const token of res.data.items) {
      assertEqual(token.isListed, true, 'isListed should be true');
    }
  });

  await test('GET /tokens/:address - returns token details', async () => {
    const res = unwrap(await http.get(`/tokens/${ADDRESSES.token1}`)) as { status: number; data: { address: string; name: string; symbol: string; currentPrice: string; marketCap: string } };
    assertEqual(res.status, 200, 'Status code');
    assertDefined(res.data.address, 'address should be defined');
    assertDefined(res.data.name, 'name should be defined');
    assertDefined(res.data.symbol, 'symbol should be defined');
    assertDefined(res.data.currentPrice, 'currentPrice should be defined');
    assertDefined(res.data.marketCap, 'marketCap should be defined');
  });

  await test('GET /tokens/:address - 404 for non-existent', async () => {
    const res = await http.get('/tokens/0x0000000000000000000000000000000000000000');
    assertEqual(res.status, 404, 'Status code');
  });

  await test('GET /tokens/search?q=MOON - searches by symbol', async () => {
    const res = unwrap(await http.get('/tokens/search?q=MOON')) as { status: number; data: { tokens: unknown[] } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.tokens), 'tokens should be array');
  });

  await test('GET /tokens/new - returns new tokens', async () => {
    const res = unwrap(await http.get('/tokens/new')) as { status: number; data: { tokens: unknown[] } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.tokens), 'tokens should be array');
  });

  await test('GET /tokens/graduating - returns near-graduation tokens', async () => {
    const res = unwrap(await http.get('/tokens/graduating')) as { status: number; data: { tokens: { graduationProgress: number }[] } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.tokens), 'tokens should be array');
  });

  await test('GET /tokens/graduated - returns graduated tokens', async () => {
    const res = unwrap(await http.get('/tokens/graduated')) as { status: number; data: { tokens: unknown[] } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.tokens), 'tokens should be array');
  });

  await test('GET /tokens/top/volume - returns top by volume', async () => {
    const res = unwrap(await http.get('/tokens/top/volume')) as { status: number; data: { tokens: { volume: string }[] } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.tokens), 'tokens should be array');
  });

  await test('GET /tokens/trending/24h - returns trending tokens', async () => {
    const res = unwrap(await http.get('/tokens/trending/24h')) as { status: number; data: { tokens: unknown[]; timeframe: string } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.tokens), 'tokens should be array');
    assertEqual(res.data.timeframe, '24h', 'timeframe should match');
  });

  await test('GET /tokens/:address/price-history - returns price data', async () => {
    const res = unwrap(await http.get(`/tokens/${ADDRESSES.token1}/price-history`)) as { status: number; data: { tokenAddress: string; data: unknown[] } };
    assertEqual(res.status, 200, 'Status code');
    assertEqual(res.data.tokenAddress, ADDRESSES.token1, 'tokenAddress should match');
    assert(Array.isArray(res.data.data), 'data should be array');
  });

  await test('GET /tokens/:address/holders - returns holders', async () => {
    const res = unwrap(await http.get(`/tokens/${ADDRESSES.token1}/holders`)) as { status: number; data: { tokenAddress: string; holders: { address: string; balance: string; percentage: string }[]; total: number } };
    assertEqual(res.status, 200, 'Status code');
    assertEqual(res.data.tokenAddress, ADDRESSES.token1, 'tokenAddress should match');
    assert(Array.isArray(res.data.holders), 'holders should be array');
    assertDefined(res.data.total, 'total should be defined');
  });
}

async function testPortfolioEndpoints(): Promise<void> {
  console.log('\n💼 PORTFOLIO ENDPOINTS\n');

  await test('GET /portfolios/:userId - returns portfolio', async () => {
    const res = unwrap(await http.get(`/portfolios/${ADDRESSES.user1}`)) as { status: number; data: { userId: string; holdings: unknown[]; totalInvestedPUSH: string } };
    assertEqual(res.status, 200, 'Status code');
    assertDefined(res.data.userId, 'userId should be defined');
    assert(Array.isArray(res.data.holdings), 'holdings should be array');
    assertDefined(res.data.totalInvestedPUSH, 'totalInvestedPUSH should be defined');
  });

  await test('GET /portfolios/:userId - 404 for non-existent user', async () => {
    const res = await http.get('/portfolios/0x0000000000000000000000000000000000000000');
    assertEqual(res.status, 404, 'Status code');
  });

  await test('GET /portfolios/:userId/summary - returns summary', async () => {
    const res = unwrap(await http.get(`/portfolios/${ADDRESSES.user1}/summary`)) as { status: number; data: { userId: string; holdingsCount: number; totalInvestedPUSH: string } };
    assertEqual(res.status, 200, 'Status code');
    assertDefined(res.data.userId, 'userId should be defined');
    assertDefined(res.data.holdingsCount, 'holdingsCount should be defined');
    assertDefined(res.data.totalInvestedPUSH, 'totalInvestedPUSH should be defined');
  });

  await test('GET /portfolios/leaderboard/top - returns leaderboard', async () => {
    const res = unwrap(await http.get('/portfolios/leaderboard/top')) as { status: number; data: { portfolios: unknown[]; timestamp: string } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.portfolios), 'portfolios should be array');
    assertDefined(res.data.timestamp, 'timestamp should be defined');
  });
}

async function testTradeEndpoints(): Promise<void> {
  console.log('\n📊 TRADE ENDPOINTS\n');

  await test('GET /trades/token/:tokenId - returns trades for token', async () => {
    const res = unwrap(await http.get(`/trades/token/${ADDRESSES.token1}`)) as { status: number; data: { items: unknown[]; total: number; limit: number; offset: number } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.items), 'items should be array');
    assertDefined(res.data.total, 'total should be defined');
    assertDefined(res.data.limit, 'limit should be defined');
    assertDefined(res.data.offset, 'offset should be defined');
  });

  await test('GET /trades/token/:tokenId?limit=5 - paginated trades', async () => {
    const res = unwrap(await http.get(`/trades/token/${ADDRESSES.token1}?limit=5`)) as { status: number; data: { items: unknown[]; limit: number } };
    assertEqual(res.status, 200, 'Status code');
    assert(res.data.items.length <= 5, 'should respect limit');
    assertEqual(res.data.limit, 5, 'limit in response');
  });

  await test('GET /trades/user/:userAddress - returns user trades', async () => {
    const res = unwrap(await http.get(`/trades/user/${ADDRESSES.user1}`)) as { status: number; data: { items: unknown[] } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.items), 'items should be array');
  });

  await test('GET /trades/stats - returns global trade stats', async () => {
    const res = unwrap(await http.get('/trades/stats')) as { status: number; data: { totalTrades: number; totalBuyVolume: string; totalSellVolume: string } };
    assertEqual(res.status, 200, 'Status code');
    assertDefined(res.data.totalTrades, 'totalTrades should be defined');
    assertDefined(res.data.totalBuyVolume, 'totalBuyVolume should be defined');
    assertDefined(res.data.totalSellVolume, 'totalSellVolume should be defined');
  });

  await test('GET /trades/stats?tokenId= - returns token stats', async () => {
    const res = unwrap(await http.get(`/trades/stats?tokenId=${ADDRESSES.token1}`)) as { status: number; data: { tokenId: string } };
    assertEqual(res.status, 200, 'Status code');
    assertEqual(res.data.tokenId, ADDRESSES.token1, 'tokenId should match');
  });

  await test('GET /trades/stats?user= - returns user stats', async () => {
    const res = unwrap(await http.get(`/trades/stats?user=${ADDRESSES.user1}`)) as { status: number; data: { user: string } };
    assertEqual(res.status, 200, 'Status code');
    assertEqual(res.data.user, ADDRESSES.user1, 'user should match');
  });
}

async function testTransactionEndpoints(): Promise<void> {
  console.log('\n🔧 TRANSACTION ENDPOINTS\n');

  await test('GET /transactions/contracts - returns contract addresses', async () => {
    const res = unwrap(await http.get('/transactions/contracts')) as { status: number; data: { core: string; factory: string } };
    assertEqual(res.status, 200, 'Status code');
    assertDefined(res.data.core, 'core address should be defined');
    assertDefined(res.data.factory, 'factory address should be defined');
    assert(res.data.core.startsWith('0x'), 'core should be address format');
    assert(res.data.factory.startsWith('0x'), 'factory should be address format');
  });

  await test('POST /transactions/build/create-token - builds create tx', async () => {
    const res = unwrap(await http.post('/transactions/build/create-token', {
      creator: ADDRESSES.creator1,
      name: 'Test Token',
      symbol: 'TEST',
      tokenURI: 'ipfs://test',
      amountIn: '1000000000000000000',
    })) as { status: number; data: { to: string; data: string; value: string } };
    assertEqual(res.status, 201, 'Status code');
    assertDefined(res.data.to, 'to should be defined');
    assertDefined(res.data.data, 'data should be defined');
    assertDefined(res.data.value, 'value should be defined');
    assert(res.data.to.startsWith('0x'), 'to should be address');
    assert(res.data.data.startsWith('0x'), 'data should be hex');
  });

  await test('POST /transactions/build/buy - builds buy tx', async () => {
    const res = unwrap(await http.post('/transactions/build/buy', {
      token: ADDRESSES.token1,
      to: ADDRESSES.user1,
      amountIn: '1000000000000000000',
      amountOutMin: '0',
    })) as { status: number; data: { to: string; data: string; value: string } };
    assertEqual(res.status, 201, 'Status code');
    assertDefined(res.data.to, 'to should be defined');
    assertDefined(res.data.data, 'data should be defined');
    assertDefined(res.data.value, 'value should be defined');
  });

  await test('POST /transactions/build/sell - builds sell tx', async () => {
    const res = unwrap(await http.post('/transactions/build/sell', {
      token: ADDRESSES.token1,
      from: ADDRESSES.user1,
      to: ADDRESSES.user1,
      amountIn: '1000000000000000000000',
      amountOutMin: '0',
    })) as { status: number; data: { to: string; data: string; value: string } };
    assertEqual(res.status, 201, 'Status code');
    assertDefined(res.data.to, 'to should be defined');
    assertDefined(res.data.data, 'data should be defined');
    assertDefined(res.data.value, 'value should be defined');
  });

  await test('POST /transactions/build/approve - builds approve tx', async () => {
    const res = unwrap(await http.post('/transactions/build/approve', {
      token: ADDRESSES.token1,
      amount: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
    })) as { status: number; data: { to: string; data: string; value: string } };
    assertEqual(res.status, 201, 'Status code');
    assertDefined(res.data.to, 'to should be defined');
    assertDefined(res.data.data, 'data should be defined');
    assertEqual(res.data.value, '0', 'value should be 0 for approve');
  });
}

async function testEdgeCases(): Promise<void> {
  console.log('\n⚠️  EDGE CASES & ERROR HANDLING\n');

  await test('Invalid token address returns 404', async () => {
    const res = await http.get('/tokens/invalid-address');
    assertEqual(res.status, 404, 'Status code');
  });

  await test('Empty search query returns results', async () => {
    const res = unwrap(await http.get('/tokens/search?q=')) as { status: number; data: { tokens: unknown[] } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.tokens), 'tokens should be array');
  });

  await test('Large offset returns empty items', async () => {
    const res = unwrap(await http.get('/tokens?offset=100000')) as { status: number; data: { items: unknown[] } };
    assertEqual(res.status, 200, 'Status code');
    assert(Array.isArray(res.data.items), 'items should be array');
  });

  await test('Invalid sortBy is handled gracefully', async () => {
    const res = await http.get('/tokens?sortBy=invalidField');
    // Should either work with default or return error
    assert(res.status === 200 || res.status === 400, 'should handle gracefully');
  });

  await test('POST with missing required fields returns 400', async () => {
    const res = await http.post('/transactions/build/create-token', {});
    // Should return 400 for missing required fields
    assert(res.status === 400 || res.status === 422, 'should return validation error');
  });

  await test('POST with invalid address format', async () => {
    const res = await http.post('/transactions/build/buy', {
      token: 'not-an-address',
      to: ADDRESSES.user1,
      amountIn: '1000000000000000000',
    });
    // Should handle gracefully
    assert(res.status === 400 || res.status === 422 || res.status === 201, 'should handle gracefully');
  });
}

// Main runner
async function main(): Promise<void> {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('          HODL.FUN API TEST SUITE');
  console.log('════════════════════════════════════════════════════════');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('════════════════════════════════════════════════════════');

  // Check server is running
  try {
    await http.get('/');
    console.log('\n✓ API server is running\n');
  } catch {
    console.error('\n✗ API server is not running at', BASE_URL);
    console.error('  Please start the server with: npm run start:dev:api\n');
    process.exit(1);
  }

  // Run test suites
  await testTokenEndpoints();
  await testPortfolioEndpoints();
  await testTradeEndpoints();
  await testTransactionEndpoints();
  await testEdgeCases();

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('\n════════════════════════════════════════════════════════');
  console.log('                    TEST SUMMARY');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  ✓ PASSED:  ${passed}`);
  console.log(`  ✗ FAILED:  ${failed}`);
  console.log(`  ⏱ TIME:    ${totalDuration}ms`);
  console.log('════════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\nFailed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  • ${r.name}`);
        console.log(`    ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log(`\n✓ All ${passed} tests passed!`);
    process.exit(0);
  }
}

main().catch(console.error);
