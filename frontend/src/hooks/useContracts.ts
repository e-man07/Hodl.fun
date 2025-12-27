/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useCallback } from 'react';
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';
import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_FACTORY_ABI, TOKEN_MARKETPLACE_ABI, LAUNCHPAD_TOKEN_ABI } from '@/config/abis';
import { uploadMetadataToIPFS, createTokenMetadata } from '@/lib/ipfs';

// Types for contract interactions
export interface TokenParams {
  name: string;
  symbol: string;
  totalSupply: string;
  metadataURI?: string; // Optional, will be generated from IPFS upload
  reserveRatio: number;
  creator: string;
  description?: string;
  socialLinks?: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };
  logoFile?: File;
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
  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;

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

  // TokenFactory Contract Functions - UPDATED VERSION 2024-10-20
  const createToken = useCallback(async (params: TokenParams): Promise<{hash: string, tokenAddress?: string} | null> => {
    if (!pushChainClient || !isConnected) {
      setError('Wallet not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      let metadataURI = params.metadataURI;
      
      if (!metadataURI) {
        try {
          const metadata = await createTokenMetadata(
            params.name,
            params.description || 'Token created on hodl.fun',
            params.socialLinks,
            params.logoFile
          );
          metadataURI = await uploadMetadataToIPFS(metadata);
        } catch (ipfsError) {
          metadataURI = `data:application/json,{"name":"${params.name}","symbol":"${params.symbol}","description":"${params.description || 'Token created on hodl.fun'}","timestamp":"${Date.now()}"}`;
        }
      }

      const creationFee = PushChain.utils.helpers.parseUnits('0.01', 18);
      const reserveRatioInBasisPoints = params.reserveRatio * 100;
      
      const tokenParams = {
        name: params.name,
        symbol: params.symbol,
        totalSupply: PushChain.utils.helpers.parseUnits(params.totalSupply, 18),
        metadataURI: metadataURI,
        reserveRatio: BigInt(reserveRatioInBasisPoints),
        creator: params.creator,
      };
      
      const contractInterface = new ethers.Interface(TOKEN_FACTORY_ABI);
      const encodedData = contractInterface.encodeFunctionData('createToken', [tokenParams]);

      const result = await pushChainClient.universal.sendTransaction({
        to: CONTRACT_ADDRESSES.TokenFactory as `0x${string}`,
        value: creationFee,
        data: encodedData as `0x${string}`,
      });

      const tokenAddress: string | undefined = undefined;
      
      return {
        hash: result.hash,
        tokenAddress: tokenAddress
      };
    } catch (error) {
      console.error('❌ Token creation failed:', error);
      handleError(error, 'Failed to create token');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [pushChainClient, isConnected, connectionStatus, handleError]);

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
