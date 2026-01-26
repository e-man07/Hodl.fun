/**
 * Holder Test Data Factory
 * Creates mock Holder entities for testing
 */
import { TEST_ADDRESSES } from '../ethers.mock';

// Holder interface matching Prisma model
export interface MockHolder {
  id: string;
  tokenAddress: string;
  holderAddress: string;
  balance: string;
  firstBuyTimestamp: Date;
  lastActivityTimestamp: Date;
}

let holderCounter = 0;

/**
 * Generate a unique holder address
 */
function generateHolderAddress(): string {
  holderCounter++;
  const hex = holderCounter.toString(16).padStart(40, '0');
  return `0x${hex}`;
}

/**
 * Create a mock holder with optional overrides
 */
export function createMockHolder(overrides: Partial<MockHolder> = {}): MockHolder {
  const now = new Date();
  const firstBuy = new Date(now.getTime() - 86400000); // 1 day ago

  return {
    id: overrides.id || `holder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tokenAddress: overrides.tokenAddress || TEST_ADDRESSES.token,
    holderAddress: overrides.holderAddress || generateHolderAddress(),
    balance: overrides.balance || '1000000000000000000000', // 1000 tokens
    firstBuyTimestamp: overrides.firstBuyTimestamp || firstBuy,
    lastActivityTimestamp: overrides.lastActivityTimestamp || now,
    ...overrides,
  };
}

/**
 * Create multiple mock holders for a token
 */
export function createMockHolders(
  count: number,
  tokenAddress = TEST_ADDRESSES.token,
  options: { varyBalance?: boolean } = {},
): MockHolder[] {
  const baseBalance = BigInt('1000000000000000000000'); // 1000 tokens
  const now = new Date();

  return Array.from({ length: count }, (_, i) => {
    const balance = options.varyBalance
      ? (baseBalance * BigInt(count - i)).toString() // Decreasing balances
      : baseBalance.toString();

    const firstBuy = new Date(now.getTime() - (count - i) * 3600000); // Staggered first buys

    return createMockHolder({
      tokenAddress,
      balance,
      firstBuyTimestamp: firstBuy,
      lastActivityTimestamp: now,
    });
  });
}

/**
 * Create a whale holder (large balance)
 */
export function createWhaleHolder(overrides: Partial<MockHolder> = {}): MockHolder {
  return createMockHolder({
    balance: '10000000000000000000000000', // 10M tokens
    ...overrides,
  });
}

/**
 * Create a small holder
 */
export function createSmallHolder(overrides: Partial<MockHolder> = {}): MockHolder {
  return createMockHolder({
    balance: '100000000000000000', // 0.1 tokens
    ...overrides,
  });
}

/**
 * Create a holder with zero balance (sold all)
 */
export function createZeroBalanceHolder(overrides: Partial<MockHolder> = {}): MockHolder {
  return createMockHolder({
    balance: '0',
    ...overrides,
  });
}

/**
 * Create the creator as a holder (usually has most tokens initially)
 */
export function createCreatorAsHolder(
  tokenAddress = TEST_ADDRESSES.token,
  creatorAddress = TEST_ADDRESSES.user1,
  overrides: Partial<MockHolder> = {},
): MockHolder {
  return createMockHolder({
    tokenAddress,
    holderAddress: creatorAddress,
    balance: '100000000000000000000000000', // 100M tokens
    ...overrides,
  });
}

/**
 * Create a holder distribution (for testing leaderboards)
 * Returns holders with varying balances in descending order
 */
export function createHolderDistribution(
  tokenAddress = TEST_ADDRESSES.token,
  count = 10,
): MockHolder[] {
  const now = new Date();

  return Array.from({ length: count }, (_, i) => {
    // Exponentially decreasing balances (whale at top, small holders at bottom)
    const exponent = count - i;
    const balance = (BigInt(10) ** BigInt(18 + exponent)).toString();

    return createMockHolder({
      tokenAddress,
      balance,
      firstBuyTimestamp: new Date(now.getTime() - i * 3600000),
    });
  });
}

/**
 * Reset the holder counter (useful between tests)
 */
export function resetHolderCounter(): void {
  holderCounter = 0;
}

// Additional factory types

// UserPortfolio interface
export interface MockUserPortfolio {
  id: string;
  walletAddress: string;
  totalInvested: string;
  totalReturned: string;
  totalTrades: number;
  updatedAt: Date;
}

/**
 * Create a mock user portfolio
 */
export function createMockUserPortfolio(overrides: Partial<MockUserPortfolio> = {}): MockUserPortfolio {
  const now = new Date();

  return {
    id: overrides.id || `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    walletAddress: overrides.walletAddress || generateHolderAddress(),
    totalInvested: overrides.totalInvested || '10000000000000000000', // 10 PUSH
    totalReturned: overrides.totalReturned || '12000000000000000000', // 12 PUSH (20% profit)
    totalTrades: overrides.totalTrades || 5,
    updatedAt: overrides.updatedAt || now,
  };
}

