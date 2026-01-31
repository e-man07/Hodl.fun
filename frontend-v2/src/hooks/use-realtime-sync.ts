'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToToken, subscribeToTrades } from '@/lib/ws/client';
import { queryKeys } from '@/queries/keys';
import type { Token, TokenTrade } from '@/types';

/**
 * Hook to sync token data with real-time WebSocket updates
 */
export function useRealtimeTokenSync(tokenAddress: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tokenAddress) return;

    const unsubscribe = subscribeToToken(tokenAddress, {
      onPriceUpdate: (data) => {
        // Update token detail cache
        queryClient.setQueryData<Token>(
          queryKeys.tokens.detail(tokenAddress),
          (old) =>
            old
              ? {
                  ...old,
                  price: data.price,
                  priceChange24h: data.change24h,
                }
              : old
        );
      },
      onTokenUpdate: (data) => {
        // Update full token data
        queryClient.setQueryData<Token>(
          queryKeys.tokens.detail(tokenAddress),
          (old) =>
            old
              ? {
                  ...old,
                  price: data.price,
                  marketCap: data.marketCap,
                  status: data.status,
                }
              : old
        );
      },
      onGraduation: (data) => {
        // Update status to LISTED
        queryClient.setQueryData<Token>(
          queryKeys.tokens.detail(tokenAddress),
          (old) =>
            old
              ? {
                  ...old,
                  status: 'LISTED',
                  poolAddress: data.poolAddress,
                }
              : old
        );
        // Invalidate to refetch full data
        queryClient.invalidateQueries({
          queryKey: queryKeys.tokens.detail(tokenAddress),
        });
      },
      onAthPrice: (data) => {
        if (data.price) {
          queryClient.setQueryData<Token>(
            queryKeys.tokens.detail(tokenAddress),
            (old) => (old ? { ...old, athPrice: data.price! } : old)
          );
        }
      },
      onAthMarketCap: (data) => {
        if (data.marketCap) {
          queryClient.setQueryData<Token>(
            queryKeys.tokens.detail(tokenAddress),
            (old) => (old ? { ...old, athMarketCap: data.marketCap! } : old)
          );
        }
      },
    });

    return unsubscribe;
  }, [tokenAddress, queryClient]);
}

/**
 * Hook to sync trades with real-time WebSocket updates
 */
export function useRealtimeTradesSync(tokenAddress: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tokenAddress) return;

    const unsubscribe = subscribeToTrades(tokenAddress, {
      onNewTrade: (trade) => {
        // Prepend new trade to cache
        queryClient.setQueryData(
          queryKeys.tokens.trades(tokenAddress, 1),
          (old: { data: TokenTrade[]; pagination: unknown } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              data: [trade, ...old.data.slice(0, 49)],
            };
          }
        );
      },
    });

    return unsubscribe;
  }, [tokenAddress, queryClient]);
}

/**
 * Combined hook for all real-time syncing on token page
 */
export function useTokenPageRealtime(tokenAddress: string | undefined) {
  useRealtimeTokenSync(tokenAddress);
  useRealtimeTradesSync(tokenAddress);
}
