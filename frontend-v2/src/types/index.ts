// Token status enum matching backend
export type TokenStatus = 'TRADING' | 'LOCKED' | 'LISTED';

// Trade type enum
export type TradeType = 'BUY' | 'SELL' | 'CREATE';

// Price interval for charts
export type PriceInterval =
  | 'ONE_MINUTE'
  | 'FIVE_MINUTES'
  | 'FIFTEEN_MINUTES'
  | 'ONE_HOUR'
  | 'FOUR_HOURS'
  | 'ONE_DAY';

// Leaderboard types
export type LeaderboardType = 'gainers' | 'losers' | 'volume' | 'new' | 'graduated';

// Alert type
export type AlertType = 'PRICE_ABOVE' | 'PRICE_BELOW' | 'GRADUATION';

// Token from API
export interface Token {
  address: string;
  name: string;
  symbol: string;
  tokenURI: string;
  creator: string;
  createdAt: string;
  status: TokenStatus;
  price: string;
  priceChange24h: number;
  marketCap: string;
  athPrice: string;
  athMarketCap: string;
  volume24h: string;
  holders: number;
  tradeCount: number;
  realNativeReserve: string;
  realTokenReserve: string;
  virtualNativeReserve: string;
  virtualTokenReserve: string;
  bondingCurveAddress: string;
  poolAddress?: string;
  graduatedAt?: string;
  // Metadata from tokenURI
  metadata?: TokenMetadata;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_url?: string;
  properties?: {
    twitter?: string;
    telegram?: string;
  };
}

// Token trade from API
export interface TokenTrade {
  id: string;
  hash: string;
  userAddress: string;
  tokenAddress: string;
  type: TradeType;
  amountNativeIn: string;
  amountNativeOut: string;
  amountTokenIn: string;
  amountTokenOut: string;
  price: string;
  priceUsd?: string;
  blockNumber: number;
  timestamp: string;
  token?: {
    name: string;
    symbol: string;
    metadata?: TokenMetadata;
  };
}

// Token holder from API
export interface TokenHolder {
  holderAddress: string;
  tokenAddress: string;
  balance: string;
  percentage: number;
  firstAcquiredAt: string;
  lastUpdatedAt: string;
}

// Price history candle from API
export interface PriceCandle {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradeCount: number;
}

// User portfolio from API
export interface UserPortfolio {
  userAddress: string;
  totalValueNative: string;
  totalValueUsd?: string;
  totalInvestedNative: string;
  unrealizedPnlNative: string;
  realizedPnlNative: string;
  pnlPercentage: number;
  holdings: UserHolding[];
}

export interface UserHolding {
  tokenAddress: string;
  balance: string;
  averageBuyPrice: string;
  currentPrice: string;
  currentValue: string;
  investedValue: string;
  unrealizedPnl: string;
  pnlPercentage: number;
  isCreator: boolean;
  token: {
    name: string;
    symbol: string;
    status: TokenStatus;
    metadata?: TokenMetadata;
  };
}

// User alert from API
export interface Alert {
  id: string;
  userAddress: string;
  tokenAddress: string;
  alertType: AlertType;
  targetPrice?: string;
  isActive: boolean;
  triggeredAt?: string;
  createdAt: string;
  token: {
    name: string;
    symbol: string;
    metadata?: TokenMetadata;
  };
}

// Leaderboard entry
export interface LeaderboardEntry {
  tokenAddress: string;
  name: string;
  symbol: string;
  metadata?: TokenMetadata;
  value: number; // The metric being ranked (price change, volume, etc.)
  marketCap: string;
  price: string;
  priceChange24h: number;
  volume24h: string;
  holders: number;
}

// API pagination response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API error response
export interface ApiError {
  statusCode: number;
  message: string | string[];
  timestamp: string;
}

// Auth tokens
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// WebSocket events
export interface TokenUpdateEvent {
  address: string;
  price: string;
  marketCap: string;
  status: TokenStatus;
}

export interface PriceUpdateEvent {
  address: string;
  price: string;
  change24h: number;
}

export interface NewTradeEvent {
  trade: TokenTrade;
}

export interface GraduationEvent {
  address: string;
  poolAddress: string;
}

export interface AthEvent {
  address: string;
  price?: string;
  marketCap?: string;
}
