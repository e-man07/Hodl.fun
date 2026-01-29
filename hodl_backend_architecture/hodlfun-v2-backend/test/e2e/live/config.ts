/**
 * Live E2E Test Configuration
 * Contains all configuration for live testing on Push Chain testnet
 */

// Network Configuration
export const NETWORK_CONFIG = {
  chainId: 42101,
  rpcUrl: process.env.RPC_URL || 'https://evm.rpc-testnet-donut-node1.push.org/',
  wsRpcUrl: process.env.WS_RPC_URL || 'wss://evm.rpc-testnet-donut-node1.push.org/',
  explorerUrl: 'https://donut.push.network/',
};

// Contract Addresses (Push Chain Testnet)
export const CONTRACT_ADDRESSES = {
  core: '0x592F8f0abbB9a3d3c425980Ac0263363C8405b03',
  factory: '0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8',
  feeVault: '0xbe2fd9b720d1d7fac7208523376d2a3332019928',
  wpush: '0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7',
};

// Service URLs
export const SERVICE_URLS = {
  api: process.env.API_URL || 'http://localhost:3000',
  websocket: process.env.WS_URL || 'http://localhost:3001',
  indexer: process.env.INDEXER_URL || 'http://localhost:3002',
  worker: process.env.WORKER_URL || 'http://localhost:3003',
};

// Test Wallet
export const TEST_WALLET = {
  address: '0x99F909737751215151572E90b46A2cC6f03A6fb0',
  // Private key should be set via environment variable for security
  privateKey: process.env.TEST_WALLET_PRIVATE_KEY || '',
};

// Test Timeouts (in milliseconds)
export const TIMEOUTS = {
  txConfirmation: 30000, // Wait for transaction confirmation
  indexerSync: 15000, // Wait for indexer to pick up event
  workerJob: 120000, // Wait for worker to process (candle aggregation)
  websocketEvent: 5000, // Wait for WebSocket event
  apiRequest: 10000, // API request timeout
};

// Retry Configuration
export const RETRY_CONFIG = {
  maxAttempts: 5,
  delayMs: 1000,
  backoffMultiplier: 2,
};

// Default Token Creation Parameters
export const DEFAULT_TOKEN_PARAMS = {
  name: 'Live Test Token',
  symbol: 'LIVE',
  tokenUri: 'https://example.com/live-test-token.json',
  initialBuyAmount: '0.1', // PUSH
  deployFee: '0.01', // PUSH
};

// Trade Parameters
export const DEFAULT_TRADE_PARAMS = {
  buyAmountPush: '0.5', // PUSH
  sellTokenAmount: '10000', // Tokens
  slippageTolerance: 0.05, // 5%
  deadlineSeconds: 300, // 5 minutes
};

// Health Check Endpoints
export const HEALTH_ENDPOINTS = {
  api: '/api/v1/health/ready',
  websocket: '/health/ready',
  indexer: '/health/ready',
  worker: '/health/ready',
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  authNonce: '/api/v1/auth/nonce',
  authVerify: '/api/v1/auth/verify',
  authRefresh: '/api/v1/auth/refresh',

  // Tokens
  tokens: '/api/v1/tokens',
  tokenByAddress: (address: string) => `/api/v1/tokens/${address}`,
  tokenTrades: (address: string) => `/api/v1/tokens/${address}/trades`,
  tokenHolders: (address: string) => `/api/v1/tokens/${address}/holders`,
  tokenPriceHistory: (address: string) => `/api/v1/tokens/${address}/price-history`,
  tokensTrending: '/api/v1/tokens/trending',
  tokensNew: '/api/v1/tokens/new',

  // Users
  userProfile: (address: string) => `/api/v1/users/${address}`,
  userPortfolio: (address: string) => `/api/v1/users/${address}/portfolio`,
  userHoldings: (address: string) => `/api/v1/users/${address}/holdings`,
  userTrades: (address: string) => `/api/v1/users/${address}/trades`,
  userCreatedTokens: (address: string) => `/api/v1/users/${address}/created-tokens`,
  userMe: '/api/v1/users/me',
  userMePortfolio: '/api/v1/users/me/portfolio',

  // Leaderboard
  leaderboardGainers: '/api/v1/leaderboard/gainers',
  leaderboardLosers: '/api/v1/leaderboard/losers',
  leaderboardVolume: '/api/v1/leaderboard/volume',
  leaderboardNew: '/api/v1/leaderboard/new',
  leaderboardGraduated: '/api/v1/leaderboard/graduated',

  // Alerts
  alerts: '/api/v1/alerts',
  alertById: (id: string) => `/api/v1/alerts/${id}`,
};

// WebSocket Events
export const WEBSOCKET_EVENTS = {
  // Subscribe events
  subscribeToken: 'subscribe:token',
  unsubscribeToken: 'unsubscribe:token',
  subscribeWallet: 'subscribe:wallet',
  unsubscribeWallet: 'unsubscribe:wallet',
  subscribeRecent: 'subscribe:recent',
  unsubscribeRecent: 'unsubscribe:recent',

  // Broadcast events
  trade: 'trade',
  newTrade: 'new_trade',
  priceUpdate: 'price_update',
  tokenCreated: 'token_created',
  recentTrades: 'recent_trades',
};

// Valid price history intervals (matches PriceInterval enum in Prisma schema)
export const PRICE_INTERVALS = [
  'ONE_MINUTE',
  'FIVE_MINUTES',
  'FIFTEEN_MINUTES',
  'ONE_HOUR',
  'FOUR_HOURS',
  'ONE_DAY',
] as const;

// Valid sort fields for token listing
export const TOKEN_SORT_FIELDS = ['createdAt', 'marketCap', 'currentPrice', 'name'] as const;

// Logger configuration for tests
export const LOG_CONFIG = {
  enabled: process.env.TEST_LOG_ENABLED !== 'false',
  level: process.env.TEST_LOG_LEVEL || 'info',
};

/**
 * Utility to log test progress
 */
export function testLog(message: string, data?: unknown): void {
  if (LOG_CONFIG.enabled) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [TEST] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

/**
 * Validate configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!TEST_WALLET.privateKey) {
    errors.push('TEST_WALLET_PRIVATE_KEY environment variable is required');
  }

  if (!CONTRACT_ADDRESSES.core) {
    errors.push('Core contract address is not set');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
