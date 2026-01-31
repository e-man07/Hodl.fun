import { ethers } from 'ethers';
import { CURRENT_NETWORK } from '@/config/contracts';

const RPC_URLS = CURRENT_NETWORK.rpcUrls;
const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // ms

/**
 * Creates a provider that tries multiple RPC endpoints with retry logic
 */
export const createFallbackProvider = (): ethers.JsonRpcProvider => {
  // Return the first RPC URL provider - ethers will handle connection
  return new ethers.JsonRpcProvider(RPC_URLS[0]);
};

/**
 * Execute an RPC call with fallback to alternate endpoints
 */
export const executeWithFallback = async <T>(
  fn: (provider: ethers.JsonRpcProvider) => Promise<T>
): Promise<T> => {
  let lastError: Error | null = null;

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    for (const rpcUrl of RPC_URLS) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        return await fn(provider);
      } catch (error) {
        lastError = error as Error;
        console.warn(`RPC ${rpcUrl} failed (attempt ${retry + 1}):`, error);
      }
    }

    // Wait before retrying all endpoints
    if (retry < MAX_RETRIES - 1) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }

  throw lastError || new Error('All RPC endpoints failed');
};

/**
 * Get a working provider by testing each RPC endpoint
 */
export const getWorkingProvider = async (): Promise<ethers.JsonRpcProvider> => {
  for (const rpcUrl of RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      // Test the provider with a simple call
      await provider.getBlockNumber();
      return provider;
    } catch (error) {
      console.warn(`RPC ${rpcUrl} is not responding:`, error);
    }
  }

  // Fallback to first RPC if all tests fail
  return new ethers.JsonRpcProvider(RPC_URLS[0]);
};
