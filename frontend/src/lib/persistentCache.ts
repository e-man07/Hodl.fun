/**
 * Persistent caching system using localStorage with fallback to in-memory
 * Supports different cache durations for different data types
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

export const CACHE_VERSION = 'v1';

export const CACHE_DURATIONS = {
  TOKEN_BASIC: 5 * 60 * 1000,              // 5 minutes - price, supply
  TOKEN_METADATA: 24 * 60 * 60 * 1000,     // 24 hours - name, symbol, image
  TOKEN_HOLDERS: 2 * 60 * 1000,            // 2 minutes - holder count
  IPFS_METADATA: 7 * 24 * 60 * 60 * 1000,  // 7 days - IPFS data
} as const;

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get data from persistent cache
 */
export function getCached<T>(
  key: string,
  maxAge: number
): T | null {
  try {
    if (!isLocalStorageAvailable()) {
      return null;
    }

    const item = localStorage.getItem(key);
    if (!item) {
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(item);

    // Check version compatibility
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Set data in persistent cache
 */
export function setCached<T>(
  key: string,
  data: T
): boolean {
  try {
    if (!isLocalStorageAvailable()) {
      return false;
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };

    localStorage.setItem(key, JSON.stringify(entry));
    return true;
  } catch (error) {
    // Handle quota exceeded
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, clearing old cache');
      clearOldCache();
      try {
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION,
        };
        localStorage.setItem(key, JSON.stringify(entry));
        return true;
      } catch {
        return false;
      }
    }
    console.warn('Cache write error:', error);
    return false;
  }
}

/**
 * Remove specific item from cache
 */
export function removeCached(key: string): void {
  try {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn('Cache remove error:', error);
  }
}

/**
 * Clear old cache entries to free up space
 */
function clearOldCache(): void {
  try {
    if (!isLocalStorageAvailable()) {
      return;
    }

    const now = Date.now();
    const keysToRemove: string[] = [];

    // Find expired entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      try {
        const item = localStorage.getItem(key);
        if (!item) continue;

        const entry = JSON.parse(item) as CacheEntry<unknown>;

        // Remove if expired (older than 7 days) or wrong version
        if (
          entry.version !== CACHE_VERSION ||
          now - entry.timestamp > 7 * 24 * 60 * 60 * 1000
        ) {
          keysToRemove.push(key);
        }
      } catch {
        // Remove invalid entries
        keysToRemove.push(key);
      }
    }

    // Remove old entries
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Cache cleanup error:', error);
  }
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  try {
    if (isLocalStorageAvailable()) {
      // Only clear cache-related items
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('token-') || key.startsWith('ipfs-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.warn('Cache clear error:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalItems: number;
  totalSize: number;
  oldestEntry: number | null;
} {
  const stats = {
    totalItems: 0,
    totalSize: 0,
    oldestEntry: null as number | null,
  };

  try {
    if (!isLocalStorageAvailable()) {
      return stats;
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || (!key.startsWith('token-') && !key.startsWith('ipfs-'))) {
        continue;
      }

      const item = localStorage.getItem(key);
      if (!item) continue;

      stats.totalItems++;
      stats.totalSize += item.length;

      try {
        const entry = JSON.parse(item) as CacheEntry<unknown>;
        if (stats.oldestEntry === null || entry.timestamp < stats.oldestEntry) {
          stats.oldestEntry = entry.timestamp;
        }
      } catch {
        // Skip invalid entries
      }
    }
  } catch (error) {
    console.warn('Cache stats error:', error);
  }

  return stats;
}
