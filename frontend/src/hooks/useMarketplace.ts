'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI, LAUNCHPAD_TOKEN_ABI } from '@/config/abis';
import { getCachedToken, setCachedToken, getCachedSortedTokens, setCachedSortedTokens, getCachedTotalTokens, setCachedTotalTokens, removeCachedToken } from '@/lib/tokenCache';
import { fetchIPFSMetadata } from '@/lib/ipfsCache';
import { deduplicatedFetch } from '@/lib/requestDeduplication';

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
  const [isInitializing, setIsInitializing] = useState(true); // Separate state for initial sorting
  const [error, setError] = useState<string | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [sortedTokenAddresses, setSortedTokenAddresses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [tokensPerPage] = useState(24); // 20-25 tokens per page

  // Use the new optimized IPFS fetching with caching and racing
  const fetchTokenMetadata = async (metadataURI: string): Promise<TokenMetadata | null> => {
    return fetchIPFSMetadata(metadataURI);
  };

  // Helper function to remove ETH prefix from token symbols
  const stripETHPrefix = (symbol: string): string => {
    if (!symbol) return '';
    let cleaned = symbol.trim();
    const upperSymbol = cleaned.toUpperCase();
    // Handle "ETH " with space first
    if (upperSymbol.startsWith('ETH ') && cleaned.length > 4) {
      cleaned = cleaned.substring(4).trim();
    }
    // Then handle "ETH" without space
    else if (upperSymbol.startsWith('ETH') && cleaned.length > 3) {
      cleaned = cleaned.substring(3).trim();
    }
    return cleaned || symbol;
  };

  const fetchTokenDetails = async (tokenAddress: string, provider: ethers.Provider): Promise<{ name: string; symbol: string } | null> => {
    return deduplicatedFetch(`token-details-${tokenAddress}`, async () => {
      try {
        const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);
        const [name, symbol] = await Promise.all([
          tokenContract.name(),
          tokenContract.symbol()
        ]);
        // Strip ETH prefix from symbol for consistent display
        const cleanedSymbol = stripETHPrefix(symbol);
        return { name, symbol: cleanedSymbol };
      } catch {
        return null;
      }
    });
  };

  const fetchTokenHolderCount = async (tokenAddress: string): Promise<number> => {
    return deduplicatedFetch(`token-holders-${tokenAddress}`, async () => {
      try {
        // Use Push Donut API to get holder count
        const response = await fetch(
          `https://donut.push.network/api/v2/tokens/${tokenAddress}/counters`,
          {
            headers: {
              'accept': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const holders = parseInt(data.token_holders_count || '0', 10);
          return holders;
        } else {
          return 0;
        }
      } catch {
        return 0;
      }
    });
  };

  // Fetch and sort token addresses by market cap
  const fetchAndSortTokenAddresses = useCallback(async (silent = false) => {
    // Only set initializing state if not in silent mode
    if (!silent) {
      setIsInitializing(true);
    }
    try {
      const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      let tokenAddresses: string[] = [];

      // First, try to load from indexed JSON file (fast, offline-first)
      try {
        const response = await fetch('/token-addresses.json');
        if (response.ok) {
          const indexedData = await response.json();
          if (indexedData.tokens && Array.isArray(indexedData.tokens) && indexedData.tokens.length > 0) {
            tokenAddresses = indexedData.tokens;
          }
        }
      } catch {
        // Fallback to on-chain query
      }

      // Fallback: Try getAllTokens() if indexed file doesn't exist or is empty
      if (tokenAddresses.length === 0) {
        try {
          tokenAddresses = await marketplaceContract.getAllTokens();
        } catch {
          // If both methods fail, show helpful error
          setError('Unable to load tokens. Please run "npm run index-tokens" to create the token index, or wait for the backend to be ready.');
          setIsInitializing(false);
          return [];
        }
      }

      if (tokenAddresses.length === 0) {
        setSortedTokenAddresses([]);
        setTotalTokens(0);
        setCachedTotalTokens(0);
        if (!silent) {
          setIsInitializing(false);
        }
        return [];
      }

      // Cache total tokens count
      setCachedTotalTokens(tokenAddresses.length);

      // Only update state if value changed or not in silent mode
      if (!silent) {
        setTotalTokens(tokenAddresses.length);
      }

      // Sort by newest first (tokens in listedTokens array are in chronological order)
      // Use array as-is to show newest first (oldest last)
      // This requires NO RPC calls, preventing rate limiting
      const sorted = [...tokenAddresses]; // Use as-is to show newest first

      // Cache sorted token addresses
      setCachedSortedTokens(sorted);

      // Only update state if not in silent mode
      if (!silent) {
        setSortedTokenAddresses(sorted);
        setIsInitializing(false);
      }

      return sorted;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token addresses');
      setIsInitializing(false);
      return [];
    }
  }, []);

  const fetchMarketplaceTokens = useCallback(async (page: number = currentPage) => {
    setIsLoading(true);
    setError(null);

    try {
      // If we don't have sorted token addresses yet, fetch and sort them first
      let sortedAddresses = sortedTokenAddresses;
      if (sortedAddresses.length === 0) {
        sortedAddresses = await fetchAndSortTokenAddresses() || [];
        if (sortedAddresses.length === 0) {
          setTokens([]);
          setIsLoading(false);
          return;
        }
      }

      // Calculate pagination
      const startIndex = (page - 1) * tokensPerPage;
      const endIndex = startIndex + tokensPerPage;
      const pageTokenAddresses = sortedAddresses.slice(startIndex, endIndex);

      // Create provider for reading data
      const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');

      // Create marketplace contract instance
      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      // Fetch detailed info only for tokens on current page
      const tokenPromises = pageTokenAddresses.map(async (address): Promise<MarketplaceToken | null> => {
        try {
          // Check cache first
          const cached = getCachedToken<MarketplaceToken>(address);
          if (cached) {
            return cached;
          }

          // Fetch essential data in parallel for speed (don't wait for metadata)
          const [tokenInfo, tokenDetails, priceWei] = await Promise.all([
            marketplaceContract.getTokenInfo(address),
            fetchTokenDetails(address, provider),
            marketplaceContract.getCurrentPrice(address).catch(() => BigInt(0))
          ]);

          if (!tokenDetails) {
            return null;
          }

          const currentPrice = parseFloat(ethers.formatEther(priceWei));
          const marketCap = parseFloat(ethers.formatEther(tokenInfo.marketCap));
          const totalSupply = parseFloat(ethers.formatEther(tokenInfo.totalSupply));
          const currentSupply = parseFloat(ethers.formatEther(tokenInfo.currentSupply));
          const reserveBalance = parseFloat(ethers.formatEther(tokenInfo.reserveBalance));

          // Create token with essential data immediately (show tokens fast)
          const marketplaceToken: MarketplaceToken = {
            address,
            name: tokenDetails.name,
            symbol: tokenDetails.symbol,
            description: 'Loading...', // Will be updated
            price: currentPrice,
            priceChange24h: 0,
            marketCap,
            volume24h: 0,
            holders: 0, // Will be updated
            createdAt: new Date(Number(tokenInfo.launchTimestamp) * 1000).toISOString().split('T')[0],
            creator: tokenInfo.creator,
            reserveRatio: Number(tokenInfo.reserveRatio) / 100,
            isTrading: tokenInfo.tradingEnabled,
            logo: undefined, // Will be updated
            currentSupply,
            totalSupply,
            reserveBalance
          };

          // Cache the basic token data
          setCachedToken(address, marketplaceToken);

          // Fetch metadata and holder count asynchronously (non-blocking, but start immediately)
          // Start fetching right away so images appear as soon as possible
          Promise.all([
            fetchTokenMetadata(tokenInfo.metadataURI).catch(() => null),
            fetchTokenHolderCount(address).catch(() => 0)
          ]).then(([metadata, holderCount]) => {
            // Update token with additional data
            // Use metadata image directly without validation (same as token details page)
            const updatedToken = {
              ...marketplaceToken,
              description: metadata?.description || 'No description available',
              logo: metadata?.image,
              holders: holderCount
            };

            // Update cache
            setCachedToken(address, updatedToken);

            // Update state
            setTokens(prevTokens =>
              prevTokens.map(t => t.address === address ? updatedToken : t)
            );
          });

          return marketplaceToken;

        } catch {
          return null;
        }
      });

      // Wait for all token data to be fetched
      const tokenResults = await Promise.all(tokenPromises);

      // Filter out null results and set tokens
      const validTokens = tokenResults.filter((token): token is MarketplaceToken => token !== null);

      // Tokens are already sorted by creation order (oldest first) from sortedTokenAddresses
      // Promise.all maintains the order of results, so no need to re-sort
      // This prevents RPC rate limiting that would occur from fetching market caps for all tokens

      setTokens(validTokens);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch marketplace tokens');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, tokensPerPage, sortedTokenAddresses]);

  const refreshTokens = useCallback(async () => {
    // Reset sorted addresses to trigger re-fetch and re-sort
    setSortedTokenAddresses([]);
    const sorted = await fetchAndSortTokenAddresses();
    if (sorted && sorted.length > 0) {
      await fetchMarketplaceTokens(currentPage);
    }
  }, [fetchAndSortTokenAddresses, fetchMarketplaceTokens, currentPage]);

  // Refresh a specific token's data (used after trades)
  const refreshTokenData = useCallback(async (tokenAddress: string) => {
    try {
      const provider = new ethers.JsonRpcProvider('https://evm.donut.rpc.push.org/');
      const marketplaceContract = new ethers.Contract(
        CONTRACT_ADDRESSES.TokenMarketplace,
        TOKEN_MARKETPLACE_ABI,
        provider
      );

      // Fetch fresh token info from blockchain
      const [tokenInfo, tokenDetails, priceWei] = await Promise.all([
        marketplaceContract.getTokenInfo(tokenAddress),
        fetchTokenDetails(tokenAddress, provider),
        marketplaceContract.getCurrentPrice(tokenAddress).catch(() => BigInt(0))
      ]);

      if (!tokenDetails) return;

      const currentPrice = parseFloat(ethers.formatEther(priceWei));
      const marketCap = parseFloat(ethers.formatEther(tokenInfo.marketCap));
      const totalSupply = parseFloat(ethers.formatEther(tokenInfo.totalSupply));
      const currentSupply = parseFloat(ethers.formatEther(tokenInfo.currentSupply));
      const reserveBalance = parseFloat(ethers.formatEther(tokenInfo.reserveBalance));

      const updatedToken: MarketplaceToken = {
        address: tokenAddress,
        name: tokenDetails.name,
        symbol: tokenDetails.symbol,
        description: 'Loading...',
        price: currentPrice,
        priceChange24h: 0,
        marketCap,
        volume24h: 0,
        holders: 0,
        createdAt: new Date(Number(tokenInfo.launchTimestamp) * 1000).toISOString().split('T')[0],
        creator: tokenInfo.creator,
        reserveRatio: Number(tokenInfo.reserveRatio) / 100,
        isTrading: tokenInfo.tradingEnabled,
        logo: undefined,
        currentSupply,
        totalSupply,
        reserveBalance
      };

      // Update cache with fresh data
      setCachedToken(tokenAddress, updatedToken);

      // Update state if token is on current page
      setTokens(prevTokens =>
        prevTokens.map(t => t.address === tokenAddress ? updatedToken : t)
      );

      // Fetch metadata asynchronously (non-blocking)
      fetchTokenMetadata(tokenInfo.metadataURI).then((metadata) => {
        if (metadata) {
          // Only use IPFS images - filter out random image services like picsum
          const isValidIPFSImage = metadata.image && (
            metadata.image.startsWith('ipfs://') ||
            metadata.image.includes('/ipfs/') ||
            metadata.image.includes('pinata.cloud') ||
            metadata.image.includes('cloudflare-ipfs.com') ||
            metadata.image.includes('dweb.link')
          );

          const finalToken = {
            ...updatedToken,
            description: metadata.description || 'No description available',
            logo: isValidIPFSImage ? metadata.image : undefined
          };
          setCachedToken(tokenAddress, finalToken);
          setTokens(prevTokens =>
            prevTokens.map(t => t.address === tokenAddress ? finalToken : t)
          );
        }
      }).catch(() => {
        // Metadata fetch failed, but we still have the updated market cap
      });
    } catch {
      // Error refreshing token data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPage = useCallback(async (page: number) => {
    setCurrentPage(page);
    await fetchMarketplaceTokens(page);
  }, [fetchMarketplaceTokens]);

  // Listen for token data changes (from trading transactions)
  useEffect(() => {
    const handleTokenDataChanged = (event: CustomEvent) => {
      const tokenAddress = event.detail?.tokenAddress;

      if (tokenAddress) {
        // Invalidate cache for the specific token that was traded
        removeCachedToken(tokenAddress);

        // Refresh the specific token's data immediately
        refreshTokenData(tokenAddress);
      }

      // Also refresh the current page to ensure all data is up to date
      setTimeout(() => {
        fetchMarketplaceTokens(currentPage);
      }, 1000); // Small delay to ensure blockchain state is updated
    };

    window.addEventListener('tokenDataChanged', handleTokenDataChanged as EventListener);

    return () => {
      window.removeEventListener('tokenDataChanged', handleTokenDataChanged as EventListener);
    };
  }, [currentPage, fetchMarketplaceTokens, refreshTokenData]);

  // Load cached data on mount and fetch fresh data in background
  useEffect(() => {
    if (sortedTokenAddresses.length === 0) {
      // Try to load from cache first for instant display
      const cachedAddresses = getCachedSortedTokens();
      const cachedTotal = getCachedTotalTokens();

      if (cachedAddresses && cachedAddresses.length > 0) {
        setSortedTokenAddresses(cachedAddresses);
        setIsInitializing(false);

        // Load cached total tokens count
        if (cachedTotal !== null) {
          setTotalTokens(cachedTotal);
        } else {
          setTotalTokens(cachedAddresses.length);
        }

        // Fetch fresh data in the background to update cache (silent mode - no state updates)
        fetchAndSortTokenAddresses(true);
      } else {
        // No cache, fetch from network (shows "Initializing")
        fetchAndSortTokenAddresses(false);
      }
    }
  }, [sortedTokenAddresses.length, fetchAndSortTokenAddresses]);

  // Fetch tokens for current page when sorted addresses or page changes
  useEffect(() => {
    if (sortedTokenAddresses.length > 0) {
      fetchMarketplaceTokens(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, sortedTokenAddresses.length]);

  const totalPages = Math.ceil(totalTokens / tokensPerPage);

  return {
    tokens,
    isLoading,
    isInitializing,
    error,
    refreshTokens,
    fetchMarketplaceTokens,
    totalTokens,
    currentPage,
    totalPages,
    tokensPerPage,
    loadPage
  };
};
