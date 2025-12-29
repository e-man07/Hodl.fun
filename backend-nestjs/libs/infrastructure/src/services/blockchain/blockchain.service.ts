import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';

/**
 * Blockchain Service
 *
 * Handles all blockchain interactions via Web3/ethers.js
 * Manages RPC provider with fallback support
 * Executes read-only contract calls and transaction monitoring
 */
@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private primaryProvider!: ethers.JsonRpcProvider;
  private fallbackProvider: ethers.JsonRpcProvider | null = null;
  private currentProvider!: ethers.JsonRpcProvider;

  constructor(private readonly config: ConfigService) {
    this.initializeProviders();
  }

  /**
   * Initialize RPC providers with fallback support
   */
  private initializeProviders(): void {
    const primaryRpc = this.config.get<string>('PUSH_RPC_URL');
    const fallbackRpc = this.config.get<string>('PUSH_RPC_URL_ALT');

    if (!primaryRpc) {
      throw new Error('PUSH_RPC_URL environment variable is required');
    }

    this.primaryProvider = new ethers.JsonRpcProvider(primaryRpc);
    this.currentProvider = this.primaryProvider;

    if (fallbackRpc) {
      this.fallbackProvider = new ethers.JsonRpcProvider(fallbackRpc);
      this.logger.log('Fallback RPC provider configured');
    }

    this.logger.log('Blockchain service initialized with Push Chain RPC');
  }

  /**
   * Get current active provider (switches to fallback on primary failure)
   */
  private getProvider(): ethers.JsonRpcProvider {
    return this.currentProvider;
  }

  /**
   * Switch to fallback provider if available
   */
  private switchToFallback(): void {
    if (this.fallbackProvider) {
      this.currentProvider = this.fallbackProvider;
      this.logger.warn('Switched to fallback RPC provider');
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      return await this.getProvider().getBlockNumber();
    } catch (error) {
      this.logger.error(`Error getting block number: ${error.message}`);
      if (this.fallbackProvider) {
        this.switchToFallback();
        return await this.getProvider().getBlockNumber();
      }
      throw error;
    }
  }

  /**
   * Get balance of an address
   */
  async getBalance(address: string): Promise<bigint> {
    try {
      if (!ethers.isAddress(address)) {
        throw new BadRequestException('Invalid Ethereum address');
      }
      return await this.getProvider().getBalance(address);
    } catch (error) {
      this.logger.error(`Error getting balance for ${address}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate transaction hash format
   */
  private isValidTxHash(txHash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(txHash);
  }

  /**
   * Get transaction details by hash
   */
  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    try {
      if (!this.isValidTxHash(txHash)) {
        throw new BadRequestException('Invalid transaction hash');
      }
      return await this.getProvider().getTransaction(txHash);
    } catch (error) {
      this.logger.error(`Error getting transaction ${txHash}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(
    txHash: string,
  ): Promise<ethers.TransactionReceipt | null> {
    try {
      if (!this.isValidTxHash(txHash)) {
        throw new BadRequestException('Invalid transaction hash');
      }
      return await this.getProvider().getTransactionReceipt(txHash);
    } catch (error) {
      this.logger.error(
        `Error getting transaction receipt for ${txHash}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: string,
    confirmations: number = 1,
  ): Promise<ethers.TransactionReceipt | null> {
    try {
      if (!this.isValidTxHash(txHash)) {
        throw new BadRequestException('Invalid transaction hash');
      }
      return await this.getProvider().waitForTransaction(txHash, confirmations);
    } catch (error) {
      this.logger.error(
        `Error waiting for transaction ${txHash}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get block details
   */
  async getBlock(blockHashOrNumber: string | number): Promise<ethers.Block | null> {
    try {
      return await this.getProvider().getBlock(blockHashOrNumber);
    } catch (error) {
      this.logger.error(
        `Error getting block ${blockHashOrNumber}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get logs for event filtering
   */
  async getLogs(filter: ethers.Filter): Promise<ethers.Log[]> {
    try {
      return await this.getProvider().getLogs(filter);
    } catch (error) {
      this.logger.error(`Error getting logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Call contract method (read-only)
   */
  async call(transaction: ethers.TransactionRequest): Promise<string> {
    try {
      return await this.getProvider().call(transaction);
    } catch (error) {
      this.logger.error(`Error calling contract: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get code at address
   */
  async getCode(address: string, blockTag?: string | number): Promise<string> {
    try {
      if (!ethers.isAddress(address)) {
        throw new BadRequestException('Invalid Ethereum address');
      }
      return await this.getProvider().getCode(address, blockTag);
    } catch (error) {
      this.logger.error(`Error getting code for ${address}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    try {
      return await this.getProvider().estimateGas(transaction);
    } catch (error) {
      this.logger.error(`Error estimating gas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get gas price
   */
  async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.getProvider().getFeeData();
      if (!feeData.gasPrice) {
        throw new Error('Unable to fetch gas price');
      }
      return feeData.gasPrice;
    } catch (error) {
      this.logger.error(`Error getting gas price: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get network information
   */
  async getNetwork(): Promise<ethers.Network> {
    try {
      return await this.getProvider().getNetwork();
    } catch (error) {
      this.logger.error(`Error getting network info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check - verify RPC connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getBlockNumber();
      return true;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a contract instance for reading (no signing)
   */
  getContract(
    address: string,
    abi: ethers.Interface | string[],
  ): ethers.Contract {
    if (!ethers.isAddress(address)) {
      throw new BadRequestException('Invalid contract address');
    }
    return new ethers.Contract(address, abi, this.getProvider());
  }
}
