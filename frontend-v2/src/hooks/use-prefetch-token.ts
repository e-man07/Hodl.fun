import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/queries/keys';
import {
  getToken,
  getTokenTrades,
  getTokenHolders,
  getTokenPriceHistory,
} from '@/lib/api/tokens';

/**
 * Hook to prefetch token data on hover for faster navigation
 * This reduces perceived load time when users click on token links
 * Uses centralized API methods to avoid logic duplication
 */
export function usePrefetchToken() {
  const queryClient = useQueryClient();

  const prefetchToken = useCallback(
    (address: string) => {
      // Prefetch token details
      queryClient.prefetchQuery({
        queryKey: queryKeys.tokens.detail(address),
        queryFn: () => getToken(address),
        staleTime: 30 * 1000, // 30 seconds
      });

      // Prefetch price history (1 minute interval)
      queryClient.prefetchQuery({
        queryKey: queryKeys.tokens.priceHistory(address, 'ONE_MINUTE'),
        queryFn: () => getTokenPriceHistory(address, 'ONE_MINUTE'),
        staleTime: 60 * 1000, // 1 minute
      });

      // Prefetch first page of trades
      queryClient.prefetchQuery({
        queryKey: queryKeys.tokens.trades(address, 1),
        queryFn: () => getTokenTrades(address, 1, 20),
        staleTime: 15 * 1000, // 15 seconds
      });

      // Prefetch first page of holders
      queryClient.prefetchQuery({
        queryKey: queryKeys.tokens.holders(address, 1),
        queryFn: () => getTokenHolders(address, 1, 20),
        staleTime: 60 * 1000, // 1 minute
      });
    },
    [queryClient]
  );

  return { prefetchToken };
}
