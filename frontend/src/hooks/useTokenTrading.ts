'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI, LAUNCHPAD_TOKEN_ABI } from '@/config/abis';
import { useWallet } from './useWallet';

interface TradeResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export const useTokenTrading = () => {
  const { address, isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create provider and signer from window.ethereum
  const getProvider = () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    return null;
  };

  const getSigner = async () => {
    const provider = getProvider();
    if (provider) {
      return await provider.getSigner();
    }
    return null;
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
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('Unable to get signer');
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

      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        signer
      );

      console.log(`Buying tokens from ${tokenAddress}:`);
      console.log(`- ETH amount: ${ethAmount} ETH (${weiAmount.toString()} wei)`);
      console.log(`- Min tokens out: ${ethers.formatEther(minTokensOutWei)} (with ${slippagePercentage}% slippage)`);

      // Execute the transaction
      const tx = await marketplaceContract.buyTokens(
        tokenAddress,
        minTokensOutWei,
        { value: weiAmount }
      );

      console.log('Transaction submitted:', tx.hash);
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      return {
        success: true,
        hash: tx.hash
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
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('Unable to get signer');
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
      const tokenContract = new ethers.Contract(
        tokenAddress,
        LAUNCHPAD_TOKEN_ABI,
        signer
      );
      
      // Check if approval is needed
      const allowance = await tokenContract.allowance(
        address,
        CONTRACT_ADDRESSES.TokenMarketplace
      );
      
      if (allowance < tokenWei) {
        console.log('Approving tokens for marketplace...');
        const approveTx = await tokenContract.approve(
          CONTRACT_ADDRESSES.TokenMarketplace,
          tokenWei
        );
        await approveTx.wait();
        console.log('Tokens approved');
      }

      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        signer
      );

      console.log(`Selling tokens to ${tokenAddress}:`);
      console.log(`- Token amount: ${tokenAmount} tokens (${tokenWei.toString()} wei)`);
      console.log(`- Min ETH out: ${ethers.formatEther(minEthOutWei)} (with ${slippagePercentage}% slippage)`);

      // Execute the transaction
      const tx = await marketplaceContract.sellTokens(
        tokenAddress,
        tokenWei,
        minEthOutWei
      );

      console.log('Transaction submitted:', tx.hash);
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      return {
        success: true,
        hash: tx.hash
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
