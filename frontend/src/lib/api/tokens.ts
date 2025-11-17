// Token API endpoints

import apiClient from './client';
import {
  ApiResponse,
  PaginatedResponse,
  TokenData,
  TokenMetric,
  TokenHolder,
  TokenTrade,
  TokenQueryParams,
} from './types';

/**
 * Get all tokens with pagination and filtering
 */
export async function getTokens(
  params?: TokenQueryParams
): Promise<PaginatedResponse<TokenData>> {
  return apiClient.get('/tokens', { params });
}

/**
 * Get trending tokens
 */
export async function getTrendingTokens(
  limit: number = 10
): Promise<ApiResponse<{ trending: TokenData[]; count: number }>> {
  return apiClient.get('/tokens/trending', { params: { limit } });
}

/**
 * Get recently launched tokens
 */
export async function getNewTokens(
  limit: number = 10
): Promise<ApiResponse<{ newTokens: TokenData[]; count: number }>> {
  return apiClient.get('/tokens/new', { params: { limit } });
}

/**
 * Get token details by address
 */
export async function getToken(address: string): Promise<ApiResponse<TokenData>> {
  return apiClient.get(`/tokens/${address}`);
}

/**
 * Get token metrics (price history)
 */
export async function getTokenMetrics(
  address: string,
  period: '1h' | '24h' | '7d' | '30d' | 'all' = '24h'
): Promise<
  ApiResponse<{
    tokenAddress: string;
    period: string;
    metrics: TokenMetric[];
    count: number;
  }>
> {
  return apiClient.get(`/tokens/${address}/metrics`, { params: { period } });
}

/**
 * Get token holders
 */
export async function getTokenHolders(
  address: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedResponse<TokenHolder>> {
  return apiClient.get(`/tokens/${address}/holders`, { params: { page, limit } });
}

/**
 * Get token trades
 */
export async function getTokenTrades(
  address: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedResponse<TokenTrade>> {
  return apiClient.get(`/tokens/${address}/trades`, { params: { page, limit } });
}

/**
 * Get holder count for a token
 */
export async function getTokenHolderCount(
  address: string
): Promise<ApiResponse<{ holderCount: number }>> {
  return apiClient.get(`/tokens/${address}/holder-count`);
}

/**
 * Calculate buy quote - how many tokens for given ETH amount
 */
export async function calculateBuyQuote(
  address: string,
  ethAmount: string
): Promise<ApiResponse<{ tokensOut: string; priceImpact: number }>> {
  return apiClient.post(`/tokens/${address}/calculate-buy`, { ethAmount });
}

/**
 * Calculate sell quote - how much ETH for given token amount
 */
export async function calculateSellQuote(
  address: string,
  tokenAmount: string
): Promise<ApiResponse<{ ethOut: string; priceImpact: number }>> {
  return apiClient.post(`/tokens/${address}/calculate-sell`, { tokenAmount });
}

/**
 * Get token balance for a specific user
 */
export async function getTokenBalance(
  tokenAddress: string,
  userAddress: string
): Promise<ApiResponse<{ balance: string; balanceFormatted: string }>> {
  return apiClient.get(`/tokens/${tokenAddress}/balance/${userAddress}`);
}

/**
 * Get token allowance for owner/spender pair
 */
export async function getAllowance(
  tokenAddress: string,
  owner: string,
  spender: string
): Promise<ApiResponse<{ allowance: string; allowanceFormatted: string }>> {
  return apiClient.get(`/tokens/${tokenAddress}/allowance/${owner}/${spender}`);
}
