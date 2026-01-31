import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Token } from '@/types';
import { useRecentSearches } from './use-recent-searches';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useRecentSearches', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should initialize with empty array when no saved data', () => {
    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.recentSearches).toEqual([]);
    expect(result.current.isLoaded).toBe(true);
  });

  it('should load saved searches from localStorage', () => {
    const savedSearches = [
      { address: '0x123', name: 'Token1', symbol: 'TK1' },
      { address: '0x456', name: 'Token2', symbol: 'TK2' },
    ];
    localStorageMock.setItem('hodl_recent_searches', JSON.stringify(savedSearches));

    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.recentSearches).toEqual(savedSearches);
  });

  it('should handle invalid JSON in localStorage gracefully', () => {
    localStorageMock.setItem('hodl_recent_searches', 'invalid json');

    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.recentSearches).toEqual([]);
  });

  it('should add a recent search from Token', () => {
    const { result } = renderHook(() => useRecentSearches());

    const token: Token = {
      address: '0x123',
      name: 'Test Token',
      symbol: 'TEST',
      creator: '0xabc',
      createdAt: new Date().toISOString(),
      status: 'TRADING',
      price: '1000000000000000000',
      marketCap: '1000000000000000000000',
      priceChange24h: 5.5,
      volume24h: '500000000000000000000',
      metadata: { image: 'ipfs://image' },
    };

    act(() => {
      result.current.addRecentSearch(token);
    });

    expect(result.current.recentSearches).toHaveLength(1);
    expect(result.current.recentSearches[0]).toEqual({
      address: '0x123',
      name: 'Test Token',
      symbol: 'TEST',
      image: 'ipfs://image',
    });
  });

  it('should add a recent search from RecentSearch', () => {
    const { result } = renderHook(() => useRecentSearches());

    const recentSearch = {
      address: '0x789',
      name: 'Recent Token',
      symbol: 'REC',
      image: 'ipfs://recent-image',
    };

    act(() => {
      result.current.addRecentSearch(recentSearch);
    });

    expect(result.current.recentSearches).toHaveLength(1);
    expect(result.current.recentSearches[0]).toEqual(recentSearch);
  });

  it('should move existing search to front when added again', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch({ address: '0x1', name: 'Token1', symbol: 'T1' });
      result.current.addRecentSearch({ address: '0x2', name: 'Token2', symbol: 'T2' });
      result.current.addRecentSearch({ address: '0x1', name: 'Token1', symbol: 'T1' });
    });

    expect(result.current.recentSearches).toHaveLength(2);
    expect(result.current.recentSearches[0].address).toBe('0x1');
    expect(result.current.recentSearches[1].address).toBe('0x2');
  });

  it('should limit to 5 recent searches', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.addRecentSearch({
          address: `0x${i}`,
          name: `Token${i}`,
          symbol: `T${i}`,
        });
      }
    });

    expect(result.current.recentSearches).toHaveLength(5);
    // Most recent should be first
    expect(result.current.recentSearches[0].address).toBe('0x6');
  });

  it('should clear all recent searches', async () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch({ address: '0x1', name: 'Token1', symbol: 'T1' });
      result.current.addRecentSearch({ address: '0x2', name: 'Token2', symbol: 'T2' });
    });

    expect(result.current.recentSearches).toHaveLength(2);

    act(() => {
      result.current.clearRecentSearches();
    });

    expect(result.current.recentSearches).toEqual([]);
    // localStorage removal is handled by effect, which runs after state update
  });

  it('should remove a specific search', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch({ address: '0x1', name: 'Token1', symbol: 'T1' });
      result.current.addRecentSearch({ address: '0x2', name: 'Token2', symbol: 'T2' });
    });

    act(() => {
      result.current.removeRecentSearch('0x1');
    });

    expect(result.current.recentSearches).toHaveLength(1);
    expect(result.current.recentSearches[0].address).toBe('0x2');
  });

  it('should persist to localStorage on add', () => {
    const { result } = renderHook(() => useRecentSearches());

    act(() => {
      result.current.addRecentSearch({ address: '0x1', name: 'Token1', symbol: 'T1' });
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'hodl_recent_searches',
      expect.any(String)
    );

    const savedData = JSON.parse(
      localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]
    );
    expect(savedData[0].address).toBe('0x1');
  });
});
