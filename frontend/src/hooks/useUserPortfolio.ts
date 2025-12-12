'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserPortfolio, getUserCreatedTokens } from '@/lib/api/users';
import { getTokensBatch } from '@/lib/api/tokens';
import { TokenData } from '@/lib/api/types';

export interface UserToken {
  address: string;
  name: string;
  symbol: string;
  balance: bigint;
  balanceFormatted: string;
  decimals: number;
  price: number;
  value: number;
  priceChange24h: number;
  isCreator: boolean;
  createdAt?: string;
  marketCap?: number;
  holders?: number;
  totalSupply?: bigint;
  reserveBalance?: number;
  reserveRatio?: number;
}

export interface PortfolioStats {
  totalValue: number;
  totalPnL: number;
  totalPnLPercentage: number;
  tokensOwned: number;
  tokensCreated: number;
}

// Helper function to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

// Push Chain REST API base URL for token balances (still needed - backend doesn't track all ERC20 balances)
const PUSH_CHAIN_API_BASE = 'https://donut.push.network/api/v2';

export const useUserPortfolio = (userAddress: string | null) => {
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [stats, setStats] = useState<PortfolioStats>({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercentage: 0,
    tokensOwned: 0,
    tokensCreated: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchUserTokens = useCallback(async () => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Normalize address to lowercase for consistency
    const normalizedAddress = userAddress?.toLowerCase() || null;

    if (!normalizedAddress) {
      console.log('⚠️ No user address provided, clearing portfolio');
      setTokens([]);
      setStats({
        totalValue: 0,
        totalPnL: 0,
        totalPnLPercentage: 0,
        tokensOwned: 0,
        tokensCreated: 0,
      });
      setIsLoading(false);
      return;
    }

    console.log('🔄 Fetching user portfolio for:', normalizedAddress);
    setIsLoading(true);
    setError(null);

    try {
      // Strategy 1: Try backend API first (fast, has PnL data)
      let backendPortfolio = null;
      let backendCreatedTokens: string[] = [];

      try {
        console.log('📋 Fetching portfolio from backend API...');
        const [portfolioResponse, createdResponse] = await Promise.all([
          withTimeout(getUserPortfolio(normalizedAddress), 10000),
          withTimeout(getUserCreatedTokens(normalizedAddress), 10000),
        ]);

        if (portfolioResponse.success && portfolioResponse.data) {
          backendPortfolio = portfolioResponse.data;
          console.log(`✅ Backend portfolio: ${backendPortfolio.tokens.length} tokens`);
        }

        if (createdResponse.success && createdResponse.data) {
          backendCreatedTokens = createdResponse.data.tokens.map(t => t.address.toLowerCase());
          console.log(`✅ Backend created tokens: ${backendCreatedTokens.length}`);
        }
      } catch (backendError) {
        console.warn('⚠️ Backend portfolio fetch failed, falling back to Push API:', backendError);
      }

      // Check if request was aborted
      if (abortController.signal.aborted) {
        console.log('🛑 Request aborted');
        return;
      }

      // Strategy 2: Fetch token balances using Push Chain REST API (comprehensive)
      // This catches tokens not yet indexed by backend
      console.log('📋 Fetching token balances from Push Chain API...');
      interface TokenBalanceFromAPI {
        token: {
          address_hash: string;
          name: string;
          symbol: string;
          decimals: string;
          total_supply: string;
          type?: string;
        };
        value: string;
        token_id?: string | null;
        token_instance?: string | null;
      }

      let tokenBalances: TokenBalanceFromAPI[] = [];
      try {
        const apiUrl = `${PUSH_CHAIN_API_BASE}/addresses/${normalizedAddress}/token-balances`;
        const response = await withTimeout(
          fetch(apiUrl, {
            method: 'GET',
            headers: {
              'accept': 'application/json',
            },
            signal: abortController.signal,
          }),
          15000
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const apiData = await response.json();

        if (Array.isArray(apiData)) {
          tokenBalances = apiData.filter((item: TokenBalanceFromAPI) => {
            try {
              const balance = BigInt(item.value || '0');
              return balance > BigInt(0);
            } catch {
              return false;
            }
          });
        }

        console.log(`✅ Found ${tokenBalances.length} tokens with balance > 0 from Push API`);
      } catch (apiError) {
        console.warn('⚠️ Failed to fetch token balances from Push API:', apiError);
      }

      // Check if request was aborted
      if (abortController.signal.aborted) {
        console.log('🛑 Request aborted');
        return;
      }

      if (tokenBalances.length === 0 && (!backendPortfolio || backendPortfolio.tokens.length === 0)) {
        console.log('ℹ️ No tokens with balance found');
        setTokens([]);
        setStats({
          totalValue: 0,
          totalPnL: 0,
          totalPnLPercentage: 0,
          tokensOwned: 0,
          tokensCreated: backendCreatedTokens.length,
        });
        setIsLoading(false);
        return;
      }

      // Create maps for efficient lookup
      const backendTokenMap = new Map(
        backendPortfolio?.tokens.map(t => [t.address.toLowerCase(), t]) || []
      );
      const createdTokensSet = new Set(backendCreatedTokens);

      // Collect all unique token addresses
      const allTokenAddresses = new Set<string>();
      tokenBalances.forEach(tb => {
        const addr = tb.token?.address_hash?.toLowerCase();
        if (addr) allTokenAddresses.add(addr);
      });
      backendPortfolio?.tokens.forEach(t => {
        allTokenAddresses.add(t.address.toLowerCase());
      });

      console.log(`🔍 Processing ${allTokenAddresses.size} unique tokens...`);

      // Fetch token details from backend in batch (efficient)
      const addressArray = Array.from(allTokenAddresses);
      const tokenDetailsMap = new Map<string, TokenData>();

      try {
        const batchResponse = await withTimeout(getTokensBatch(addressArray), 15000);
        if (batchResponse.success && batchResponse.data?.tokens) {
          batchResponse.data.tokens.forEach(token => {
            tokenDetailsMap.set(token.address.toLowerCase(), token);
          });
          console.log(`✅ Fetched ${tokenDetailsMap.size} token details from backend batch API`);
        }
      } catch (batchError) {
        console.warn('⚠️ Batch token fetch failed, will use Push API data:', batchError);
      }

      // Check if request was aborted
      if (abortController.signal.aborted) {
        console.log('🛑 Request aborted');
        return;
      }

      // Process tokens
      const userTokens: UserToken[] = [];

      for (const tokenBalance of tokenBalances) {
        try {
          const tokenAddressHash = tokenBalance.token?.address_hash;
          if (!tokenAddressHash) continue;

          const tokenAddress = tokenAddressHash.toLowerCase().trim();
          const apiTokenInfo = tokenBalance.token;

          // Get balance from Push API (real-time)
          const balanceBigInt = BigInt(tokenBalance.value || '0');
          const decimals = Number(apiTokenInfo.decimals || '18');
          const balanceFormatted = (Number(balanceBigInt) / Math.pow(10, decimals)).toString();
          const numericBalance = parseFloat(balanceFormatted);

          // Get token details from backend (accurate prices, PnL)
          const backendToken = backendTokenMap.get(tokenAddress);
          const batchToken = tokenDetailsMap.get(tokenAddress);

          // Determine values - prefer backend data
          let price = 0;
          let priceChange24h = 0;
          let marketCap = 0;
          let holders = 0;
          let reserveRatio = 0;
          let reserveBalance = 0;
          let createdAt: string | undefined;
          let isCreator = createdTokensSet.has(tokenAddress);

          if (batchToken) {
            price = batchToken.price || 0;
            priceChange24h = batchToken.priceChange24h || 0;
            marketCap = batchToken.marketCap || 0;
            holders = batchToken.holders || 0;
            reserveRatio = batchToken.reserveRatio ? batchToken.reserveRatio / 10000 : 0;
            reserveBalance = parseFloat(batchToken.reserveBalance) || 0;
            createdAt = batchToken.createdAt;
            if (batchToken.creator?.toLowerCase() === normalizedAddress) {
              isCreator = true;
            }
          }

          // Override with backend portfolio data if available (has PnL tracking)
          if (backendToken) {
            price = backendToken.price || price;
            priceChange24h = backendToken.priceChange24h || priceChange24h;
            isCreator = backendToken.isCreator || isCreator;
          }

          const value = numericBalance * price;

          const userToken: UserToken = {
            address: tokenAddress,
            name: apiTokenInfo.name || batchToken?.name || 'Unknown Token',
            symbol: apiTokenInfo.symbol || batchToken?.symbol || 'UNK',
            balance: balanceBigInt,
            balanceFormatted,
            decimals,
            price,
            value,
            priceChange24h,
            isCreator,
            createdAt,
            marketCap,
            holders,
            totalSupply: BigInt(apiTokenInfo.total_supply || '0'),
            reserveRatio,
            reserveBalance,
          };

          userTokens.push(userToken);
        } catch (tokenError) {
          console.warn(`⚠️ Error processing token:`, tokenError);
        }
      }

      // Check if request was aborted before setting state
      if (abortController.signal.aborted) {
        console.log('🛑 Request aborted before updating state');
        return;
      }

      console.log(`✅ Found ${userTokens.length} tokens with balance > 0`);

      setTokens(userTokens);

      // Calculate portfolio stats
      const totalValue = userTokens.reduce((sum, token) => sum + token.value, 0);
      const totalPnL = userTokens.reduce((sum, token) => {
        const change = (token.priceChange24h / 100) * token.value;
        return sum + change;
      }, 0);
      const totalPnLPercentage = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;
      const tokensCreated = userTokens.filter(token => token.isCreator).length;

      setStats({
        totalValue,
        totalPnL,
        totalPnLPercentage,
        tokensOwned: userTokens.length,
        tokensCreated,
      });

    } catch (err) {
      // Don't set error if request was aborted
      if (abortController.signal.aborted) {
        console.log('🛑 Request was aborted');
        return;
      }

      console.error('❌ Failed to fetch user portfolio:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch portfolio data';
      setError(errorMessage);
    } finally {
      // Only update loading state if request wasn't aborted
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [userAddress]);

  // Fetch data when user address changes
  useEffect(() => {
    fetchUserTokens();

    // Cleanup: abort request on unmount or when userAddress changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchUserTokens]);

  const refreshPortfolio = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    fetchUserTokens();
  }, [fetchUserTokens]);

  return {
    tokens,
    stats,
    isLoading,
    error,
    refreshPortfolio,
  };
};
