/**
 * Holder, UserPortfolio, and PriceHistory Test Data Factories
 * Creates mock entities for testing
 */
import { TEST_ADDRESSES } from '../ethers.mock';

// PriceInterval enum mirroring Prisma schema
export type PriceInterval = 'ONE_MINUTE' | 'FIVE_MINUTES' | 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'FOUR_HOURS' | 'ONE_DAY';

/**
 * Holder interface matching Prisma model
 */
export interface MockHolder {
  id: string;
  tokenAddress: string;
  holderAddress: string;
  balance: string;
  firstBuyTimestamp: Date;
  lastActivityTimestamp: Date;
}

/**
 * UserPortfolio interface matching Prisma model
 */
export interface MockUserPortfolio {
  id: string;
  walletAddress: string;
  totalInvested: string;
  totalReturned: string;
  totalTrades: number;
  updatedAt: Date;
}

/**
 * PriceHistory interface matching Prisma model
 */
export interface MockPriceHistory {
  id: string;
  tokenAddress: string;
  timestamp: Date;
  interval: PriceInterval;
  open: string;
  high: string;
  low: string;
  close: string;
  volumeNative: string;
  volumeToken: string;
  tradeCount: number;
}

let holderCounter = 0;

/**
 * Generate a unique holder address
 */
function generateHolderAddress(): string {
  holderCounter++;
  const hex = holderCounter.toString(16).padStart(40, 'a');
  return '0x' + hex;
}

/**
 * Default holder factory values
 */
const DEFAULT_HOLDER_VALUES = {
  balance: '1000000000000000000', // 1 token (with 18 decimals)
};

/**
 * Create a mock holder with optional overrides
 */
export function createMockHolder(overrides: Partial<MockHolder> = {}): MockHolder {
  const now = new Date();
  const timestamp = now.getTime();
  const random = Math.random().toString(36).slice(2, 9);

  return {
    id: overrides.id || 'holder-' + timestamp + '-' + random,
    tokenAddress: overrides.tokenAddress || TEST_ADDRESSES.token,
    holderAddress: overrides.holderAddress || generateHolderAddress(),
    firstBuyTimestamp: overrides.firstBuyTimestamp || now,
    lastActivityTimestamp: overrides.lastActivityTimestamp || now,
    ...DEFAULT_HOLDER_VALUES,
    ...overrides,
  };
}

/**
 * Create multiple mock holders
 */
export function createMockHolders(count: number, overrides: Partial<MockHolder> = {}): MockHolder[] {
  return Array.from({ length: count }, () => createMockHolder(overrides));
}

/**
 * Create a whale holder (large balance)
 */
export function createWhaleHolder(overrides: Partial<MockHolder> = {}): MockHolder {
  return createMockHolder({
    balance: '100000000000000000000000000', // 100M tokens
    ...overrides,
  });
}

/**
 * Create a small holder (small balance)
 */
export function createSmallHolder(overrides: Partial<MockHolder> = {}): MockHolder {
  return createMockHolder({
    balance: '100000000000000000', // 0.1 tokens
    ...overrides,
  });
}

/**
 * Create a zero balance holder (sold all tokens)
 */
export function createZeroBalanceHolder(overrides: Partial<MockHolder> = {}): MockHolder {
  return createMockHolder({
    balance: '0',
    ...overrides,
  });
}

/**
 * Create a holder who is also the token creator
 */
export function createCreatorAsHolder(creatorAddress: string, overrides: Partial<MockHolder> = {}): MockHolder {
  return createMockHolder({
    holderAddress: creatorAddress,
    balance: '50000000000000000000000000', // 50M tokens (creator initial allocation)
    ...overrides,
  });
}

/**
 * Create a distribution of holders with varying balances
 */
export function createHolderDistribution(
  tokenAddress: string,
  config: { whales?: number; medium?: number; small?: number } = {},
): MockHolder[] {
  const whales = config.whales ?? 3;
  const medium = config.medium ?? 10;
  const small = config.small ?? 20;
  const holders: MockHolder[] = [];

  // Whale holders (1M+ tokens)
  for (let i = 0; i < whales; i++) {
    const amount = (10 + Math.random() * 90).toFixed(0);
    holders.push(
      createMockHolder({
        tokenAddress,
        balance: amount + '000000000000000000000000', // 10M-100M tokens
      }),
    );
  }

  // Medium holders (10K-1M tokens)
  for (let i = 0; i < medium; i++) {
    const amount = (10 + Math.random() * 990).toFixed(0);
    holders.push(
      createMockHolder({
        tokenAddress,
        balance: amount + '000000000000000000000', // 10K-1M tokens
      }),
    );
  }

  // Small holders (<10K tokens)
  for (let i = 0; i < small; i++) {
    const amount = (1 + Math.random() * 9).toFixed(0);
    holders.push(
      createMockHolder({
        tokenAddress,
        balance: amount + '000000000000000000000', // 1K-10K tokens
      }),
    );
  }

  return holders;
}

/**
 * Reset the holder counter (useful between tests)
 */
