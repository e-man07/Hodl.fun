'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI, LAUNCHPAD_TOKEN_ABI } from '@/config/abis';
import { usePushWalletContext, usePushChainClient, PushUI } from '@pushchain/ui-kit';

interface TradeResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export const useTokenTrading = () => {
  const { connectionStatus } = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  
  const isConnected = connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const address = pushChainClient?.universal?.account;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create provider using Push Chain RPC
  const getProvider = () => {
    return new ethers.JsonRpcProvider('https://evm.rpc-testnet-donut-node1.push.org/');
  };

  // Clear any previous errors
  const clearError = () => setError(null);

  // Get token balance for the connected wallet
  const getTokenBalance = async (tokenAddress: string): Promise<string> => {
    try {
      if (!isConnected || !address) {
        return '0';
      }

      const provider = getProvider();
      if (!provider) {
        return '0';
      }

      const tokenContract = new ethers.Contract(
        tokenAddress,
        LAUNCHPAD_TOKEN_ABI,
        provider
      );

      const balance = await tokenContract.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return '0';
    }
  };

  // Calculate how many tokens you'll get for a given ETH amount
  const calculateTokensForEth = async (
    tokenAddress: string,
    ethAmount: string
  ): Promise<string> => {
    try {
      if (!ethAmount || parseFloat(ethAmount) <= 0) {
        return '0';
      }

      const provider = getProvider();
      if (!provider) {
        return '0';
      }

      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      const weiAmount = ethers.parseEther(ethAmount);
      const tokensOut = await marketplaceContract.calculatePurchaseReturn(
        tokenAddress,
        weiAmount
      );

      return ethers.formatEther(tokensOut);
    } catch (error) {
      console.error('Error calculating tokens for ETH:', error);
      return '0';
    }
  };

  // Calculate how much ETH you'll get for a given token amount
  const calculateEthForTokens = async (
    tokenAddress: string,
    tokenAmount: string
  ): Promise<string> => {
    try {
      if (!tokenAmount || parseFloat(tokenAmount) <= 0) {
        return '0';
      }

      const provider = getProvider();
      if (!provider) {
        return '0';
      }

      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      const tokenWei = ethers.parseEther(tokenAmount);
      const ethOut = await marketplaceContract.calculateSaleReturn(
        tokenAddress,
        tokenWei
      );

      return ethers.formatEther(ethOut);
    } catch (error) {
      console.error('Error calculating ETH for tokens:', error);
      return '0';
    }
  };

