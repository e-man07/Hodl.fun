// Market API endpoints

import apiClient from './client';
import { ApiResponse, MarketStats, TrendingToken, TokenData } from './types';

/**
 * Get global market statistics
 */
export async function getMarketStats(): Promise<ApiResponse<MarketStats>> {
  return apiClient.get('/market/stats');
}

/**
 * Get trending tokens
 */
export async function getMarketTrending(
  limit: number = 10
): Promise<ApiResponse<{ trending: TrendingToken[]; count: number }>> {
  return apiClient.get('/market/trending', { params: { limit } });
}

/**
 * Get top gainers (24h)
 */
export async function getTopGainers(
  limit: number = 10
): Promise<ApiResponse<{ gainers: TokenData[]; count: number }>> {
  return apiClient.get('/market/gainers', { params: { limit } });
}

/**
 * Get top losers (24h)
 */
export async function getTopLosers(
  limit: number = 10
): Promise<ApiResponse<{ losers: TokenData[]; count: number }>> {
  return apiClient.get('/market/losers', { params: { limit } });
}

/**
 * Recent trade data from backend
 */
export interface RecentTrade {
  hash: string;
  type: 'buy' | 'sell';
  userAddress: string;
  tokenAddress: string;
  ethAmount: string;
  tokenAmount: string;
  price: number;
  timestamp: string;
  blockNumber: number;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo?: string;
}

/**
 * Get recent trades across all tokens (for trading activity banner)
 */
export async function getRecentTrades(
  limit: number = 10
): Promise<ApiResponse<{ trades: RecentTrade[]; count: number }>> {
  return apiClient.get('/market/recent-trades', { params: { limit } });
}