export function resetHolderCounter(): void {
  holderCounter = 0;
}

// =============================================================================
// USER PORTFOLIO FACTORIES
// =============================================================================

/**
 * Default user portfolio factory values
 */
const DEFAULT_PORTFOLIO_VALUES = {
  totalInvested: '1000000000000000000', // 1 PUSH
  totalReturned: '0',
  totalTrades: 0,
};

/**
 * Create a mock user portfolio with optional overrides
 */
export function createMockUserPortfolio(overrides: Partial<MockUserPortfolio> = {}): MockUserPortfolio {
  const now = new Date();
  const timestamp = now.getTime();
  const random = Math.random().toString(36).slice(2, 9);

  return {
    id: overrides.id || 'portfolio-' + timestamp + '-' + random,
    walletAddress: overrides.walletAddress || generateHolderAddress(),
    updatedAt: overrides.updatedAt || now,
    ...DEFAULT_PORTFOLIO_VALUES,
    ...overrides,
  };
}

/**
 * Create a profitable portfolio (more returned than invested)
 */
export function createProfitablePortfolio(overrides: Partial<MockUserPortfolio> = {}): MockUserPortfolio {
  return createMockUserPortfolio({
    totalInvested: '10000000000000000000', // 10 PUSH invested
    totalReturned: '25000000000000000000', // 25 PUSH returned (150% profit)
    totalTrades: 15,
    ...overrides,
  });
}

/**
 * Create a losing portfolio (less returned than invested)
 */
export function createLosingPortfolio(overrides: Partial<MockUserPortfolio> = {}): MockUserPortfolio {
  return createMockUserPortfolio({
    totalInvested: '10000000000000000000', // 10 PUSH invested
    totalReturned: '3000000000000000000', // 3 PUSH returned (70% loss)
    totalTrades: 8,
    ...overrides,
  });
}

// =============================================================================
// PRICE HISTORY (CANDLE) FACTORIES
// =============================================================================

/**
 * Default price history factory values
 */
const DEFAULT_CANDLE_VALUES = {
  interval: 'ONE_MINUTE' as PriceInterval,
  open: '20000000000000', // 0.00002 PUSH
  high: '22000000000000', // 0.000022 PUSH
  low: '19000000000000', // 0.000019 PUSH
  close: '21000000000000', // 0.000021 PUSH
  volumeNative: '1000000000000000000', // 1 PUSH volume
  volumeToken: '50000000000000000000000', // 50K tokens volume
  tradeCount: 10,
};

/**
 * Create a mock price history (candle) with optional overrides
 */
export function createMockPriceHistory(overrides: Partial<MockPriceHistory> = {}): MockPriceHistory {
  const now = new Date();
  const timestamp = now.getTime();
  const random = Math.random().toString(36).slice(2, 9);

  return {
    id: overrides.id || 'candle-' + timestamp + '-' + random,
    tokenAddress: overrides.tokenAddress || TEST_ADDRESSES.token,
    timestamp: overrides.timestamp || now,
    ...DEFAULT_CANDLE_VALUES,
    ...overrides,
  };
}

/**
 * Create a series of price history candles
 */
export function createMockPriceHistorySeries(
  tokenAddress: string,
  count: number,
  interval: PriceInterval = 'ONE_MINUTE',
  startTimestamp?: Date,
): MockPriceHistory[] {
  const intervalMs: Record<PriceInterval, number> = {
    ONE_MINUTE: 60 * 1000,
    FIVE_MINUTES: 5 * 60 * 1000,
    FIFTEEN_MINUTES: 15 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    FOUR_HOURS: 4 * 60 * 60 * 1000,
    ONE_DAY: 24 * 60 * 60 * 1000,
  };

  const start = startTimestamp || new Date(Date.now() - count * intervalMs[interval]);
  let currentPrice = 20000000000000; // Starting price
  const candles: MockPriceHistory[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(start.getTime() + i * intervalMs[interval]);

    // Simulate price movement
    const change = (Math.random() - 0.48) * 0.1; // Slight upward bias
    const open = currentPrice;
    const close = Math.floor(currentPrice * (1 + change));
    const high = Math.max(open, close) + Math.floor(Math.random() * 1000000000000);
    const low = Math.min(open, close) - Math.floor(Math.random() * 1000000000000);

    const volumeNativeNum = Math.floor(Math.random() * 10 + 1);
    const volumeTokenNum = Math.floor(Math.random() * 100 + 10);

    candles.push(
      createMockPriceHistory({
        tokenAddress,
        timestamp,
        interval,
        open: open.toString(),
        high: Math.max(high, open, close).toString(),
        low: Math.max(low, 1).toString(), // Ensure positive
        close: close.toString(),
        volumeNative: volumeNativeNum + '000000000000000000', // 1-10 PUSH
        volumeToken: volumeTokenNum + '000000000000000000000', // 10K-100K tokens
        tradeCount: Math.floor(Math.random() * 20 + 1),
      }),
    );

    currentPrice = close;
  }

  return candles;
}
