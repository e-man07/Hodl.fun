/**
 * Token Test Data Factory
 * Creates mock Token entities for testing
 */
import { TEST_ADDRESSES } from '../ethers.mock';

// TokenStatus enum mirroring Prisma schema
export type TokenStatus = 'TRADING' | 'LOCKED' | 'LISTED';

// Token interface matching Prisma model
export interface MockToken {
  id: string;
  address: string;
  curveAddress: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  tokenUri: string | null;
  virtualNative: string;
  virtualToken: string;
  realNative: string;
  realToken: string;
  k: string;
  currentPrice: string;
  marketCap: string;
  athPrice: string | null;
  athPriceTimestamp: Date | null;
  athMarketCap: string | null;
  athMarketCapTimestamp: Date | null;
  status: TokenStatus;
  poolAddress: string | null;
  createdAt: Date;
  createdBlock: bigint;
  graduatedAt: Date | null;
  listedAt: Date | null;
  listingBlock: bigint | null;
  updatedAt: Date;
}

let tokenCounter = 0;

/**
 * Generate a unique token address
 */
function generateTokenAddress(): string {
  tokenCounter++;
  const hex = tokenCounter.toString(16).padStart(40, '0');
  return `0x${hex}`;
}

/**
 * Default token factory values
 */
const DEFAULT_VALUES: Omit<MockToken, 'id' | 'address' | 'curveAddress' | 'createdAt' | 'updatedAt'> = {
  creatorAddress: TEST_ADDRESSES.user1,
  name: 'Test Token',
  symbol: 'TEST',
  tokenUri: 'https://example.com/token.json',
  virtualNative: '1000000000000000000', // 1 PUSH
  virtualToken: '50000000000000000000000000', // 50M tokens
  realNative: '0',
  realToken: '0',
  k: '50000000000000000000000000000000000000000000', // virtualNative * virtualToken
  currentPrice: '20000000000000', // 0.00002 PUSH per token
  marketCap: '20000000000000000000000', // 20,000 PUSH
  athPrice: null,
  athPriceTimestamp: null,
  athMarketCap: null,
  athMarketCapTimestamp: null,
  status: 'TRADING',
  poolAddress: null,
  createdBlock: BigInt(1000),
  graduatedAt: null,
  listedAt: null,
  listingBlock: null,
};

/**
 * Create a mock token with optional overrides
 */
export function createMockToken(overrides: Partial<MockToken> = {}): MockToken {
  const now = new Date();
  const address = overrides.address || generateTokenAddress();
  const curveAddress = overrides.curveAddress || generateTokenAddress();

  return {
    id: overrides.id || `token-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    address,
    curveAddress,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...DEFAULT_VALUES,
    ...overrides,
  };
}

/**
 * Create multiple mock tokens
 */
export function createMockTokens(count: number, overrides: Partial<MockToken> = {}): MockToken[] {
  return Array.from({ length: count }, (_, i) =>
    createMockToken({
      name: `Token ${i + 1}`,
      symbol: `TK${i + 1}`,
      ...overrides,
    }),
  );
}

/**
 * Create a graduated (locked) token
 */
export function createGraduatedToken(overrides: Partial<MockToken> = {}): MockToken {
  return createMockToken({
    status: 'LOCKED',
    graduatedAt: new Date(),
    marketCap: '1000000000000000000000000', // 1M PUSH (graduation threshold)
    ...overrides,
  });
}

/**
 * Create a listed token (on DEX)
 */
export function createListedToken(overrides: Partial<MockToken> = {}): MockToken {
  return createMockToken({
    status: 'LISTED',
    graduatedAt: new Date(Date.now() - 3600000), // 1 hour ago
    listedAt: new Date(),
    listingBlock: BigInt(2000),
    poolAddress: TEST_ADDRESSES.pool,
    marketCap: '1500000000000000000000000', // 1.5M PUSH
    ...overrides,
  });
}

/**
 * Create a token with ATH data
 */
export function createTokenWithATH(overrides: Partial<MockToken> = {}): MockToken {
  const athTimestamp = new Date(Date.now() - 86400000); // 1 day ago
  return createMockToken({
    athPrice: '50000000000000', // 0.00005 PUSH (higher than current)
    athPriceTimestamp: athTimestamp,
    athMarketCap: '50000000000000000000000', // 50,000 PUSH
    athMarketCapTimestamp: athTimestamp,
    ...overrides,
  });
}

/**
 * Create a token with high market cap (trending)
 */
export function createTrendingToken(overrides: Partial<MockToken> = {}): MockToken {
  return createMockToken({
    marketCap: '500000000000000000000000', // 500,000 PUSH
    currentPrice: '500000000000000', // 0.0005 PUSH
    realNative: '100000000000000000000000', // 100,000 PUSH invested
    realToken: '200000000000000000000000000', // 200M tokens sold
    ...overrides,
  });
}

/**
 * Reset the token counter (useful between tests)
 */
export function resetTokenCounter(): void {
  tokenCounter = 0;
}
