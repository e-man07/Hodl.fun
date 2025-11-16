// RPC Provider Service with fallback and rate limiting

import { ethers, JsonRpcProvider, FallbackProvider, Network } from 'ethers';
import { blockchainConfig } from '../config';
import logger from '../utils/logger';
import { BlockchainError } from '../types';

interface ProviderStats {
  url: string;
  callCount: number;
  errorCount: number;
  lastError?: Date;
  isHealthy: boolean;
}

export class RPCService {
  private provider!: JsonRpcProvider | FallbackProvider;
  private providers: JsonRpcProvider[] = [];
  private stats: Map<string, ProviderStats> = new Map();
  private rateLimitQueue: Map<string, number[]> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize RPC providers with fallback
   */
  private initializeProviders(): void {
    const rpcUrls = [
      blockchainConfig.primaryRpc,
      blockchainConfig.secondaryRpc,
      blockchainConfig.tertiaryRpc,
    ].filter(Boolean) as string[];

    if (rpcUrls.length === 0) {
      throw new Error('No RPC URLs configured');
    }

    // Create providers
    this.providers = rpcUrls.map((url) => {
      const provider = new JsonRpcProvider(url, undefined, {
        staticNetwork: Network.from({
          name: 'push-chain-donut',
          chainId: 9999999, // Push Chain Testnet Donut
        }),
      });

      // Initialize stats
      this.stats.set(url, {
        url,
        callCount: 0,
        errorCount: 0,
        isHealthy: true,
      });

      return provider;
    });

    // Use single provider or create fallback
    if (this.providers.length === 1) {
      this.provider = this.providers[0];
      logger.info(`✅ RPC provider initialized: ${rpcUrls[0]}`);
    } else {
      // Create fallback provider with custom quorum
      const configs = this.providers.map((provider, index) => ({
        provider,
        weight: index === 0 ? 2 : 1, // Give primary higher weight
        stallTimeout: 2000, // 2 seconds before trying next provider
        priority: index === 0 ? 1 : 2, // Primary gets priority
      }));

      this.provider = new FallbackProvider(configs, undefined, {
        quorum: 1, // Accept response from first provider
        eventQuorum: 1,
        cacheTimeout: -1, // Disable caching
      });

      logger.info(`✅ RPC fallback provider initialized with ${this.providers.length} endpoints`);
    }
  }

  /**
   * Get provider instance
   */
  getProvider(): JsonRpcProvider | FallbackProvider {
    return this.provider;
  }

  /**
   * Execute RPC call with rate limiting and retry logic
   */
  async executeCall<T>(
    fn: (provider: JsonRpcProvider | FallbackProvider) => Promise<T>,
    retries: number = 2
  ): Promise<T> {
    // Check rate limit
    await this.checkRateLimit();

    let lastError: Error | null = null;

    for (let i = 0; i <= retries; i++) {
      try {
        const result = await fn(this.provider);
        this.recordSuccess();
        return result;
      } catch (error: any) {
        lastError = error;
        this.recordError(error);

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw new BlockchainError(error.message);
        }

        // Wait before retry with exponential backoff
        if (i < retries) {
          const delay = Math.min(1000 * Math.pow(2, i), 5000);
          logger.warn(`RPC call failed, retrying in ${delay}ms... (${i + 1}/${retries})`);
          await this.sleep(delay);
        }
      }
    }

    throw new BlockchainError(
      lastError?.message || 'RPC call failed after retries'
    );
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 10000; // 10 seconds
    const maxRequests = blockchainConfig.rpcRateLimit;

    const key = 'global';
    const timestamps = this.rateLimitQueue.get(key) || [];

    // Remove old timestamps
    const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= maxRequests) {
      const oldestTimestamp = validTimestamps[0];
      const waitTime = windowMs - (now - oldestTimestamp);

      if (waitTime > 0) {
        logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
        return this.checkRateLimit(); // Recursive check after waiting
      }
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.rateLimitQueue.set(key, validTimestamps);
  }

  /**
   * Record successful call
   */
  private recordSuccess(): void {
    for (const stats of this.stats.values()) {
      stats.callCount++;
    }
  }

  /**
   * Record error
   */
  private recordError(error: any): void {
    const errorMessage = error.message || '';

    // Try to identify which provider failed
    for (const [url, stats] of this.stats.entries()) {
      if (errorMessage.includes(url) || stats.callCount > 0) {
        stats.errorCount++;
        stats.lastError = new Date();

        // Mark as unhealthy if too many errors
        if (stats.errorCount > 10 && stats.errorCount / stats.callCount > 0.5) {
          stats.isHealthy = false;
          logger.error(`RPC provider marked as unhealthy: ${url}`);
        }

        break;
      }
    }

    logger.error('RPC call error:', {
      message: error.message,
      code: error.code,
    });
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    const nonRetryableCodes = [
      'INVALID_ARGUMENT',
      'CALL_EXCEPTION',
      'UNPREDICTABLE_GAS_LIMIT',
    ];

    return nonRetryableCodes.includes(error.code);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get provider health stats
   */
  getProviderStats(): ProviderStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber > 0;
    } catch (error) {
      logger.error('RPC health check failed:', error);
      return false;
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    return this.executeCall(async (provider) => {
      return await provider.getBlockNumber();
    });
  }

  /**
   * Get block by number
   */
  async getBlock(blockNumber: number) {
    return this.executeCall(async (provider) => {
      return await provider.getBlock(blockNumber);
    });
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string) {
    return this.executeCall(async (provider) => {
      return await provider.getTransactionReceipt(txHash);
    });
  }

  /**
   * Create contract instance
   */
  getContract(address: string, abi: any): ethers.Contract {
    return new ethers.Contract(address, abi, this.provider);
  }
}

// Export singleton instance
export const rpcService = new RPCService();
