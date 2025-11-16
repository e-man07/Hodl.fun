// Type definitions for Hodl.fun Backend

import { Request } from 'express';

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
}

// ============================================
// Token Types
// ============================================

export interface TokenData {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  createdAt: string;
  creator: string;
  reserveRatio: number;
  tradingEnabled: boolean;
  logo?: string;
  currentSupply: string;
  totalSupply: string;
  reserveBalance: string;
  socialLinks?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
}

export interface TokenMetricData {
  tokenAddress: string;
  timestamp: string;
  price: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  priceChange24h: number;
}

export interface TokenHolderData {
  holderAddress: string;
  balance: string;
  balanceFormatted: string;
  percentage: number;
  firstAcquired: string;
  lastUpdated: string;
}

// ============================================
// Transaction Types
// ============================================

export interface TransactionData {
  hash: string;
  userAddress: string;
  tokenAddress: string;
  type: 'BUY' | 'SELL' | 'CREATE';
  amountIn: string;
  amountOut: string;
  price: number;
  timestamp: string;
  blockNumber: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  tokenInfo?: {
    name: string;
    symbol: string;
    logo?: string;
  };
}

// ============================================
// User Portfolio Types
// ============================================

export interface UserPortfolioData {
  userAddress: string;
  tokens: PortfolioTokenData[];
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  pnlPercentage: number;
}

export interface PortfolioTokenData {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  balanceFormatted: string;
  price: number;
  value: number;
  averagePrice: number;
  totalInvested: number;
  unrealizedPnL: number;
  realizedPnL: number;
  pnlPercentage: number;
  priceChange24h: number;
  isCreator: boolean;
  logo?: string;
}

// ============================================
// Market Stats Types
// ============================================

export interface MarketStatsData {
  totalTokens: number;
  totalMarketCap: number;
  totalVolume24h: number;
  totalHolders: number;
  newTokens24h: number;
  trades24h: number;
  activeUsers24h: number;
  avgTokenPrice: number;
}

export interface TrendingTokenData {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  score: number; // Trending score
}

// ============================================
// IPFS Types
// ============================================

export interface IPFSUploadRequest {
  file: Express.Multer.File;
  metadata?: {
    name: string;
    description?: string;
  };
}

export interface IPFSUploadResponse {
  ipfsHash: string;
  url: string;
  size: number;
  pinned: boolean;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  social?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
}

// ============================================
// Blockchain Event Types
// ============================================

export interface TokenCreatedEvent {
  tokenAddress: string;
  creator: string;
  name: string;
  symbol: string;
  totalSupply: bigint;
  reserveRatio: number;
  metadataURI: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

export interface TokensBoughtEvent {
  buyer: string;
  tokenAddress: string;
  ethAmount: bigint;
  tokenAmount: bigint;
  price: number;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

export interface TokensSoldEvent {
  seller: string;
  tokenAddress: string;
  tokenAmount: bigint;
  ethAmount: bigint;
  price: number;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

export interface TokenListedEvent {
  tokenAddress: string;
  creator: string;
  metadataURI: string;
  totalSupply: bigint;
  reserveRatio: bigint;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

// ============================================
// Query Parameter Types
// ============================================

export interface TokenQueryParams {
  page?: number;
  limit?: number;
  sort?: 'marketCap' | 'volume' | 'holders' | 'created' | 'price';
  order?: 'asc' | 'desc';
  search?: string;
  creator?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface MetricsQueryParams {
  period?: '1h' | '24h' | '7d' | '30d' | 'all';
  interval?: '1m' | '5m' | '15m' | '1h' | '1d';
}

// ============================================
// Cache Types
// ============================================

export interface CacheConfig {
  enabled: boolean;
  ttl: {
    tokenList: number;
    tokenDetails: number;
    tokenPrice: number;
    metadata: number;
  };
}

// ============================================
// Worker Job Types
// ============================================

export interface IndexerJobData {
  fromBlock: number;
  toBlock: number;
}

export interface MetricsJobData {
  tokenAddress: string;
}

export interface HolderJobData {
  tokenAddress: string;
}

// ============================================
// Extended Express Request
// ============================================

export interface AuthRequest extends Request {
  user?: {
    address: string;
    signature: string;
  };
}

// ============================================
// Configuration Types
// ============================================

export interface AppConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  apiVersion: string;
  cors: {
    origin: string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface BlockchainConfig {
  primaryRpc: string;
  secondaryRpc?: string;
  tertiaryRpc?: string;
  tokenFactory: string;
  marketplace: string;
  startBlock: number;
  rpcRateLimit: number;
  confirmations: number;
}

export interface IPFSConfig {
  apiKey: string;
  secretKey: string;
  jwt: string;
  gatewayUrl: string;
  rateLimit: number;
}

// ============================================
// Error Types
// ============================================

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

export class BlockchainError extends AppError {
  constructor(message: string) {
    super(message, 503);
  }
}
