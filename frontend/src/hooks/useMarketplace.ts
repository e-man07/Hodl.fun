'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_MARKETPLACE_ABI, LAUNCHPAD_TOKEN_ABI } from '@/config/abis';
import { getCachedToken, setCachedToken, getCachedSortedTokens, setCachedSortedTokens, getCachedAggregateStats, setCachedAggregateStats, getCachedTotalTokens, setCachedTotalTokens } from '@/lib/tokenCache';
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
  const [aggregateStats, setAggregateStats] = useState<{
    totalMarketCap: number;
    tradingTokens: number;
  }>({
    totalMarketCap: 0,
    tradingTokens: 0
  });

  // Use the new optimized IPFS fetching with caching and racing
  const fetchTokenMetadata = async (metadataURI: string): Promise<TokenMetadata | null> => {
    return fetchIPFSMetadata(metadataURI);
  };

  const fetchTokenDetails = async (tokenAddress: string, provider: ethers.Provider): Promise<{ name: string; symbol: string } | null> => {
    return deduplicatedFetch(`token-details-${tokenAddress}`, async () => {
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
    });
  };

  const fetchTokenHolderCount = async (tokenAddress: string, provider: ethers.Provider): Promise<number> => {
    return deduplicatedFetch(`token-holders-${tokenAddress}`, async () => {
      try {
        console.log(`🔍 Fetching holder count for token: ${tokenAddress}`);
        const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, provider);

        // Get all Transfer events from the token contract
        const transferFilter = tokenContract.filters.Transfer();
        const events = await tokenContract.queryFilter(transferFilter, 0, 'latest');

        if (events.length === 0) {
          console.log(`No transfer events found for ${tokenAddress}`);
          return 0;
        }

        console.log(`Found ${events.length} transfer events for ${tokenAddress}`);

        // Track unique addresses that have received tokens
        const potentialHolders = new Set<string>();

        for (const event of events) {
          // Cast to EventLog to access args property
          if ('args' in event) {
            const { to } = event.args!;

            // Add recipient to potential holders (if not zero address)
            if (to !== ethers.ZeroAddress) {
              potentialHolders.add(to.toLowerCase());
            }
          }
        }

        console.log(`Found ${potentialHolders.size} potential holders for ${tokenAddress}`);

        // Check current balances for all potential holders
        const holderPromises = Array.from(potentialHolders).map(async (holderAddress) => {
          try {
            const balance = await tokenContract.balanceOf(holderAddress);
            return balance > BigInt(0) ? holderAddress : null;
          } catch (error) {
            console.warn(`Error checking balance for ${holderAddress}:`, error);
            return null;
          }
        });

        const results = await Promise.all(holderPromises);
        const actualHolders = results.filter(holder => holder !== null);

        console.log(`✅ Token ${tokenAddress} has ${actualHolders.length} holders`);
        return actualHolders.length;

      } catch (error) {
        console.warn('Error fetching holder count for:', tokenAddress, error);
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

      console.log('🔍 Fetching all token addresses from marketplace...');
      const tokenAddresses: string[] = await marketplaceContract.getAllTokens();
      console.log('📋 Found token addresses:', tokenAddresses.length);

      if (tokenAddresses.length === 0) {
        setSortedTokenAddresses([]);
        setTotalTokens(0);
        setCachedTotalTokens(0);
        return;
      }

      // Cache total tokens count
      setCachedTotalTokens(tokenAddresses.length);

      // Only update state if value changed or not in silent mode
      if (!silent) {
        setTotalTokens(tokenAddresses.length);
      }

      // Fetch market caps in batches to sort tokens and calculate aggregate stats
      console.log('📊 Fetching market caps for sorting and aggregate stats...');
      const BATCH_SIZE = 50; // Fetch market caps in batches of 50
      const tokenInfoPromises: Array<Promise<{ 
        address: string; 
        marketCap: bigint;
        tradingEnabled: boolean;
      }>> = [];

      for (let i = 0; i < tokenAddresses.length; i += BATCH_SIZE) {
        const batch = tokenAddresses.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (address) => {
          try {
            const tokenInfo = await marketplaceContract.getTokenInfo(address);
            return { 
              address, 
              marketCap: tokenInfo.marketCap,
              tradingEnabled: tokenInfo.tradingEnabled
            };
          } catch (error) {
            console.warn(`Failed to get token info for ${address}:`, error);
            return { 
              address, 
              marketCap: BigInt(0),
              tradingEnabled: false
            };
          }
        });
        tokenInfoPromises.push(...batchPromises);

        // Add small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < tokenAddresses.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const tokenInfos = await Promise.all(tokenInfoPromises);

      // Calculate aggregate stats from all tokens
      let totalMarketCap = BigInt(0);
      let tradingTokensCount = 0;
      
      for (const info of tokenInfos) {
        totalMarketCap += info.marketCap;
        if (info.tradingEnabled) {
          tradingTokensCount++;
        }
      }

      const totalMarketCapEth = parseFloat(ethers.formatEther(totalMarketCap));
      
      console.log(`📊 Aggregate stats: Total Market Cap: ${totalMarketCapEth} ETH, Trading Tokens: ${tradingTokensCount}`);
      
      const aggregateStatsData = {
        totalMarketCap: totalMarketCapEth,
        tradingTokens: tradingTokensCount
      };

      // Cache aggregate stats
      setCachedAggregateStats(aggregateStatsData);

      // Only update state if not in silent mode
      if (!silent) {
        setAggregateStats(aggregateStatsData);
      }

      // Sort by market cap (descending)
      const sorted = tokenInfos
        .sort((a, b) => {
          if (b.marketCap > a.marketCap) return 1;
          if (b.marketCap < a.marketCap) return -1;
          return 0;
        })
        .map(info => info.address);

      console.log('✅ Sorted tokens by market cap');

      // Cache sorted token addresses for fast subsequent loads
      setCachedSortedTokens(sorted);

      // Only update state if not in silent mode or if data changed
      if (!silent) {
        setSortedTokenAddresses(sorted);
        setIsInitializing(false);
      }

      return sorted;
    } catch (error) {
      console.error('❌ Error fetching and sorting token addresses:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch token addresses');
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

      console.log(`📄 Loading page ${page}: tokens ${startIndex + 1}-${Math.min(endIndex, sortedAddresses.length)} of ${sortedAddresses.length}`);

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
            console.log(`✅ Using cached data for ${address}`);
            return cached;
          }
          
          console.log(`🔍 Fetching info for token: ${address}`);
          
          // Fetch essential data in parallel for speed
          const [tokenInfo, tokenDetails, priceWei] = await Promise.all([
            marketplaceContract.getTokenInfo(address),
            fetchTokenDetails(address, provider),
            marketplaceContract.getCurrentPrice(address).catch(() => BigInt(0))
          ]);
          
          if (!tokenDetails) {
            console.warn(`⚠️ Could not fetch token details for ${address}`);
            return null;
          }

          const currentPrice = parseFloat(ethers.formatEther(priceWei));
          const marketCap = parseFloat(ethers.formatEther(tokenInfo.marketCap));
          const totalSupply = parseFloat(ethers.formatEther(tokenInfo.totalSupply));
          const currentSupply = parseFloat(ethers.formatEther(tokenInfo.currentSupply));
          const reserveBalance = parseFloat(ethers.formatEther(tokenInfo.reserveBalance));

          // Create token with essential data immediately
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

          // Fetch metadata and holder count asynchronously (non-blocking)
          Promise.all([
            fetchTokenMetadata(tokenInfo.metadataURI).catch(() => null),
            fetchTokenHolderCount(address, provider).catch(() => 0)
          ]).then(([metadata, holderCount]) => {
            // Update token with additional data
            const updatedToken = {
              ...marketplaceToken,
              description: metadata?.description || 'No description available',
              logo: metadata?.image || undefined,
              holders: holderCount
            };
            
            // Update cache
            setCachedToken(address, updatedToken);
            
            // Update state
            setTokens(prevTokens =>
              prevTokens.map(t => t.address === address ? updatedToken : t)
            );
            
            console.log(`📊 Updated ${tokenDetails.symbol} with metadata and holders: ${holderCount}`);
          });

          console.log(`✅ Loaded basic data for ${tokenDetails.symbol}`);
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
      
      // Sort by market cap to maintain order (in case of async updates)
      validTokens.sort((a, b) => b.marketCap - a.marketCap);
      
      console.log(`✅ Successfully fetched ${validTokens.length} tokens for page ${page}`);
      setTokens(validTokens);

    } catch (error) {
      console.error('❌ Error fetching marketplace tokens:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch marketplace tokens');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, tokensPerPage, sortedTokenAddresses, fetchAndSortTokenAddresses]);

  const refreshTokens = useCallback(async () => {
    // Reset sorted addresses to trigger re-fetch and re-sort
    setSortedTokenAddresses([]);
    const sorted = await fetchAndSortTokenAddresses();
    if (sorted && sorted.length > 0) {
      await fetchMarketplaceTokens(currentPage);
    }
  }, [fetchAndSortTokenAddresses, fetchMarketplaceTokens, currentPage]);

  const loadPage = useCallback(async (page: number) => {
    setCurrentPage(page);
    await fetchMarketplaceTokens(page);
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

  // Load cached data on mount and fetch fresh data in background
  useEffect(() => {
    if (sortedTokenAddresses.length === 0) {
      // Try to load from cache first for instant display
      const cachedAddresses = getCachedSortedTokens();
      const cachedStats = getCachedAggregateStats();
      const cachedTotal = getCachedTotalTokens();

      if (cachedAddresses && cachedAddresses.length > 0) {
        console.log('✅ Loaded sorted token addresses from cache:', cachedAddresses.length);
        setSortedTokenAddresses(cachedAddresses);
        setIsInitializing(false);

        // Load cached total tokens count
        if (cachedTotal !== null) {
          setTotalTokens(cachedTotal);
        } else {
          setTotalTokens(cachedAddresses.length);
        }

        // Load cached stats
        if (cachedStats) {
          console.log('✅ Loaded aggregate stats from cache');
          setAggregateStats(cachedStats);
        }

        // Fetch fresh data in the background to update cache (silent mode - no state updates)
        console.log('🔄 Refreshing data in background...');
        fetchAndSortTokenAddresses(true);
      } else {
        // No cache, fetch from network (shows "Initializing")
        console.log('🔄 No cached data found, fetching from network...');
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
    loadPage,
    aggregateStats
  };
};
