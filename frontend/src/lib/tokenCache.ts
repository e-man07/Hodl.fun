/**
 * Token data caching system for faster marketplace loading
 * Hybrid approach: in-memory cache + persistent localStorage
 */

import {
  getCached,
  setCached,
  removeCached,
  clearAllCache,
  CACHE_DURATIONS,
} from './persistentCache';

interface CachedTokenData<T> {
  data: T;
  timestamp: number;
}

// In-memory cache for fast access (short TTL)
const MEMORY_CACHE_DURATION = 30000; // 30 seconds
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memoryCache = new Map<string, CachedTokenData<any>>();

/**
 * Get token from cache (checks memory first, then localStorage)
 */
export const getCachedToken = <T = unknown>(
  address: string,
  cacheType: keyof typeof CACHE_DURATIONS = 'TOKEN_BASIC'
): T | null => {
  // Check memory cache first (fastest)
  const memCached = memoryCache.get(address);
  if (memCached && Date.now() - memCached.timestamp < MEMORY_CACHE_DURATION) {
    return memCached.data as T;
  }

  // Check persistent cache
  const key = `token-${address}`;
  const persistedData = getCached<T>(key, CACHE_DURATIONS[cacheType]);

  if (persistedData) {
    // Populate memory cache for faster subsequent access
    memoryCache.set(address, {
      data: persistedData,
      timestamp: Date.now(),
    });
    return persistedData;
  }

  return null;
};

/**
 * Set token in cache (updates both memory and localStorage)
 */
export const setCachedToken = <T = unknown>(
  address: string,
  data: T
): void => {
  // Update memory cache
  memoryCache.set(address, {
    data,
    timestamp: Date.now(),
  });

  // Update persistent cache
  const key = `token-${address}`;
  setCached(key, data);
};

/**
 * Clear all token cache
 */
export const clearTokenCache = (): void => {
  memoryCache.clear();
  clearAllCache();
};

/**
 * Remove specific token from cache
 */
export const removeCachedToken = (address: string): void => {
  memoryCache.delete(address);
  const key = `token-${address}`;
  removeCached(key);
};

/**
 * Get IPFS metadata from cache
 */
export const getCachedIPFS = <T = unknown>(ipfsHash: string): T | null => {
  const key = `ipfs-${ipfsHash}`;
  return getCached<T>(key, CACHE_DURATIONS.IPFS_METADATA);
};

/**
 * Set IPFS metadata in cache
 */
export const setCachedIPFS = <T = unknown>(ipfsHash: string, data: T): void => {
  const key = `ipfs-${ipfsHash}`;
  setCached(key, data);
};

/**
 * Remove IPFS data from cache
 */
export const removeCachedIPFS = (ipfsHash: string): void => {
  const key = `ipfs-${ipfsHash}`;
  removeCached(key);
};

/**
 * Get sorted token addresses from cache
 */
export const getCachedSortedTokens = (): string[] | null => {
  const key = 'sorted-token-addresses';
  return getCached<string[]>(key, CACHE_DURATIONS.TOKEN_BASIC);
};

/**
 * Set sorted token addresses in cache
 */
export const setCachedSortedTokens = (addresses: string[]): void => {
  const key = 'sorted-token-addresses';
  setCached(key, addresses);
};

/**
 * Get aggregate marketplace stats from cache
 */
export const getCachedAggregateStats = (): {
  totalMarketCap: number;
  tradingTokens: number;
} | null => {
  const key = 'marketplace-aggregate-stats';
  return getCached<{ totalMarketCap: number; tradingTokens: number }>(
    key,
    CACHE_DURATIONS.TOKEN_BASIC
  );
};

/**
 * Set aggregate marketplace stats in cache
 */
export const setCachedAggregateStats = (stats: {
  totalMarketCap: number;
  tradingTokens: number;
}): void => {
  const key = 'marketplace-aggregate-stats';
  setCached(key, stats);
};

/**
 * Get total tokens count from cache
 */
export const getCachedTotalTokens = (): number | null => {
  const key = 'marketplace-total-tokens';
  return getCached<number>(key, CACHE_DURATIONS.TOKEN_BASIC);
};

/**
 * Set total tokens count in cache
 */
export const setCachedTotalTokens = (count: number): void => {
  const key = 'marketplace-total-tokens';
  setCached(key, count);
};
