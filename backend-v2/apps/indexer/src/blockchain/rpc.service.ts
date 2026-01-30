import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  CircuitBreakerService,
  CircuitBreakerState,
  CircuitBreakerMetrics,
} from '@hodlfun/common';

/**
 * RPC Service for HTTP-based blockchain queries.
 * Uses circuit breaker pattern for resilience.
 *
 * Used for:
 * - Historical data backfill
 * - Fallback when WebSocket is unavailable
 * - getLogs queries for batch processing
 */
@Injectable()
export class RpcService implements OnModuleInit {
  private readonly logger = new Logger(RpcService.name);
  private provider!: ethers.JsonRpcProvider;
  private fallbackProvider!: ethers.JsonRpcProvider;

  // Circuit breaker names
  private readonly PRIMARY_BREAKER = 'rpc-primary';
  private readonly FALLBACK_BREAKER = 'rpc-fallback';

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const fallbackUrl = this.configService.get<string>('RPC_URL_FALLBACK') ?? rpcUrl;

    if (!rpcUrl) {
      throw new Error('RPC_URL is required');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.fallbackProvider = new ethers.JsonRpcProvider(fallbackUrl);

    // Initialize circuit breakers with custom thresholds
    this.circuitBreakerService.getBreaker({
      name: this.PRIMARY_BREAKER,
      failureThreshold: 5,
      resetTimeoutMs: 30000, // 30 seconds
    });

    this.circuitBreakerService.getBreaker({
      name: this.FALLBACK_BREAKER,
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 60 seconds (longer for fallback)
    });

    // Test connection
    try {
      const blockNumber = await this.getBlockNumber();
      this.logger.log(`HTTP RPC connected. Current block: ${blockNumber}`);
    } catch (error) {
      this.logger.error(`Failed to connect to RPC: ${error}`);
      throw error;
    }
  }

  async getBlockNumber(): Promise<number> {
    return this.executeWithCircuitBreaker(
      () => this.provider.getBlockNumber(),
      () => this.fallbackProvider.getBlockNumber(),
    );
  }

  async getBlock(blockNumber: number): Promise<ethers.Block | null> {
    return this.executeWithCircuitBreaker(
      () => this.provider.getBlock(blockNumber),
      () => this.fallbackProvider.getBlock(blockNumber),
    );
  }

  async getLogs(filter: ethers.Filter): Promise<ethers.Log[]> {
    return this.executeWithCircuitBreaker(
      () => this.provider.getLogs(filter),
      () => this.fallbackProvider.getLogs(filter),
    );
  }

  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    return this.executeWithCircuitBreaker(
      () => this.provider.getTransactionReceipt(txHash),
      () => this.fallbackProvider.getTransactionReceipt(txHash),
    );
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get circuit breaker metrics for monitoring.
   */
  getCircuitBreakerMetrics(): Record<string, CircuitBreakerMetrics> {
    return {
      primary: this.circuitBreakerService.getMetrics(this.PRIMARY_BREAKER)!,
      fallback: this.circuitBreakerService.getMetrics(this.FALLBACK_BREAKER)!,
    };
  }

  /**
   * Get the state of both circuit breakers.
   */
  getCircuitBreakerStates(): Record<string, CircuitBreakerState | undefined> {
    return {
      primary: this.circuitBreakerService.getState(this.PRIMARY_BREAKER),
      fallback: this.circuitBreakerService.getState(this.FALLBACK_BREAKER),
    };
  }

  /**
   * Check if the service is healthy (at least one circuit is not open).
   */
  isHealthy(): boolean {
    const primaryState = this.circuitBreakerService.getState(this.PRIMARY_BREAKER);
    const fallbackState = this.circuitBreakerService.getState(this.FALLBACK_BREAKER);

    // Healthy if at least one circuit is not fully open
    return (
      primaryState !== CircuitBreakerState.OPEN ||
      fallbackState !== CircuitBreakerState.OPEN
    );
  }

  /**
   * Execute a function with circuit breaker protection.
   * Uses primary provider first, falls back to secondary if primary circuit is open.
   */
  private async executeWithCircuitBreaker<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
  ): Promise<T> {
    // Try primary provider through circuit breaker
    try {
      return await this.circuitBreakerService.execute(
        this.PRIMARY_BREAKER,
        () => this.withRetry(primaryFn),
        // Fallback: try the fallback provider through its own circuit breaker
        async () => {
          this.logger.warn('Primary RPC circuit open, using fallback');
          return this.circuitBreakerService.execute(
            this.FALLBACK_BREAKER,
            () => this.withRetry(fallbackFn),
          );
        },
      );
    } catch (error) {
      // Both circuits failed
      this.logger.error(`Both RPC circuits failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Retry a function with exponential backoff.
   */
  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          this.logger.warn(`RPC call failed (attempt ${i + 1}/${retries}): ${lastError.message}`);
          await this.delay(Math.pow(2, i) * 1000);
        }
      }
    }
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
