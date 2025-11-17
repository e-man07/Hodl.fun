'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_FACTORY_ABI } from '@/config/abis';
import { uploadImage, uploadMetadata } from '@/lib/api/ipfs';
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
      
      // Get user address
      const userAddress = await signer.getAddress();
      console.log('User address:', userAddress);

      // Create contract instance
      const tokenFactory = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenFactory,
        TOKEN_FACTORY_ABI,
        signer
      );

      // Create and upload metadata to IPFS via backend
      console.log('📤 Uploading logo to IPFS via backend...');
      let logoUrl = '';

      if (params.logoFile) {
        const logoResponse = await uploadImage(params.logoFile, `${params.symbol}-logo`);
        if (logoResponse.success) {
          logoUrl = logoResponse.data.url;
          console.log('✅ Logo uploaded:', logoUrl);
        }
      }

      // Create metadata object
      const metadata = {
        name: params.name,
        symbol: params.symbol,
        description: params.description,
        image: logoUrl,
        external_url: params.socialLinks?.website || '',
        social_links: params.socialLinks || {},
      };

      console.log('📤 Uploading metadata to IPFS via backend...');
      const metadataResponse = await uploadMetadata(metadata);

      if (!metadataResponse.success) {
        throw new Error('Failed to upload metadata to IPFS');
      }

      const metadataURI = metadataResponse.data.url;
      console.log('✅ Metadata uploaded to IPFS:', metadataURI);

      // Get creation fee from contract
      const creationFee = await tokenFactory.creationFee();
      console.log('Creation fee:', ethers.formatEther(creationFee), 'ETH');

      // Prepare contract parameters as a struct (TokenParams)
      // Note: totalSupply should be in wei (smallest unit)
      const totalSupplyWei = ethers.parseUnits(params.totalSupply, 18);
      
      const tokenParams = {
        name: params.name,
        symbol: params.symbol,
        totalSupply: totalSupplyWei,
        metadataURI: metadataURI,
        reserveRatio: params.reserveRatio,
        creator: userAddress
      };

      // Debug parameters thoroughly
      const validation = debugTokenParams(tokenParams);
      const suggestion = suggestFix(validation);
      console.log('💡 Suggestion:', suggestion);
      
      // Try to estimate gas first to catch revert reasons
      let gasEstimate: bigint;
      try {
        console.log('🔍 Estimating gas...');
        gasEstimate = await tokenFactory.createToken.estimateGas(
          tokenParams,
          { value: creationFee }
        );
        console.log('✅ Gas estimate successful:', gasEstimate.toString());
      } catch (gasError) {
        console.error('❌ Gas estimation failed:', gasError);
        throw new Error(`Contract will revert: ${gasError instanceof Error ? gasError.message : 'Unknown error'}`);
      }

      // Debug: Check if the function exists
      console.log('🔍 Contract has createToken function:', tokenFactory.interface.hasFunction('createToken'));
      
      // Check marketplace configuration
      try {
        const marketplaceAddress = await tokenFactory.marketplace();
        console.log('🏪 Marketplace address from factory:', marketplaceAddress);
        console.log('🏪 Expected marketplace address:', CONTRACT_ADDRESSES.TokenMarketplace);
        console.log('🔍 Marketplace addresses match:', marketplaceAddress.toLowerCase() === CONTRACT_ADDRESSES.TokenMarketplace.toLowerCase());
      } catch (err) {
        console.error('❌ Failed to get marketplace address:', err);
      }

      // Call the smart contract with the struct
      const tx = await tokenFactory.createToken(
        tokenParams, // Pass the entire struct
        {
          value: creationFee, // Pay the creation fee
          gasLimit: gasEstimate + BigInt(100000) // Use estimated gas + buffer
        }
      );

      console.log('Transaction submitted:', tx.hash);
      
      // Wait for transaction confirmation
      console.log('Waiting for confirmation...');
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log('✅ Token created successfully!');
        console.log('Transaction receipt:', receipt);
        
        // Extract token address from logs if needed
        const tokenCreatedEvent = receipt.logs.find((log: ethers.Log) => 
          log.topics && log.topics[0] === ethers.id('TokenCreated(address,address,string,string,uint256)')
        );
        
        if (tokenCreatedEvent) {
          console.log('New token address:', tokenCreatedEvent.address);
        }
        
        return tx.hash;
      } else {
        throw new Error('Transaction failed');
      }

    } catch (err) {
      console.error('❌ Token creation failed:', err);
      
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

// Note: window.ethereum type is already declared in useWallet.ts
