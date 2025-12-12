'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTokens } from '@/lib/api/tokens';
import { getMarketStats } from '@/lib/api/market';
import { TokenData } from '@/lib/api/types';

interface MarketplaceToken {
  address: string;
  name: string;
  symbol: string;
  description: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  createdAt: string;
  creator: string;
  reserveRatio: number;
  isTrading: boolean;
  logo?: string;
  currentSupply: number;
  totalSupply: number;
  reserveBalance: number;
}

interface UseMarketplaceBackendReturn {
  tokens: MarketplaceToken[];
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  refreshTokens: () => Promise<void>;
  totalTokens: number;
  currentPage: number;
  totalPages: number;
  loadPage: (page: number) => void;
  aggregateStats: {
    totalMarketCap: number;
    tradingTokens: number;
    totalVolume24h: number;
    totalHolders: number;
  };
}

/**
 * Hook to fetch marketplace tokens from backend API
 * This replaces direct RPC calls with backend API calls for better performance
 */
export const useMarketplaceBackend = (): UseMarketplaceBackendReturn => {
  const [tokens, setTokens] = useState<MarketplaceToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTokens, setTotalTokens] = useState(0);
  const [aggregateStats, setAggregateStats] = useState({
    totalMarketCap: 0,
    tradingTokens: 0,
    totalVolume24h: 0,
    totalHolders: 0,
  });

  const tokensPerPage = 24;

  // Fetch market stats
  const fetchMarketStats = useCallback(async () => {
    try {
      const response = await getMarketStats();
      if (response.success) {
        setAggregateStats({
          totalMarketCap: response.data.totalMarketCap || 0,
          tradingTokens: response.data.totalTokens || 0,
          totalVolume24h: response.data.totalVolume24h || 0,
          totalHolders: response.data.totalHolders || 0,
        });
      }
    } catch (err) {
      console.warn('Failed to fetch market stats:', err);
      // Don't set error state - stats are optional
    }
  }, []);

  // Convert backend TokenData to MarketplaceToken format
  // Backend now returns properly formatted data after fixes
  const convertToMarketplaceToken = (token: TokenData): MarketplaceToken => {
    // Parse supply values - backend now returns formatted strings (e.g., "32.0")
    const currentSupply = parseFloat(token.currentSupply) || 0;
    const totalSupply = parseFloat(token.totalSupply) || 0;
    const reserveBalance = parseFloat(token.reserveBalance) || 0;

    // Reserve ratio is still in basis points from contract (e.g., 500000 for 50%)
    // Convert to percentage for display
    const reserveRatio = token.reserveRatio / 10000;

    return {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      description: token.description || '',
      price: token.price,
      priceChange24h: token.priceChange24h,
      marketCap: token.marketCap,
      volume24h: token.volume24h,
      holders: token.holders,
      createdAt: token.createdAt,
      creator: token.creator,
      reserveRatio: reserveRatio,
      isTrading: token.tradingEnabled,
      logo: token.logo,
      currentSupply: currentSupply,
      totalSupply: totalSupply,
      reserveBalance: reserveBalance,
    };
  };

  // Fetch tokens for current page
  const fetchTokens = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔍 Fetching tokens from backend API (page ${page})...`);

      const response = await getTokens({
        page,
        limit: tokensPerPage,
        sort: 'marketCap',
        order: 'desc',
      });

      if (response.success) {
        const marketplaceTokens = response.data.map(convertToMarketplaceToken);
        setTokens(marketplaceTokens);
        setTotalTokens(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
        setCurrentPage(page);

        console.log(`✅ Loaded ${marketplaceTokens.length} tokens (page ${page}/${response.pagination.totalPages})`);
      } else {
        throw new Error('Failed to fetch tokens from backend');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tokens';
      console.error('❌ Error fetching tokens from backend:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
    }
  }, [tokensPerPage]);

  // Load specific page
  const loadPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchTokens(page);
    }
  }, [totalPages, fetchTokens]);

  // Refresh tokens (reload current page + stats)
  const refreshTokens = useCallback(async () => {
    await Promise.all([
      fetchTokens(currentPage),
      fetchMarketStats(),
    ]);
  }, [currentPage, fetchTokens, fetchMarketStats]);

  // Initial load
  useEffect(() => {
    fetchTokens(1);
    fetchMarketStats();
  }, [fetchTokens, fetchMarketStats]);

  return {
    tokens,
    isLoading,
    isInitializing,
    error,
    refreshTokens,
    totalTokens,
    currentPage,
    totalPages,
    loadPage,
    aggregateStats,
  };
};
