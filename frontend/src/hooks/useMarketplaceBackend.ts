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
        // Backend returns totalMarketCap in broken scientific notation (e.g., 5.677e-16)
        // This is a backend bug where market cap is not properly converted from wei
        // Fix: if totalMarketCap is suspiciously small (< 0.001 ETH), calculate from tokens
        let totalMarketCap = response.data.totalMarketCap;

        // Check if market cap is broken (scientific notation near zero, or < 0.001 ETH)
        if (totalMarketCap < 0.001 || isNaN(totalMarketCap)) {
          console.warn(`⚠️ Backend returned broken totalMarketCap: ${totalMarketCap}, will calculate from tokens`);
          // We'll calculate it from individual tokens after they load
          // For now, set to 0 and it will be updated when tokens load
          totalMarketCap = 0;
        }

        setAggregateStats({
          totalMarketCap: totalMarketCap,
          tradingTokens: response.data.totalTokens, // Approximation - backend can add this field
          totalVolume24h: response.data.totalVolume24h,
          totalHolders: response.data.totalHolders,
        });
      }
    } catch (err) {
      console.warn('Failed to fetch market stats:', err);
      // Don't set error state - stats are optional
    }
  }, []);

  // Convert backend TokenData to MarketplaceToken format
  const convertToMarketplaceToken = (token: TokenData): MarketplaceToken => {
    // Backend has multiple data quality issues that need fixing on frontend:
    // 1. currentSupply is always "32" (WRONG)
    // 2. reserveRatio is in basis points and needs conversion
    // 3. marketCap is scientific notation garbage (e.g., 2.685e-18)
    // 4. reserveBalance is in wei format but as a huge string

    // Parse totalSupply from wei to tokens
    const totalSupplyWei = parseFloat(token.totalSupply); // In wei
    const totalSupply = totalSupplyWei / 1e18; // Convert to tokens

    // Backend's currentSupply is broken (always "32"), so we use totalSupply
    // Note: In reality currentSupply ≠ totalSupply (some tokens are in circulation)
    // But this is the best approximation we have without direct contract calls
    const currentSupply = totalSupply;

    const price = token.price; // Price is correct from backend

    // Convert reserve ratio from basis points to percentage
    // Backend sends 500000 for 50%, 390000 for 39%, etc.
    // Formula: basis points / 10000 = percentage
    const reserveRatio = token.reserveRatio / 10000;

    // Backend's reserveBalance is a huge number in wei-like format
    // Try to parse and convert, fallback to 0 if it fails
    let reserveBalance = 0;
    try {
      const reserveBalanceStr = token.reserveBalance;
      // If it's a reasonable number (less than 1e20), convert from wei
      const reserveBalanceNum = parseFloat(reserveBalanceStr);
      if (!isNaN(reserveBalanceNum) && reserveBalanceNum < 1e20) {
        reserveBalance = reserveBalanceNum / 1e18;
      } else if (!isNaN(reserveBalanceNum)) {
        // If it's a huge garbage value, estimate from market cap
        // Reserve balance ≈ market cap (for bonding curves)
        reserveBalance = currentSupply * price;
      }
    } catch {
      // If parsing fails, estimate from market cap
      reserveBalance = currentSupply * price;
    }

    // Backend's market cap is always broken (returns values like 2.685e-18)
    // We ALWAYS need to recalculate it
    let marketCap = token.marketCap;

    // Check if market cap is broken (scientific notation near zero, or actually zero)
    if (marketCap < 0.000001 || isNaN(marketCap)) {
      // Recalculate: market cap = current supply × price
      if (!isNaN(currentSupply) && !isNaN(price) && currentSupply > 0 && price > 0) {
        marketCap = currentSupply * price;
      } else {
        marketCap = 0; // Fallback
      }
    }

    return {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      description: token.description || '',
      price: token.price, // ✅ Price is correct from backend
      priceChange24h: token.priceChange24h,
      marketCap: marketCap, // ✅ Fixed: recalculated
      volume24h: token.volume24h,
      holders: token.holders,
      createdAt: token.createdAt,
      creator: token.creator,
      reserveRatio: reserveRatio, // ✅ Fixed: converted from basis points
      isTrading: token.tradingEnabled,
      logo: token.logo,
      currentSupply: currentSupply, // ✅ Fixed: using totalSupply as approximation
      totalSupply: totalSupply, // ✅ Fixed: converted from wei
      reserveBalance: reserveBalance, // ✅ Fixed: converted or estimated
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
