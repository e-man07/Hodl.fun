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
      console.log('🚀 Starting token creation with params (v2024-10-20):', params);
      console.log('📱 Push Chain client:', pushChainClient);
      console.log('🔗 Connection status:', connectionStatus);
      
      // Debug input parameters
      console.log('🔍 Input reserveRatio:', params.reserveRatio, 'type:', typeof params.reserveRatio);
      console.log('🔍 Input metadataURI:', params.metadataURI);

      // Create and upload metadata to IPFS
      console.log('📤 Creating metadata for IPFS upload...');
      let metadataURI = params.metadataURI;
      
      if (!metadataURI) {
        try {
          const metadata = await createTokenMetadata(
            params.name,
            params.description || 'Token created on hodl.fun',
            params.socialLinks,
            params.logoFile
          );

          console.log('📤 Uploading metadata to IPFS...');
          metadataURI = await uploadMetadataToIPFS(metadata);
          console.log('✅ Metadata uploaded to IPFS:', metadataURI);
        } catch (ipfsError) {
          console.warn('⚠️ IPFS upload failed, using fallback metadata:', ipfsError);
          // Fallback to data URI if IPFS fails
          metadataURI = `data:application/json,{"name":"${params.name}","symbol":"${params.symbol}","description":"${params.description || 'Token created on hodl.fun'}","timestamp":"${Date.now()}"}`;
        }
      }

      // Use fallback creation fee since we need to encode the transaction manually
      const creationFee = PushChain.utils.helpers.parseUnits('0.01', 18); // 0.01 PUSH
      console.log('💰 Using creation fee:', PushChain.utils.helpers.formatUnits(creationFee, 18), 'PUSH');

      // Prepare token parameters - FIXED VERSION 2024
      const reserveRatioInBasisPoints = params.reserveRatio * 100; // Convert 50% to 5000 basis points
      
      const tokenParams = {
        name: params.name,
        symbol: params.symbol,
        totalSupply: PushChain.utils.helpers.parseUnits(params.totalSupply, 18),
        metadataURI: metadataURI,
        reserveRatio: BigInt(reserveRatioInBasisPoints),
        creator: params.creator,
      };
      
      // Validate parameters before sending
      console.log('🔍 VALIDATION CHECK:');
      console.log('   Name length:', params.name.length, '(should be 3-50)');
      console.log('   Symbol length:', params.symbol.length, '(should be 2-10)');
      console.log('   Reserve ratio (input):', params.reserveRatio, '(should be 10-90)');
      console.log('   Reserve ratio (basis points):', reserveRatioInBasisPoints, '(should be 1000-9000)');
      console.log('   Metadata URI length:', tokenParams.metadataURI.length, '(should be > 0)');
      console.log('   Creator address:', params.creator, '(should not be 0x0)');

      console.log('📋 Token parameters prepared:', tokenParams);
      console.log('🔍 Final reserveRatio:', tokenParams.reserveRatio.toString());
      console.log('🔍 Final metadataURI:', tokenParams.metadataURI);

      // Create contract interface to encode function call
      const contractInterface = new ethers.Interface(TOKEN_FACTORY_ABI);
      const encodedData = contractInterface.encodeFunctionData('createToken', [tokenParams]);

      console.log('📝 Encoded transaction data:', encodedData);

      // Send transaction using Push Chain client
      console.log('📝 Sending transaction to contract...');
      const result = await pushChainClient.universal.sendTransaction({
        to: CONTRACT_ADDRESSES.TokenFactory as `0x${string}`,
        value: creationFee,
        data: encodedData as `0x${string}`,
      });

      console.log('✅ Token created successfully! Transaction hash:', result.hash);
      
      // For now, return just the hash. Token address extraction can be done separately
      console.log('💡 To get token address, check the transaction on block explorer:');
      console.log(`🔗 ${pushChainClient?.explorer?.getTransactionUrl?.(result.hash) || 'Block explorer URL not available'}`);
      
      // TODO: Implement proper transaction receipt parsing when Push Chain client supports it
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