/**
 * Create a profitable portfolio
 */
export function createProfitablePortfolio(overrides: Partial<MockUserPortfolio> = {}): MockUserPortfolio {
  return createMockUserPortfolio({
    totalInvested: '100000000000000000000', // 100 PUSH
    totalReturned: '150000000000000000000', // 150 PUSH (50% profit)
    totalTrades: 20,
    ...overrides,
  });
}

/**
 * Create a losing portfolio
 */
export function createLosingPortfolio(overrides: Partial<MockUserPortfolio> = {}): MockUserPortfolio {
  return createMockUserPortfolio({
    totalInvested: '100000000000000000000', // 100 PUSH
    totalReturned: '50000000000000000000', // 50 PUSH (50% loss)
    totalTrades: 15,
    ...overrides,
  });
}

// PriceHistory interface
export interface MockPriceHistory {
  id: string;
  tokenAddress: string;
  timestamp: Date;
  interval: 'ONE_MINUTE' | 'FIVE_MINUTES' | 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'FOUR_HOURS' | 'ONE_DAY';
  open: string;
  high: string;
  low: string;
  close: string;
  volumeNative: string;
  volumeToken: string;
  tradeCount: number;
}

/**
 * Create a mock price history candle
 */
export function createMockPriceHistory(overrides: Partial<MockPriceHistory> = {}): MockPriceHistory {
  const basePrice = BigInt('20000000000000'); // 0.00002 PUSH

  return {
    id: overrides.id || `candle-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tokenAddress: overrides.tokenAddress || TEST_ADDRESSES.token,
    timestamp: overrides.timestamp || new Date(),
    interval: overrides.interval || 'ONE_MINUTE',
    open: overrides.open || basePrice.toString(),
    high: overrides.high || (basePrice * BigInt(105) / BigInt(100)).toString(), // +5%
    low: overrides.low || (basePrice * BigInt(95) / BigInt(100)).toString(), // -5%
    close: overrides.close || (basePrice * BigInt(102) / BigInt(100)).toString(), // +2%
    volumeNative: overrides.volumeNative || '5000000000000000000', // 5 PUSH
    volumeToken: overrides.volumeToken || '250000000000000000000000', // 250k tokens
    tradeCount: overrides.tradeCount || 10,
  };
}

/**
 * Create a series of price history candles
 */
export function createMockPriceHistorySeries(
  tokenAddress: string,
  count: number,
  interval: MockPriceHistory['interval'] = 'ONE_MINUTE',
  intervalMs = 60000,
): MockPriceHistory[] {
  const baseTime = new Date();
  const basePrice = 20000000000000; // 0.00002 PUSH

  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(baseTime.getTime() - i * intervalMs);

    // Create a simple upward trend with volatility
    const trend = 1 + i * 0.01; // 1% increase per candle
    const volatility = 0.05; // 5% volatility

    const open = Math.floor(basePrice * trend * (1 - volatility));
    const close = Math.floor(basePrice * trend * (1 + volatility));
    const high = Math.max(open, close) * 1.02;
    const low = Math.min(open, close) * 0.98;

    return createMockPriceHistory({
      tokenAddress,
      timestamp,
      interval,
      open: open.toString(),
      high: Math.floor(high).toString(),
      low: Math.floor(low).toString(),
      close: close.toString(),
    });
  });
}
