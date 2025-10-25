/**
 * Token data caching system for faster marketplace loading
 */

interface CachedTokenData<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 30000; // 30 seconds cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tokenCache = new Map<string, CachedTokenData<any>>();

export const getCachedToken = <T = unknown>(address: string): T | null => {
  const cached = tokenCache.get(address);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    tokenCache.delete(address);
    return null;
  }
  
  return cached.data as T;
};

export const setCachedToken = <T = unknown>(address: string, data: T): void => {
  tokenCache.set(address, {
    data,
    timestamp: Date.now()
  });
};

export const clearTokenCache = (): void => {
  tokenCache.clear();
};

export const removeCachedToken = (address: string): void => {
  tokenCache.delete(address);
};
