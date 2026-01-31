import type {
  UserPortfolio,
  UserHolding,
  TokenTrade,
  Token,
  PaginatedResponse,
} from '@/types';
import { apiClient } from './client';

/**
 * Get current user's portfolio (requires auth)
 */
export async function getMyPortfolio(): Promise<UserPortfolio> {
  return apiClient.get<UserPortfolio>('users/me/portfolio');
}

/**
 * Get any user's portfolio by address
 */
export async function getUserPortfolio(address: string): Promise<UserPortfolio> {
  return apiClient.get<UserPortfolio>(`users/${address}/portfolio`);
}

/**
 * Get user's token holdings
 */
export async function getUserHoldings(
  address: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<UserHolding>> {
  return apiClient.get<PaginatedResponse<UserHolding>>(
    `users/${address}/holdings?page=${page}&limit=${limit}`
  );
}

/**
 * Get user's trade history
 */
export async function getUserTrades(
  address: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<TokenTrade>> {
  return apiClient.get<PaginatedResponse<TokenTrade>>(
    `users/${address}/trades?page=${page}&limit=${limit}`
  );
}

/**
 * Get tokens created by user
 */
export async function getUserCreatedTokens(
  address: string,
  page = 1,
  limit = 20
): Promise<PaginatedResponse<Token>> {
  return apiClient.get<PaginatedResponse<Token>>(
    `users/${address}/created-tokens?page=${page}&limit=${limit}`
  );
}
