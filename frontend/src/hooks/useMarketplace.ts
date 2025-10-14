'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI, LAUNCHPAD_TOKEN_ABI } from '@/config/abis';

interface TokenInfo {
  tokenAddress: string;
  creator: string;
  metadataURI: string;
  totalSupply: string;
  currentSupply: string;
  reserveBalance: string;
  reserveRatio: number;
  tradingEnabled: boolean;
  launchTimestamp: number;
  marketCap: string;
}

interface TokenMetadata {
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  social_links?: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };
}

interface MarketplaceToken {
  address: string;
  name: string;
  symbol: string;
  description: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  createdAt: string;
  creator: string;
  reserveRatio: number;
  isTrading: boolean;
  logo?: string;
  currentSupply: number;
  totalSupply: number;
  reserveBalance: number;
}

export const useMarketplace = () => {
  const [tokens, setTokens] = useState<MarketplaceToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenMetadata = async (metadataURI: string): Promise<TokenMetadata | null> => {
    try {
      if (!metadataURI || !metadataURI.startsWith('ipfs://')) {
        console.warn('Invalid metadata URI:', metadataURI);
        return null;
      }
      
      // Convert IPFS URI to HTTP gateway URL
      const ipfsHash = metadataURI.replace('ipfs://', '');
      
      // Check if it's a placeholder hash (these are invalid)
      if (ipfsHash.includes('QmHash') || ipfsHash.length < 40) {
        console.warn('Placeholder or invalid IPFS hash detected:', ipfsHash);
        return null;
      }
      
      const gatewayUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
      console.log('Fetching metadata from:', gatewayUrl);
      
      const response = await fetch(gatewayUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch metadata from: ${gatewayUrl} (Status: ${response.status})`);
        return null;
      }
      
      const metadata = await response.json();
      console.log('Successfully fetched metadata:', metadata);
      return metadata;
    } catch (error) {
      console.warn('Error fetching metadata:', error);
      return null;
    }
  };

  const fetchTokenDetails = async (tokenAddress: string, provider: ethers.Provider): Promise<{ name: string; symbol: string } | null> => {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);
      const [name, symbol] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol()
      ]);
      return { name, symbol };
    } catch (error) {
      console.warn('Error fetching token details for:', tokenAddress, error);
      return null;
    }
  };

  const fetchMarketplaceTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create provider for reading data
      const provider = new ethers.JsonRpcProvider('https://evm.rpc-testnet-donut-node1.push.org/');
      
      // Create marketplace contract instance
      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      console.log('🔍 Fetching all tokens from marketplace...');
      
      // Get all token addresses
      const tokenAddresses: string[] = await marketplaceContract.getAllTokens();
      console.log('📋 Found token addresses:', tokenAddresses);
      console.log('📋 Number of tokens found:', tokenAddresses.length);

      if (tokenAddresses.length === 0) {
        console.log('ℹ️ No tokens found in marketplace');
        setTokens([]);
        return;
      }

      // Fetch detailed info for each token
      const tokenPromises = tokenAddresses.map(async (address): Promise<MarketplaceToken | null> => {
        try {
          console.log(`🔍 Fetching info for token: ${address}`);
          
          // Get token info from marketplace
          const tokenInfo: TokenInfo = await marketplaceContract.getTokenInfo(address);
          console.log(`📊 Token info for ${address}:`, {
            creator: tokenInfo.creator,
            metadataURI: tokenInfo.metadataURI,
            totalSupply: tokenInfo.totalSupply.toString(),
            currentSupply: tokenInfo.currentSupply.toString(),
            reserveBalance: tokenInfo.reserveBalance.toString(),
            marketCap: tokenInfo.marketCap.toString(),
            tradingEnabled: tokenInfo.tradingEnabled
          });
          
          // Get token name and symbol
          const tokenDetails = await fetchTokenDetails(address, provider);
          if (!tokenDetails) {
            console.warn(`⚠️ Could not fetch token details for ${address}`);
            return null;
          }

          // Get current price
          let currentPrice = 0;
          try {
            const priceWei = await marketplaceContract.getCurrentPrice(address);
            currentPrice = parseFloat(ethers.formatEther(priceWei));
          } catch (priceError) {
            console.warn(`⚠️ Could not fetch price for ${address}:`, priceError);
          }

          // Fetch metadata from IPFS (with error handling)
          let metadata: TokenMetadata | null = null;
          try {
            metadata = await fetchTokenMetadata(tokenInfo.metadataURI);
          } catch (metadataError) {
            console.warn(`Failed to fetch metadata for ${address}:`, metadataError);
          }

          // Calculate market cap (tokenInfo.marketCap is already a BigInt)
          const marketCap = parseFloat(ethers.formatEther(tokenInfo.marketCap));

          // Convert BigInt values to numbers
          const totalSupply = parseFloat(ethers.formatEther(tokenInfo.totalSupply));
          const currentSupply = parseFloat(ethers.formatEther(tokenInfo.currentSupply));
          const reserveBalance = parseFloat(ethers.formatEther(tokenInfo.reserveBalance));

          const marketplaceToken: MarketplaceToken = {
            address,
            name: tokenDetails.name,
            symbol: tokenDetails.symbol,
            description: metadata?.description || 'No description available',
            price: currentPrice,
            priceChange24h: 0, // TODO: Calculate from historical data
            marketCap,
            volume24h: 0, // TODO: Calculate from events
            holders: 0, // TODO: Calculate from token contract
            createdAt: new Date(Number(tokenInfo.launchTimestamp) * 1000).toISOString().split('T')[0],
            creator: tokenInfo.creator,
            reserveRatio: Number(tokenInfo.reserveRatio) / 100, // Convert from basis points
            isTrading: tokenInfo.tradingEnabled,
            logo: metadata?.image || undefined,
            currentSupply,
            totalSupply,
            reserveBalance
          };

          console.log(`✅ Successfully fetched data for ${tokenDetails.symbol}:`, {
            name: marketplaceToken.name,
            symbol: marketplaceToken.symbol,
            price: marketplaceToken.price,
            marketCap: marketplaceToken.marketCap,
            isTrading: marketplaceToken.isTrading
          });
          return marketplaceToken;

        } catch (error) {
          console.error(`❌ Error fetching token info for ${address}:`, error);
          return null;
        }
      });

      // Wait for all token data to be fetched
      const tokenResults = await Promise.all(tokenPromises);
      
      // Filter out null results and set tokens
      const validTokens = tokenResults.filter((token): token is MarketplaceToken => token !== null);
      
      console.log(`✅ Successfully fetched ${validTokens.length} tokens from marketplace`);
      setTokens(validTokens);

    } catch (error) {
      console.error('❌ Error fetching marketplace tokens:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch marketplace tokens');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    await fetchMarketplaceTokens();
  }, [fetchMarketplaceTokens]);

  // Listen for token data changes (from trading transactions)
  useEffect(() => {
    const handleTokenDataChanged = (event: CustomEvent) => {
      console.log('🔄 Token data changed, refreshing marketplace...', event.detail);
      refreshTokens();
    };

    window.addEventListener('tokenDataChanged', handleTokenDataChanged as EventListener);
    
    return () => {
      window.removeEventListener('tokenDataChanged', handleTokenDataChanged as EventListener);
    };
  }, [refreshTokens]);

  // Fetch tokens on mount
  useEffect(() => {
    fetchMarketplaceTokens();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    tokens,
    isLoading,
    error,
    refreshTokens,
    fetchMarketplaceTokens
  };
};
