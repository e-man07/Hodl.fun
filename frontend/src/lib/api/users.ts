// User API endpoints

import apiClient from './client';
import {
  ApiResponse,
  PaginatedResponse,
  UserPortfolio,
  TokenTrade,
  UserPnLSummary,
  TokenData,
} from './types';

/**
 * Get user portfolio
 */
export async function getUserPortfolio(address: string): Promise<ApiResponse<UserPortfolio>> {
  return apiClient.get(`/users/${address}/portfolio`);
}

/**
 * Get user transactions
 */
export async function getUserTransactions(
  address: string,
  page: number = 1,
  limit: number = 50
): Promise<PaginatedResponse<TokenTrade>> {
  return apiClient.get(`/users/${address}/transactions`, { params: { page, limit } });
}

/**
 * Get tokens created by user
 */
export async function getUserCreatedTokens(
  address: string
): Promise<ApiResponse<{ creator: string; tokens: TokenData[]; count: number }>> {
  return apiClient.get(`/users/${address}/created`);
}

/**
 * Get user PnL summary
 */
export async function getUserPnL(address: string): Promise<ApiResponse<UserPnLSummary>> {
  return apiClient.get(`/users/${address}/pnl`);
}
