'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_FACTORY_ABI } from '@/config/abis';
import { uploadMetadataToIPFS, createTokenMetadata } from '@/lib/ipfs';
import { debugTokenParams, suggestFix } from '@/utils/debugContract';

interface TokenParams {
  name: string;
  symbol: string;
  description: string;
  totalSupply: string;
  metadataURI: string;
  reserveRatio: number;
  creator: string;
  socialLinks?: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };
  logoFile?: File;
}

export const useRealContracts = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create token using real smart contract
  const createToken = async (params: TokenParams): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if MetaMask is available
      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask.');
      }

      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const userAddress = await signer.getAddress();
      const tokenFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenFactory,
        TOKEN_FACTORY_ABI,
        signer
      );

      const metadata = await createTokenMetadata(
        params.name,
        params.description,
        params.socialLinks,
        params.logoFile
      );

      const metadataURI = await uploadMetadataToIPFS(metadata);
      const creationFee = await tokenFactory.creationFee();
      const totalSupplyWei = ethers.parseUnits(params.totalSupply, 18);
      
      const tokenParams = {
        name: params.name,
        symbol: params.symbol,
        totalSupply: totalSupplyWei,
        metadataURI: metadataURI,
        reserveRatio: params.reserveRatio,
        creator: userAddress
      };

      debugTokenParams(tokenParams);
      
      let gasEstimate: bigint;
      try {
        gasEstimate = await tokenFactory.createToken.estimateGas(
          tokenParams,
          { value: creationFee }
        );
      } catch (gasError) {
        throw new Error(`Contract will revert: ${gasError instanceof Error ? gasError.message : 'Unknown error'}`);
      }

      const tx = await tokenFactory.createToken(
        tokenParams,
        {
          value: creationFee,
          gasLimit: gasEstimate + BigInt(100000)
        }
      );

      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        return tx.hash;
      } else {
        throw new Error('Transaction failed');
      }

    } catch (err) {
      
      let errorMessage = 'Token creation failed';
      
      if (err instanceof Error) {
        if ('code' in err) {
          const errorWithCode = err as Error & { code?: string; reason?: string };
          
          if (errorWithCode.code === 'ACTION_REJECTED') {
            errorMessage = 'Transaction was rejected by user';
          } else if (errorWithCode.code === 'INSUFFICIENT_FUNDS') {
            errorMessage = 'Insufficient funds for transaction';
          } else if (err.message.includes('user rejected')) {
            errorMessage = 'Transaction was rejected by user';
          } else if (errorWithCode.reason) {
            errorMessage = errorWithCode.reason;
          } else {
            errorMessage = err.message;
          }
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
      
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    createToken,
    isLoading,
    error,
    clearError,
  };
};

