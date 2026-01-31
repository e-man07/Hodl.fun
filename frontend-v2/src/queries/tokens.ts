'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { PriceInterval } from '@/types';
import {
  getTokens,
  getTrendingTokens,
  getNewTokens,
  getToken,
  getTokenTrades,
  getTokenHolders,
  getTokenPriceHistory,
  searchTokens,
  type TokenFilters,
} from '@/lib/api/tokens';
import { queryKeys } from './keys';

/**
 * Hook for paginated token list
 */
export function useTokens(filters: TokenFilters = {}) {
  return useQuery({
    queryKey: queryKeys.tokens.list(filters),
    queryFn: () => getTokens(filters),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for trending tokens
 */
export function useTrendingTokens() {
  return useQuery({
    queryKey: queryKeys.tokens.trending(),
    queryFn: getTrendingTokens,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for new tokens
 */
export function useNewTokens(limit = 10) {
  return useQuery({
    queryKey: queryKeys.tokens.new(),
    queryFn: () => getNewTokens(limit),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for single token details
 */
export function useToken(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tokens.detail(address || ''),
    queryFn: () => getToken(address!),
    enabled: !!address,
    staleTime: 15 * 1000, // 15 seconds for active trading
  });
}

/**
 * Hook for token trades with pagination
 */
export function useTokenTrades(address: string | undefined, page = 1) {
  return useQuery({
    queryKey: queryKeys.tokens.trades(address || '', page),
    queryFn: () => getTokenTrades(address!, page),
    enabled: !!address,
    staleTime: 10 * 1000, // 10 seconds
  });
}

/**
 * Hook for infinite token trades
 */
export function useInfiniteTokenTrades(address: string | undefined) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.tokens.detail(address || ''), 'trades', 'infinite'],
    queryFn: ({ pageParam = 1 }) => getTokenTrades(address!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    enabled: !!address,
    staleTime: 10 * 1000,
  });
}

/**
 * Hook for token holders with pagination
 */
export function useTokenHolders(address: string | undefined, page = 1) {
  return useQuery({
    queryKey: queryKeys.tokens.holders(address || '', page),
    queryFn: () => getTokenHolders(address!, page),
    enabled: !!address,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for token price history (charts)
 */
export function useTokenPriceHistory(
  address: string | undefined,
  interval: PriceInterval = 'ONE_HOUR'
) {
  return useQuery({
    queryKey: queryKeys.tokens.priceHistory(address || '', interval),
    queryFn: () => getTokenPriceHistory(address!, interval),
    enabled: !!address,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for searching tokens
 */
export function useTokenSearch(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tokens.search(query),
    queryFn: () => searchTokens(query),
    enabled: options?.enabled ?? query.length >= 2,
    staleTime: 30 * 1000,
  });
}
