import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class RpcService implements OnModuleInit {
  private readonly logger = new Logger(RpcService.name);
  private provider: ethers.JsonRpcProvider;
  private fallbackProvider: ethers.JsonRpcProvider;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const fallbackUrl = this.configService.get<string>('RPC_URL_FALLBACK', rpcUrl);

    if (!rpcUrl) {
      throw new Error('RPC_URL is required');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.fallbackProvider = new ethers.JsonRpcProvider(fallbackUrl);

    // Test connection
    try {
      const blockNumber = await this.provider.getBlockNumber();
      this.logger.log(`RPC connected. Current block: ${blockNumber}`);
    } catch (error) {
      this.logger.error(`Failed to connect to RPC: ${error}`);
      throw error;
    }
  }

  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      this.logger.warn('Primary RPC failed, using fallback');
      return await this.fallbackProvider.getBlockNumber();
    }
  }

  async getBlock(blockNumber: number): Promise<ethers.Block | null> {
    return this.withRetry(() => this.provider.getBlock(blockNumber));
  }

  async getLogs(filter: ethers.Filter): Promise<ethers.Log[]> {
    return this.withRetry(() => this.provider.getLogs(filter));
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`RPC call failed (attempt ${i + 1}/${retries}): ${lastError.message}`);
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
