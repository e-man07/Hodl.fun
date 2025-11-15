// API response types

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
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

// Token types
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

export interface TokenMetric {
  timestamp: string;
  price: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  priceChange24h: number;
}

export interface TokenHolder {
  holderAddress: string;
  balance: string;
  balanceFormatted: string;
  percentage: number;
  firstAcquired: string;
  lastUpdated: string;
}

export interface TokenTrade {
  hash: string;
  userAddress: string;
  tokenAddress: string;
  type: 'BUY' | 'SELL' | 'CREATE';
  amountIn: string;
  amountOut: string;
  price: number;
  timestamp: string;
  blockNumber: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  tokenInfo: {
    name: string;
    symbol: string;
    logo?: string;
  };
}

// User types
export interface PortfolioToken {
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

export interface UserPortfolio {
  userAddress: string;
  tokens: PortfolioToken[];
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  pnlPercentage: number;
}

export interface UserPnLSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  pnlPercentage: number;
  totalPositions: number;
  winningPositions: number;
  losingPositions: number;
  winRate: number;
}

// Market types
export interface MarketStats {
  totalTokens: number;
  totalMarketCap: number;
  totalVolume24h: number;
  totalHolders: number;
  newTokens24h: number;
  trades24h: number;
  activeUsers24h: number;
  avgTokenPrice: number;
}

export interface TrendingToken {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  score: number;
}

// IPFS types
export interface IPFSUploadResponse {
  ipfsHash: string;
  url: string;
  size: number;
  pinned: boolean;
}

// Query params
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
