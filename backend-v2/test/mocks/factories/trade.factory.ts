/**
 * Trade Test Data Factory
 * Creates mock Trade entities for testing
 */
import { TEST_ADDRESSES, TEST_TX_HASHES } from '../ethers.mock';

// TradeType enum mirroring Prisma schema
export type TradeType = 'BUY' | 'SELL';

// Trade interface matching Prisma model
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

/**
 * Generate a unique transaction hash
 */
function generateTxHash(): string {
  tradeCounter++;
  const hex = tradeCounter.toString(16).padStart(64, '0');
  return `0x${hex}`;
}

/**
 * Default buy trade values
 */
const DEFAULT_BUY_VALUES = {
  type: 'BUY' as TradeType,
  amountIn: '1000000000000000000', // 1 PUSH
  amountOut: '49505000000000000000000', // ~49.5k tokens
  price: '20200000000000', // 0.0000202 PUSH
  feeAmount: '10000000000000000', // 0.01 PUSH (1%)
  blockNumber: BigInt(1001),
};

/**
 * Default sell trade values
 */
const DEFAULT_SELL_VALUES = {
  type: 'SELL' as TradeType,
  amountIn: '49505000000000000000000', // ~49.5k tokens
  amountOut: '980000000000000000', // 0.98 PUSH
  price: '19800000000000', // 0.0000198 PUSH
  feeAmount: '10000000000000000', // 0.01 PUSH (1%)
  blockNumber: BigInt(1002),
};

/**
 * Create a mock buy trade with optional overrides
 */
export function createMockBuyTrade(overrides: Partial<MockTrade> = {}): MockTrade {
  const now = new Date();

  return {
    id: overrides.id || `trade-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tokenAddress: overrides.tokenAddress || TEST_ADDRESSES.token,
    traderAddress: overrides.traderAddress || TEST_ADDRESSES.user1,
    txHash: overrides.txHash || generateTxHash(),
    timestamp: overrides.timestamp || now,
    ...DEFAULT_BUY_VALUES,
    ...overrides,
  };
}

/**
 * Create a mock sell trade with optional overrides
 */
export function createMockSellTrade(overrides: Partial<MockTrade> = {}): MockTrade {
  const now = new Date();

  return {
    id: overrides.id || `trade-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tokenAddress: overrides.tokenAddress || TEST_ADDRESSES.token,
    traderAddress: overrides.traderAddress || TEST_ADDRESSES.user1,
    txHash: overrides.txHash || generateTxHash(),
    timestamp: overrides.timestamp || now,
    ...DEFAULT_SELL_VALUES,
    ...overrides,
  };
}

/**
 * Create a mock trade (generic)
 */
export function createMockTrade(overrides: Partial<MockTrade> = {}): MockTrade {
  if (overrides.type === 'SELL') {
    return createMockSellTrade(overrides);
  }
  return createMockBuyTrade(overrides);
}

/**
 * Create multiple mock trades
 */
export function createMockTrades(
  count: number,
  tokenAddress = TEST_ADDRESSES.token,
  options: { alternateType?: boolean } = {},
): MockTrade[] {
  const baseTime = new Date();

  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date(baseTime.getTime() - i * 60000); // 1 minute apart
    const type: TradeType = options.alternateType
      ? i % 2 === 0
        ? 'BUY'
        : 'SELL'
      : 'BUY';

    return createMockTrade({
      tokenAddress,
      type,
      timestamp,
      blockNumber: BigInt(1000 + i),
    });
  });
}

/**
 * Create a large buy trade (whale)
 */
export function createWhaleBuyTrade(overrides: Partial<MockTrade> = {}): MockTrade {
  return createMockBuyTrade({
    amountIn: '100000000000000000000', // 100 PUSH
    amountOut: '4500000000000000000000000', // ~4.5M tokens
    feeAmount: '1000000000000000000', // 1 PUSH
    ...overrides,
  });
}

/**
 * Create a small buy trade
 */
export function createSmallBuyTrade(overrides: Partial<MockTrade> = {}): MockTrade {
  return createMockBuyTrade({
    amountIn: '10000000000000000', // 0.01 PUSH
    amountOut: '495000000000000000000', // ~495 tokens
    feeAmount: '100000000000000', // 0.0001 PUSH
    ...overrides,
  });
}

/**
 * Create trades for price history generation
 */
export function createTradesForCandles(
  tokenAddress: string,
  count: number,
  intervalMs = 60000, // 1 minute
): MockTrade[] {
  const baseTime = new Date();
  const trades: MockTrade[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime.getTime() - i * intervalMs);

    // Create varying prices for OHLC
    const priceMultiplier = 1 + (Math.sin(i * 0.5) * 0.1); // ±10% variation
    const basePrice = 20000000000000;
    const price = Math.floor(basePrice * priceMultiplier).toString();

    trades.push(
      createMockBuyTrade({
        tokenAddress,
        timestamp,
        price,
        blockNumber: BigInt(1000 + count - i),
      }),
    );
  }

  return trades;
}

/**
 * Reset the trade counter (useful between tests)
 */
export function resetTradeCounter(): void {
  tradeCounter = 0;
}
