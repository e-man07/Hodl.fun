'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Token } from '@/types';

const MAX_RECENT_SEARCHES = 5;
const RECENT_SEARCHES_KEY = 'hodl_recent_searches';

export interface RecentSearch {
  address: string;
  name: string;
  symbol: string;
  image?: string;
}

/**
 * Hook for managing recent token searches with localStorage persistence
 * Lifted state from SearchModal component (patterns-lift-state rule)
 */
export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch {
          setRecentSearches([]);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  // Add a token to recent searches
  // Persist after state update, not inside setState callback (client-localstorage-schema rule)
  const addRecentSearch = useCallback((token: Token | RecentSearch) => {
    const newRecent: RecentSearch = {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      image: 'metadata' in token ? token.metadata?.image : (token as RecentSearch).image,
    };

    setRecentSearches((prev) => {
      const filtered = prev.filter((r) => r.address !== token.address);
      return [newRecent, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    });
  }, []);

  // Persist to localStorage when recentSearches changes (separate from render)
  useEffect(() => {
    if (!isLoaded) return;
    if (recentSearches.length > 0) {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
    } else {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    }
  }, [recentSearches, isLoaded]);

  // Clear all recent searches (localStorage handled by effect)
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
  }, []);

  // Remove a specific search (localStorage persisted via effect)
  const removeRecentSearch = useCallback((address: string) => {
    setRecentSearches((prev) => prev.filter((r) => r.address !== address));
  }, []);

  return {
    recentSearches,
    isLoaded,
    addRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
  };
}
