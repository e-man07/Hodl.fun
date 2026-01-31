'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { createFallbackProvider } from '@/lib/rpcProvider';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI, TOKEN_FACTORY_ABI } from '@/config/abis';

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

// Push Chain REST API base URL
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

    setIsLoading(true);
    setError(null);

    try {
      // Use Push Chain RPC provider for reading data
      const provider = createFallbackProvider();
      const marketplace = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );
      const factory = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenFactory,
        TOKEN_FACTORY_ABI,
        provider
      );

      interface TokenBalanceFromAPI {
        token: {
          address_hash: string;
          name: string;
          symbol: string;
          decimals: string;
          total_supply: string;
          type?: string;
        };
        value: string; // This is the balance
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
          15000 // 15 second timeout
        );

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const apiData = await response.json();
        
        // Parse API response - the API returns an array directly
        if (Array.isArray(apiData)) {
          // Filter out tokens with zero balance
          tokenBalances = apiData.filter((item: TokenBalanceFromAPI) => {
            try {
              const balance = BigInt(item.value || '0');
              return balance > BigInt(0);
            } catch {
              return false;
            }
          });
        } else {
          tokenBalances = [];
        }
      } catch (apiError) {
        tokenBalances = [];
      }

      if (abortController.signal.aborted) {
        return;
      }

      let createdTokenAddresses: string[] = [];
      try {
        createdTokenAddresses = await withTimeout(
          factory.getTokensByCreator(normalizedAddress),
          10000
        );
      } catch (getCreatedError) {
        createdTokenAddresses = [];
      }

      if (abortController.signal.aborted) {
        return;
      }

      // Create a set of created token addresses for fast lookup
      const createdTokensSet = new Set(
        createdTokenAddresses.map((addr) => addr.toLowerCase())
      );

      // Process tokens with balances
      const userTokens: UserToken[] = [];
      
      if (tokenBalances.length === 0) {
        setTokens([]);
        setStats({
          totalValue: 0,
          totalPnL: 0,
          totalPnLPercentage: 0,
          tokensOwned: 0,
          tokensCreated: createdTokenAddresses.length,
        });
        setIsLoading(false);
        return;
      }

      // Process tokens in batches to avoid overwhelming the RPC
      const batchSize = 10;
      for (let i = 0; i < tokenBalances.length; i += batchSize) {
        if (abortController.signal.aborted) {
          return;
        }

        const batch = tokenBalances.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (tokenBalance) => {
            try {
              // Extract token address from API response structure
              const tokenAddressHash = tokenBalance.token?.address_hash;
              
              if (!tokenAddressHash) {
                return;
              }
              
              let tokenAddress = tokenAddressHash.toLowerCase().trim();
              
              if (!ethers.isAddress(tokenAddress)) {
                return;
              }
              
              // Normalize to lowercase for consistency
              tokenAddress = ethers.getAddress(tokenAddress).toLowerCase();

              // Get token metadata from API response (no need for RPC calls!)
              const apiTokenInfo = tokenBalance.token;
              const name = apiTokenInfo.name || 'Unknown Token';
              const symbol = apiTokenInfo.symbol || 'UNK';
              const decimals = Number(apiTokenInfo.decimals || '18');
              const totalSupply = BigInt(apiTokenInfo.total_supply || '0');

              // Parse balance from API response (using 'value' field)
              const balanceBigInt = BigInt(tokenBalance.value || '0');

              // Get token info from marketplace (for price, creator, etc.)
              let marketplaceTokenInfo;
              let price = 0;
              let isCreator = createdTokensSet.has(tokenAddress);
              let createdAt: string | undefined;
              let reserveRatio: number | undefined;
              let reserveBalance: number | undefined;

              try {
                marketplaceTokenInfo = await withTimeout(
                  marketplace.getTokenInfo(tokenAddress),
                  10000
                );
                const priceInWei = await withTimeout(
                  marketplace.getCurrentPrice(tokenAddress),
                  10000
                );
                price = parseFloat(ethers.formatEther(priceInWei));
                
                // Double-check if user is the creator
                if (!isCreator && marketplaceTokenInfo.creator) {
                  isCreator = marketplaceTokenInfo.creator.toLowerCase() === normalizedAddress;
                }
                
                createdAt = new Date(Number(marketplaceTokenInfo.launchTimestamp) * 1000).toISOString();
                reserveRatio = Number(marketplaceTokenInfo.reserveRatio) / 100;
                reserveBalance = parseFloat(ethers.formatEther(marketplaceTokenInfo.reserveBalance || BigInt(0)));
              } catch (infoError) {
                // Continue without marketplace info
              }

              const balanceFormatted = ethers.formatUnits(balanceBigInt, decimals);
              const numericBalance = parseFloat(balanceFormatted);
              const value = numericBalance * price;

              const userToken: UserToken = {
                address: tokenAddress,
                name,
                symbol,
                balance: balanceBigInt,
                balanceFormatted,
                decimals: decimals,
                price,
                value,
                priceChange24h: Math.random() * 20 - 10, // TODO: Replace with real 24h data
                isCreator,
                createdAt,
                totalSupply,
                reserveRatio,
                reserveBalance,
              };

              userTokens.push(userToken);
            } catch (tokenError) {
              // Skip failed tokens
            }
          })
        );
      }

      if (abortController.signal.aborted) {
        return;
      }

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
      if (abortController.signal.aborted) {
        return;
      }
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
