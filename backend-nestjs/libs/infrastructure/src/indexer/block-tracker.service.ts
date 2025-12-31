import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider } from 'ethers';

/**
 * BlockRange represents a range of blocks to process
 */
export interface BlockRange {
  fromBlock: number;
  toBlock: number;
}

/**
 * BlockTrackerService
 *
 * Tracks the last processed block number and manages block range queries
 * for polling-based event indexing.
 */
@Injectable()
export class BlockTrackerService {
  private readonly provider: JsonRpcProvider;
  private readonly startBlock: number;
  private readonly batchSize: number;
  private lastProcessedBlock: number;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.getOrThrow<string>('V2_RPC_URL');

    this.provider = new JsonRpcProvider(rpcUrl);

    // Initialize from config or default to 0
    const startBlockConfig = this.configService.get<string>('INDEXER_START_BLOCK');
    this.startBlock = startBlockConfig ? parseInt(startBlockConfig, 10) : 0;
    this.lastProcessedBlock = this.startBlock;

    // Batch size for processing blocks
    const batchSizeConfig = this.configService.get<string>('INDEXER_BATCH_SIZE');
    this.batchSize = batchSizeConfig ? parseInt(batchSizeConfig, 10) : 1000;
  }

  /**
   * Get the last processed block number
   */
  getLastProcessedBlock(): number {
    return this.lastProcessedBlock;
  }

  /**
   * Set the last processed block number
   * Only updates if the new block is >= current (prevents going backwards)
   */
  setLastProcessedBlock(blockNumber: number): void {
    if (blockNumber >= this.lastProcessedBlock) {
      this.lastProcessedBlock = blockNumber;
    }
  }

  /**
   * Get the current block number from the blockchain
   */
  async getCurrentBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Get the next block range to process
   * @param customBatchSize Optional custom batch size
   * @returns Block range from (lastProcessed + 1) to min(lastProcessed + batchSize, currentBlock)
   */
  async getBlockRange(customBatchSize?: number): Promise<BlockRange> {
    const currentBlock = await this.getCurrentBlockNumber();
    const batchSize = customBatchSize || this.batchSize;

    const fromBlock = this.lastProcessedBlock + 1;
    const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);

    return { fromBlock, toBlock };
  }

  /**
   * Check if there are blocks to process
   */
  async hasBlocksToProcess(): Promise<boolean> {
    const currentBlock = await this.getCurrentBlockNumber();
    return this.lastProcessedBlock < currentBlock;
  }

  /**
   * Get the number of blocks behind the current block
   */
  async getBlocksBehind(): Promise<number> {
    const currentBlock = await this.getCurrentBlockNumber();
    return Math.max(0, currentBlock - this.lastProcessedBlock);
  }

  /**
   * Mark a range of blocks as processed
   * @param fromBlock Starting block (unused but for clarity)
   * @param toBlock Ending block - sets as last processed
   */
  markBlocksProcessed(_fromBlock: number, toBlock: number): void {
    this.setLastProcessedBlock(toBlock);
  }

  /**
   * Get the configured batch size
   */
  getBatchSize(): number {
    return this.batchSize;
  }

  /**
   * Get the configured start block
   */
  getStartBlock(): number {
    return this.startBlock;
  }
}
