import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePrefetchToken } from './use-prefetch-token';

// Mock tanstack/react-query
const mockPrefetchQuery = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    prefetchQuery: mockPrefetchQuery,
  }),
}));

// Mock API functions
vi.mock('@/lib/api/tokens', () => ({
  getToken: vi.fn(),
  getTokenTrades: vi.fn(),
  getTokenHolders: vi.fn(),
  getTokenPriceHistory: vi.fn(),
}));

// Mock query keys
vi.mock('@/queries/keys', () => ({
  queryKeys: {
    tokens: {
      detail: (address: string) => ['tokens', address],
      priceHistory: (address: string, interval: string) => ['tokens', address, 'price', interval],
      trades: (address: string, page: number) => ['tokens', address, 'trades', page],
      holders: (address: string, page: number) => ['tokens', address, 'holders', page],
    },
  },
}));

describe('usePrefetchToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return prefetchToken function', () => {
    const { result } = renderHook(() => usePrefetchToken());

    expect(result.current.prefetchToken).toBeDefined();
    expect(typeof result.current.prefetchToken).toBe('function');
  });

  it('should prefetch token data when called', () => {
    const { result } = renderHook(() => usePrefetchToken());

    result.current.prefetchToken('0x123');

    // Should call prefetchQuery 4 times (details, price history, trades, holders)
    expect(mockPrefetchQuery).toHaveBeenCalledTimes(4);
  });

  it('should prefetch token details with correct query key', () => {
    const { result } = renderHook(() => usePrefetchToken());

    result.current.prefetchToken('0xabc');

    expect(mockPrefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['tokens', '0xabc'],
        staleTime: 30 * 1000,
      })
    );
  });

  it('should prefetch price history with ONE_MINUTE interval', () => {
    const { result } = renderHook(() => usePrefetchToken());

    result.current.prefetchToken('0x456');

    expect(mockPrefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['tokens', '0x456', 'price', 'ONE_MINUTE'],
        staleTime: 60 * 1000,
      })
    );
  });

  it('should prefetch trades for page 1', () => {
    const { result } = renderHook(() => usePrefetchToken());

    result.current.prefetchToken('0x789');

    expect(mockPrefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['tokens', '0x789', 'trades', 1],
        staleTime: 15 * 1000,
      })
    );
  });

  it('should prefetch holders for page 1', () => {
    const { result } = renderHook(() => usePrefetchToken());

    result.current.prefetchToken('0xdef');

    expect(mockPrefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['tokens', '0xdef', 'holders', 1],
        staleTime: 60 * 1000,
      })
    );
  });

  it('should handle multiple prefetch calls', () => {
    const { result } = renderHook(() => usePrefetchToken());

    // Call prefetch for different addresses
    result.current.prefetchToken('0xaaa');
    result.current.prefetchToken('0xbbb');

    // Each call should trigger 4 prefetch queries
    expect(mockPrefetchQuery).toHaveBeenCalledTimes(8);
  });
});
