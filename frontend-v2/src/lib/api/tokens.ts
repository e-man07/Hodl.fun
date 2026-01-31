import type {
  Token,
  TokenTrade,
  TokenHolder,
  PriceCandle,
  PaginatedResponse,
  PriceInterval,
  TokenStatus,
} from '@/types';
import { apiClient } from './client';

export interface TokenFilters {
  page?: number;
  limit?: number;
  status?: TokenStatus;
  sortBy?: 'marketCap' | 'volume24h' | 'priceChange24h' | 'holders' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  creator?: string;
}

/**
 * Get paginated list of tokens
 */
export async function getTokens(filters: TokenFilters = {}): Promise<PaginatedResponse<Token>> {
  const searchParams = new URLSearchParams();

  if (filters.page) searchParams.set('page', filters.page.toString());
  if (filters.limit) searchParams.set('limit', filters.limit.toString());
  if (filters.status) searchParams.set('status', filters.status);
  if (filters.sortBy) searchParams.set('sortBy', filters.sortBy);
  if (filters.sortOrder) searchParams.set('sortOrder', filters.sortOrder);
  if (filters.search) searchParams.set('search', filters.search);
  if (filters.creator) searchParams.set('creator', filters.creator);

  return apiClient.get<PaginatedResponse<Token>>(`tokens?${searchParams.toString()}`);
}

/**
 * Get trending tokens (pre-computed, cached)
 */
export async function getTrendingTokens(): Promise<Token[]> {
  return apiClient.get<Token[]>('tokens/trending');
}

/**
 * Get new tokens
 */
export async function getNewTokens(limit = 10): Promise<Token[]> {
  return apiClient.get<Token[]>(`tokens/new?limit=${limit}`);
}

/**
 * Get single token by address
 */
export async function getToken(address: string): Promise<Token> {
  return apiClient.get<Token>(`tokens/${address}`);
}

/**
 * Get token trades
 */
export async function getTokenTrades(
  address: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<TokenTrade>> {
  return apiClient.get<PaginatedResponse<TokenTrade>>(
    `tokens/${address}/trades?page=${page}&limit=${limit}`
  );
}

/**
 * Get token holders
 */
export async function getTokenHolders(
  address: string,
  page = 1,
  limit = 50
): Promise<PaginatedResponse<TokenHolder>> {
  return apiClient.get<PaginatedResponse<TokenHolder>>(
    `tokens/${address}/holders?page=${page}&limit=${limit}`
  );
}

/**
 * Get token price history for charts
 */
export async function getTokenPriceHistory(
  address: string,
  interval: PriceInterval = 'ONE_HOUR'
): Promise<PriceCandle[]> {
  return apiClient.get<PriceCandle[]>(
    `tokens/${address}/price-history?interval=${interval}`
  );
}

/**
 * Search tokens by name or symbol
 */
export async function searchTokens(query: string, limit = 10): Promise<Token[]> {
  const response = await apiClient.get<PaginatedResponse<Token>>(
    `tokens?search=${encodeURIComponent(query)}&limit=${limit}`
  );
  return response.data;
}
