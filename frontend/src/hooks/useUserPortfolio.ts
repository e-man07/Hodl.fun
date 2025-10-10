'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI, ERC20_ABI } from '@/config/abis';

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

  const fetchUserTokens = useCallback(async () => {
    if (!userAddress || !window.ethereum) {
      setTokens([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const marketplace = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      // Get all token addresses from the marketplace
      const allTokenAddresses = await marketplace.getAllTokens();
      const userTokens: UserToken[] = [];

      for (const tokenAddress of allTokenAddresses) {
        try {
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ERC20_ABI,
            provider
          );

          // Get user's balance for this token
          const balance = await tokenContract.balanceOf(userAddress);
          
          // Only include tokens where user has a balance > 0
          if (balance > BigInt(0)) {
            const [name, symbol, decimals, totalSupply] = await Promise.all([
              tokenContract.name(),
              tokenContract.symbol(),
              tokenContract.decimals(),
              tokenContract.totalSupply(),
            ]);

            // Get token info from marketplace
            let tokenInfo;
            let price = 0;
            let isCreator = false;
            let createdAt: string | undefined;
            let reserveRatio: number | undefined;
            let reserveBalance: number | undefined;

            try {
              tokenInfo = await marketplace.getTokenInfo(tokenAddress);
              const priceInWei = await marketplace.getCurrentPrice(tokenAddress);
              price = parseFloat(ethers.formatEther(priceInWei));
              
              // Check if user is the creator
              isCreator = tokenInfo.creator.toLowerCase() === userAddress.toLowerCase();
              createdAt = new Date(Number(tokenInfo.launchTimestamp) * 1000).toISOString();
              reserveRatio = Number(tokenInfo.reserveRatio) / 100; // Convert from basis points
              reserveBalance = parseFloat(ethers.formatEther(tokenInfo.reserveBalance || BigInt(0)));
            } catch (infoError) {
              console.warn(`Failed to get token info for ${symbol}:`, infoError);
            }

            const balanceFormatted = ethers.formatUnits(balance, decimals);
            const numericBalance = parseFloat(balanceFormatted);
            const value = numericBalance * price;

            const userToken: UserToken = {
              address: tokenAddress,
              name,
              symbol,
              balance,
              balanceFormatted,
              decimals: Number(decimals),
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
          }
        } catch (tokenError) {
          console.warn(`Error processing token ${tokenAddress}:`, tokenError);
        }
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
      console.error('Failed to fetch user portfolio:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio data');
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]);

  // Fetch data when user address changes
  useEffect(() => {
    fetchUserTokens();
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