  // Buy tokens with ETH
  const buyTokens = async (
    tokenAddress: string,
    ethAmount: string,
    minTokensOut: string,
    slippagePercentage: number = 5
  ): Promise<TradeResult> => {
    clearError();
    setIsLoading(true);

    try {
      if (!isConnected || !pushChainClient) {
        throw new Error('Wallet not connected or Push Chain client not available');
      }

      const weiAmount = ethers.parseEther(ethAmount);
      
      // Calculate minimum tokens to receive with slippage
      let minTokensOutWei: bigint;
      if (minTokensOut) {
        minTokensOutWei = ethers.parseEther(minTokensOut);
        // Apply slippage tolerance
        minTokensOutWei = minTokensOutWei * BigInt(100 - slippagePercentage) / BigInt(100);
      } else {
        // If no minTokensOut provided, calculate it
        const provider = getProvider();
        if (!provider) {
          throw new Error('Unable to get provider');
        }

        const marketplaceContract = new ethers.Contract(
          CONTRACT_ADDRESSES.TokenMarketplace,
          TOKEN_MARKETPLACE_ABI,
          provider
        );
        
        const calculatedTokensOut = await marketplaceContract.calculatePurchaseReturn(
          tokenAddress,
          weiAmount
        );
        
        // Apply slippage tolerance
        minTokensOutWei = calculatedTokensOut * BigInt(100 - slippagePercentage) / BigInt(100);
      }

      console.log(`Buying tokens from ${tokenAddress}:`);
      console.log(`- ETH amount: ${ethAmount} ETH (${weiAmount.toString()} wei)`);
      console.log(`- Min tokens out: ${ethers.formatEther(minTokensOutWei)} (with ${slippagePercentage}% slippage)`);

      // Encode the transaction data
      const contractInterface = new ethers.Interface(TOKEN_MARKETPLACE_ABI);
      const encodedData = contractInterface.encodeFunctionData('buyTokens', [
        tokenAddress,
        minTokensOutWei
      ]);

      // Execute the transaction using Push Chain client
      const result = await pushChainClient.universal.sendTransaction({
        to: CONTRACT_ADDRESSES.TokenMarketplace as `0x${string}`,
        value: weiAmount,
        data: encodedData as `0x${string}`,
      });

      return {
        success: true,
        hash: result.hash
      };
    } catch (error: unknown) {
      console.error('Error buying tokens:', error);
      const errorMessage = (error as Error).message || 'Transaction failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Sell tokens for ETH
  const sellTokens = async (
    tokenAddress: string,
    tokenAmount: string,
    minEthOut: string,
    slippagePercentage: number = 5
  ): Promise<TradeResult> => {
    clearError();
    setIsLoading(true);

    try {
      if (!isConnected || !pushChainClient) {
        throw new Error('Wallet not connected or Push Chain client not available');
      }

      const tokenWei = ethers.parseEther(tokenAmount);
      
      // Calculate minimum ETH to receive with slippage
      let minEthOutWei: bigint;
      if (minEthOut) {
        minEthOutWei = ethers.parseEther(minEthOut);
        // Apply slippage tolerance
        minEthOutWei = minEthOutWei * BigInt(100 - slippagePercentage) / BigInt(100);
      } else {
        // If no minEthOut provided, calculate it
        const provider = getProvider();
        if (!provider) {
          throw new Error('Unable to get provider');
        }

        const marketplaceContract = new ethers.Contract(
          CONTRACT_ADDRESSES.TokenMarketplace,
          TOKEN_MARKETPLACE_ABI,
          provider
        );
        
        const calculatedEthOut = await marketplaceContract.calculateSaleReturn(
          tokenAddress,
          tokenWei
        );
        
        // Apply slippage tolerance
        minEthOutWei = calculatedEthOut * BigInt(100 - slippagePercentage) / BigInt(100);
      }

      // Check if token is approved
      const provider = getProvider();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        LAUNCHPAD_TOKEN_ABI,
        provider
      );
      
      // Check if approval is needed
      const allowance = await tokenContract.allowance(
        address,
        CONTRACT_ADDRESSES.TokenMarketplace
      );
      
      if (allowance < tokenWei) {
        console.log('Approving tokens for marketplace...');
        
        // Encode approval transaction
        const approveInterface = new ethers.Interface(LAUNCHPAD_TOKEN_ABI);
        const approveData = approveInterface.encodeFunctionData('approve', [
          CONTRACT_ADDRESSES.TokenMarketplace,
          tokenWei
        ]);

        // Send approval transaction
        const approveResult = await pushChainClient.universal.sendTransaction({
          to: tokenAddress as `0x${string}`,
          value: BigInt(0),
          data: approveData as `0x${string}`,
        });
        
        console.log('Approval transaction sent:', approveResult.hash);
        // Note: In a real app, you might want to wait for approval confirmation
      }

      console.log(`Selling tokens from ${tokenAddress}:`);
      console.log(`- Token amount: ${tokenAmount} tokens (${tokenWei.toString()} wei)`);
      console.log(`- Min ETH out: ${ethers.formatEther(minEthOutWei)} (with ${slippagePercentage}% slippage)`);

      // Encode the sell transaction
      const contractInterface = new ethers.Interface(TOKEN_MARKETPLACE_ABI);
      const encodedData = contractInterface.encodeFunctionData('sellTokens', [
        tokenAddress,
        tokenWei,
        minEthOutWei
      ]);

      // Execute the sell transaction using Push Chain client
      const result = await pushChainClient.universal.sendTransaction({
        to: CONTRACT_ADDRESSES.TokenMarketplace as `0x${string}`,
        value: BigInt(0),
        data: encodedData as `0x${string}`,
      });

      console.log('✅ Sell transaction sent:', result.hash);

      return {
        success: true,
        hash: result.hash
      };
    } catch (error: unknown) {
      console.error('Error selling tokens:', error);
      const errorMessage = (error as Error).message || 'Transaction failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    buyTokens,
    sellTokens,
    calculateTokensForEth,
    calculateEthForTokens,
    getTokenBalance,
    isLoading,
    error,
    clearError
  };
};
