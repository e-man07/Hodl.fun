/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useCallback } from 'react';
import { usePushWalletContext, usePushChainClient } from '@pushchain/ui-kit';
import { PushChain } from '@pushchain/core';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_FACTORY_ABI, TOKEN_MARKETPLACE_ABI, LAUNCHPAD_TOKEN_ABI } from '@/config/abis';

// Types for contract interactions
export interface TokenParams {
  name: string;
  symbol: string;
  totalSupply: string;
  metadataURI: string;
  reserveRatio: number;
  creator: string;
}

export interface TokenInfo {
  tokenAddress: string;
  creator: string;
  metadataURI: string;
  totalSupply: bigint;
  currentSupply: bigint;
  reserveBalance: bigint;
  reserveRatio: bigint;
  tradingEnabled: boolean;
  launchTimestamp: bigint;
  marketCap: bigint;
}

export const useContracts = () => {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is connected
  const isConnected = String(connectionStatus).toLowerCase() === 'connected';

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // Handle errors
  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    console.error(defaultMessage, error);
    if (error instanceof Error) {
      setError(error.message);
    } else {
      setError(defaultMessage);
    }
  }, []);

  // TokenFactory Contract Functions
  const createToken = useCallback(async (params: TokenParams): Promise<string | null> => {
    if (!pushChainClient || !isConnected) {
      setError('Wallet not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get creation fee
      // TODO: Fix Push Chain client integration
      // const creationFeeResult = await pushChainClient.universal.readContract({
      //   address: CONTRACT_ADDRESSES.TokenFactory,
      //   abi: TOKEN_FACTORY_ABI,
      //   functionName: 'creationFee',
      // });
      
      // Temporary fallback
      const creationFeeResult = BigInt('10000000000000000'); // 0.01 ETH

      const creationFee = creationFeeResult as bigint;

      // Prepare token parameters
      const tokenParams = {
        name: params.name,
        symbol: params.symbol,
        totalSupply: PushChain.utils.helpers.parseUnits(params.totalSupply, 18),
        metadataURI: params.metadataURI,
        reserveRatio: BigInt(params.reserveRatio),
        creator: params.creator,
      };

      // Create token
      const result = await (pushChainClient as any).universal.writeContract({
        address: CONTRACT_ADDRESSES.TokenFactory,
        abi: TOKEN_FACTORY_ABI,
        functionName: 'createToken',
        args: [tokenParams],
        value: creationFee,
      });

      console.log('✅ Token created successfully:', result.hash);
      return result.hash;
    } catch (error) {
      handleError(error, 'Failed to create token');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [pushChainClient, isConnected, handleError]);

  // Get tokens by creator
  const getTokensByCreator = useCallback(async (creator: string): Promise<string[]> => {
    if (!pushChainClient) return [];

    try {
      const result = await (pushChainClient as any).universal.readContract({
        address: CONTRACT_ADDRESSES.TokenFactory,
        abi: TOKEN_FACTORY_ABI,
        functionName: 'getTokensByCreator',
        args: [creator],
      });

      return result as string[];
    } catch (error) {
      handleError(error, 'Failed to fetch creator tokens');
      return [];
    }
  }, [pushChainClient, handleError]);

  // TokenMarketplace Contract Functions
  const buyTokens = useCallback(async (
    tokenAddress: string, 
    ethAmount: string, 
    minTokensOut: string
  ): Promise<string | null> => {
    if (!pushChainClient || !isConnected) {
      setError('Wallet not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await (pushChainClient as any).universal.writeContract({
        address: CONTRACT_ADDRESSES.TokenMarketplace,
        abi: TOKEN_MARKETPLACE_ABI,
        functionName: 'buyTokens',
        args: [tokenAddress, PushChain.utils.helpers.parseUnits(minTokensOut, 18)],
        value: PushChain.utils.helpers.parseUnits(ethAmount, 18),
      });

      console.log('✅ Tokens bought successfully:', result.hash);
      return result.hash;
    } catch (error) {
      handleError(error, 'Failed to buy tokens');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [pushChainClient, isConnected, handleError]);

  const sellTokens = useCallback(async (
    tokenAddress: string,
    tokenAmount: string,
    minEthOut: string
  ): Promise<string | null> => {
    if (!pushChainClient || !isConnected) {
      setError('Wallet not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First approve tokens for marketplace
      await (pushChainClient as any).universal.writeContract({
        address: tokenAddress,
        abi: LAUNCHPAD_TOKEN_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.TokenMarketplace, PushChain.utils.helpers.parseUnits(tokenAmount, 18)],
      });

      // Then sell tokens
      const result = await (pushChainClient as any).universal.writeContract({
        address: CONTRACT_ADDRESSES.TokenMarketplace,
        abi: TOKEN_MARKETPLACE_ABI,
        functionName: 'sellTokens',
        args: [
          tokenAddress,
          PushChain.utils.helpers.parseUnits(tokenAmount, 18),
          PushChain.utils.helpers.parseUnits(minEthOut, 18)
        ],
      });

      console.log('✅ Tokens sold successfully:', result.hash);
      return result.hash;
    } catch (error) {
      handleError(error, 'Failed to sell tokens');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [pushChainClient, isConnected, handleError]);

  // Get token info
  const getTokenInfo = useCallback(async (tokenAddress: string): Promise<TokenInfo | null> => {
    if (!pushChainClient) return null;

    try {
      const result = await (pushChainClient as any).universal.readContract({
        address: CONTRACT_ADDRESSES.TokenMarketplace,
        abi: TOKEN_MARKETPLACE_ABI,
        functionName: 'getTokenInfo',
        args: [tokenAddress],
      });

      return result as TokenInfo;
    } catch (error) {
      handleError(error, 'Failed to fetch token info');
      return null;
    }
  }, [pushChainClient, handleError]);

  // Calculate purchase return
  const calculatePurchaseReturn = useCallback(async (
    tokenAddress: string,
    ethAmount: string
  ): Promise<string | null> => {
    if (!pushChainClient) return null;

    try {
      const result = await (pushChainClient as any).universal.readContract({
        address: CONTRACT_ADDRESSES.TokenMarketplace,
        abi: TOKEN_MARKETPLACE_ABI,
        functionName: 'calculatePurchaseReturn',
        args: [tokenAddress, PushChain.utils.helpers.parseUnits(ethAmount, 18)],
      });

      return PushChain.utils.helpers.formatUnits(result as bigint, 18);
    } catch (error) {
      handleError(error, 'Failed to calculate purchase return');
      return null;
    }
  }, [pushChainClient, handleError]);

  // Calculate sale return
  const calculateSaleReturn = useCallback(async (
    tokenAddress: string,
    tokenAmount: string
  ): Promise<string | null> => {
    if (!pushChainClient) return null;

    try {
      const result = await (pushChainClient as any).universal.readContract({
        address: CONTRACT_ADDRESSES.TokenMarketplace,
        abi: TOKEN_MARKETPLACE_ABI,
        functionName: 'calculateSaleReturn',
        args: [tokenAddress, PushChain.utils.helpers.parseUnits(tokenAmount, 18)],
      });

      return PushChain.utils.helpers.formatUnits(result as bigint, 18);
    } catch (error) {
      handleError(error, 'Failed to calculate sale return');
      return null;
    }
  }, [pushChainClient, handleError]);

  // Get current price
  const getCurrentPrice = useCallback(async (tokenAddress: string): Promise<string | null> => {
    if (!pushChainClient) return null;

    try {
      const result = await (pushChainClient as any).universal.readContract({
        address: CONTRACT_ADDRESSES.TokenMarketplace,
        abi: TOKEN_MARKETPLACE_ABI,
        functionName: 'getCurrentPrice',
        args: [tokenAddress],
      });

      return PushChain.utils.helpers.formatUnits(result as bigint, 18);
    } catch (error) {
      handleError(error, 'Failed to get current price');
      return null;
    }
  }, [pushChainClient, handleError]);

  // Get all tokens
  const getAllTokens = useCallback(async (): Promise<string[]> => {
    if (!pushChainClient) return [];

    try {
      const result = await (pushChainClient as any).universal.readContract({
        address: CONTRACT_ADDRESSES.TokenMarketplace,
        abi: TOKEN_MARKETPLACE_ABI,
        functionName: 'getAllTokens',
      });

      return result as string[];
    } catch (error) {
      handleError(error, 'Failed to fetch all tokens');
      return [];
    }
  }, [pushChainClient, handleError]);

  // Get token balance
  const getTokenBalance = useCallback(async (
    tokenAddress: string,
    userAddress: string
  ): Promise<string | null> => {
    if (!pushChainClient) return null;

    try {
      const result = await (pushChainClient as any).universal.readContract({
        address: tokenAddress,
        abi: LAUNCHPAD_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });

      return PushChain.utils.helpers.formatUnits(result as bigint, 18);
    } catch (error) {
      handleError(error, 'Failed to get token balance');
      return null;
    }
  }, [pushChainClient, handleError]);

  return {
    // State
    isLoading,
    error,
    isConnected,
    pushChainClient,
    
    // Actions
    clearError,
    
    // TokenFactory functions
    createToken,
    getTokensByCreator,
    
    // TokenMarketplace functions
    buyTokens,
    sellTokens,
    getTokenInfo,
    calculatePurchaseReturn,
    calculateSaleReturn,
    getCurrentPrice,
    getAllTokens,
    
    // Token functions
    getTokenBalance,
  };
};
