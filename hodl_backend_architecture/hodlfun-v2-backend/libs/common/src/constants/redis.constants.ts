/**
 * Redis key patterns and helper functions for consistent key naming.
 * All keys follow the pattern: `<entity>:<identifier>:<subkey>`
 */
export const REDIS_KEYS = {
  // Token keys
  /**
   * Get key for a single token's cached data
   * @param tokenAddress - Token contract address
   */
  token: (tokenAddress: string): string => `token:${tokenAddress.toLowerCase()}`,

  /** Key for paginated token list cache */
  tokenList: (): string => 'tokens:list',

  /** Key for trending tokens cache */
  tokenTrending: (): string => 'tokens:trending',

  /** Key for newest tokens cache */
  tokenNew: (): string => 'tokens:new',

  /**
   * Get key for token holders list
   * @param tokenAddress - Token contract address
   */
  tokenHolders: (tokenAddress: string): string => `token:${tokenAddress.toLowerCase()}:holders`,

  // User keys
  /**
   * Get key for a user's basic profile data
   * @param walletAddress - User's wallet address
   */
  user: (walletAddress: string): string => `user:${walletAddress.toLowerCase()}`,

  /**
   * Get key for a user's portfolio data
   * @param walletAddress - User's wallet address
   */
  userPortfolio: (walletAddress: string): string =>
    `user:${walletAddress.toLowerCase()}:portfolio`,

  /**
   * Get key for a user's token holdings
   * @param walletAddress - User's wallet address
   */
  userHoldings: (walletAddress: string): string =>
    `user:${walletAddress.toLowerCase()}:holdings`,

  /**
   * Get key for a user's trade history
   * @param walletAddress - User's wallet address
   */
  userTrades: (walletAddress: string): string => `user:${walletAddress.toLowerCase()}:trades`,

  // Candle/OHLC keys
  /**
   * Get key for price candles
   * @param tokenAddress - Token contract address
   * @param interval - Candle interval (e.g., '1h', '4h', '1d')
   */
  candles: (tokenAddress: string, interval: string): string =>
    `candles:${tokenAddress.toLowerCase()}:${interval}`,

  // Auth keys
  /**
   * Get key for authentication nonce
   * @param walletAddress - User's wallet address
   */
  authNonce: (walletAddress: string): string => `auth:nonce:${walletAddress.toLowerCase()}`,

  // Rate limiting keys
  /**
   * Get key for rate limiting
   * @param identifier - User identifier (IP, wallet, etc.)
   * @param endpoint - API endpoint or action being rate limited
   */
  rateLimit: (identifier: string, endpoint: string): string =>
    `ratelimit:${identifier.toLowerCase()}:${endpoint}`,

  // DLQ keys
  /**
   * Get key for dead letter queue job
   * @param jobId - Unique job identifier
   */
  dlqJob: (jobId: string): string => `dlq:job:${jobId}`,

  /** Sorted set for DLQ jobs ordered by timestamp */
  dlqIndex: (): string => 'dlq:index',

  /**
   * Pattern matchers for cache invalidation
   */
  PATTERNS: Object.freeze({
    /** Match all token keys */
    ALL_TOKENS: 'token:*',

    /** Match all user keys */
    ALL_USERS: 'user:*',

    /** Match all candle keys */
    ALL_CANDLES: 'candles:*',

    /** Match all rate limit keys */
    ALL_RATE_LIMITS: 'ratelimit:*',

    /** Match all DLQ keys */
    ALL_DLQ: 'dlq:*',
  }),
} as const;

/**
 * Cache TTL (Time-To-Live) values in seconds.
 * Shorter TTLs for frequently changing data, longer for static data.
 */
export const CACHE_TTL = Object.freeze({
  /** Single token data (60 seconds) */
  TOKEN: 60,

  /** Token list pagination (30 seconds) */
  TOKEN_LIST: 30,

  /** User portfolio data (60 seconds) */
  USER_PORTFOLIO: 60,

  /** Price history/candles (5 minutes) */
  PRICE_HISTORY: 300,

  /** Auth nonce expiry (5 minutes) */
  NONCE: 300,

  /** Trending tokens (1 minute) */
  TRENDING: 60,

  /** New tokens (30 seconds) */
  NEW_TOKENS: 30,

  /** Holder list (2 minutes) */
  HOLDERS: 120,

  /** Trade history (1 minute) */
  TRADES: 60,
} as const);

export type CacheTTL = (typeof CACHE_TTL)[keyof typeof CACHE_TTL];
