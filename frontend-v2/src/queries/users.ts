'use client';

import { useQuery } from '@tanstack/react-query';
import { isAuthenticated } from '@/lib/api/client';
import {
  getMyPortfolio,
  getUserPortfolio,
  getUserHoldings,
  getUserTrades,
  getUserCreatedTokens,
} from '@/lib/api/users';
import { queryKeys } from './keys';

/**
 * Hook for current user's portfolio (requires auth)
 */
export function useMyPortfolio() {
  return useQuery({
    queryKey: queryKeys.users.portfolio('me'),
    queryFn: getMyPortfolio,
    enabled: isAuthenticated(),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for any user's portfolio
 */
export function useUserPortfolio(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.portfolio(address || ''),
    queryFn: () => getUserPortfolio(address!),
    enabled: !!address,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for user holdings
 */
export function useUserHoldings(address: string | undefined, page = 1) {
  return useQuery({
    queryKey: queryKeys.users.holdings(address || '', page),
    queryFn: () => getUserHoldings(address!, page),
    enabled: !!address,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for user trade history
 */
export function useUserTrades(address: string | undefined, page = 1) {
  return useQuery({
    queryKey: queryKeys.users.trades(address || '', page),
    queryFn: () => getUserTrades(address!, page),
    enabled: !!address,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for tokens created by user
 */
export function useUserCreatedTokens(address: string | undefined, page = 1) {
  return useQuery({
    queryKey: queryKeys.users.createdTokens(address || '', page),
    queryFn: () => getUserCreatedTokens(address!, page),
    enabled: !!address,
    staleTime: 60 * 1000,
  });
}
