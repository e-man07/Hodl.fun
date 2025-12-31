import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider, Log } from 'ethers';
import { BlockTrackerService, BlockRange } from './block-tracker.service';
import { EventParserService } from './parsers/event-parser.service';
import { ParsedEvent } from '../contracts/types';

/**
 * IndexResult represents the result of indexing a block range
 */
export interface IndexResult {
  fromBlock: number;
  toBlock: number;
  events: ParsedEvent[];
  logsProcessed: number;
}

/**
 * IndexerStatus represents the current state of the indexer
 */
export interface IndexerStatus {
  lastProcessedBlock: number;
  currentBlock: number;
  blocksBehind: number;
  isSynced: boolean;
}

/**
 * IndexerService
 *
 * Coordinates blockchain event indexing by:
 * - Using BlockTrackerService to manage block ranges
 * - Using EventParserService to parse raw logs
 * - Fetching logs from the blockchain RPC
 */
@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private readonly provider: JsonRpcProvider;
  private readonly coreAddress: string;
  private readonly factoryAddress: string;

  constructor(
    private readonly blockTrackerService: BlockTrackerService,
    private readonly eventParserService: EventParserService,
    private readonly configService: ConfigService,
  ) {
    const rpcUrl = this.configService.getOrThrow<string>('V2_RPC_URL');
    this.coreAddress = this.configService.getOrThrow<string>('V2_CORE_ADDRESS');
    this.factoryAddress = this.configService.getOrThrow<string>('V2_FACTORY_ADDRESS');
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  /**
   * Fetch logs from the blockchain for a given block range
   * Fetches from both Core and Factory contracts
   */
  async fetchLogs(fromBlock: number, toBlock: number): Promise<Log[]> {
    // Get Core contract event topics
    const coreTopics = this.eventParserService.getCoreEventTopics();
    const bondingCurveTopics = this.eventParserService.getBondingCurveEventTopics();
    const factoryTopics = this.eventParserService.getFactoryEventTopics();

    // Combine core and bonding curve topics for Core contract
    const coreAndBondingCurveTopics = [...coreTopics, ...bondingCurveTopics];

    // Fetch logs from Core contract (Core events + BondingCurve events via Core)
    const coreLogsPromise = this.provider.getLogs({
      address: this.coreAddress,
      topics: [coreAndBondingCurveTopics],
      fromBlock,
      toBlock,
    });

    // Fetch logs from Factory contract (Factory-specific events)
    const factoryLogsPromise = this.provider.getLogs({
      address: this.factoryAddress,
      topics: [factoryTopics],
      fromBlock,
      toBlock,
    });

    // Fetch from all contracts in parallel
    const [coreLogs, factoryLogs] = await Promise.all([
      coreLogsPromise,
      factoryLogsPromise,
    ]);

    // Combine and sort by block number and log index
    const allLogs = [...coreLogs, ...factoryLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber;
      }
      return a.index - b.index;
    });

    return allLogs;
  }

  /**
   * Parse raw logs into typed events
   */
  parseEvents(logs: Log[]): ParsedEvent[] {
    const events: ParsedEvent[] = [];

    for (const log of logs) {
      const parsed = this.eventParserService.parseLog(log);
      if (parsed) {
        events.push(parsed);
      }
    }

    return events;
  }

  /**
   * Index a specific block range
   */
  async indexBlocks(fromBlock: number, toBlock: number): Promise<IndexResult> {
    this.logger.debug(`Indexing blocks ${fromBlock} to ${toBlock}`);

    const logs = await this.fetchLogs(fromBlock, toBlock);
    const events = this.parseEvents(logs);

    // Mark blocks as processed
    this.blockTrackerService.markBlocksProcessed(fromBlock, toBlock);

    this.logger.debug(`Processed ${logs.length} logs, found ${events.length} events`);

    return {
      fromBlock,
      toBlock,
      events,
      logsProcessed: logs.length,
    };
  }

  /**
   * Index the next batch of blocks
   * @param batchSize Optional custom batch size
   * @returns IndexResult or null if no blocks to process
   */
  async indexNextBatch(batchSize?: number): Promise<IndexResult | null> {
    const range: BlockRange = await this.blockTrackerService.getBlockRange(batchSize);

    // Check if there are blocks to process
    if (range.fromBlock > range.toBlock) {
      this.logger.debug('No new blocks to process');
      return null;
    }

    return this.indexBlocks(range.fromBlock, range.toBlock);
  }

  /**
   * Get current indexer status
   */
  async getIndexerStatus(): Promise<IndexerStatus> {
    const lastProcessedBlock = this.blockTrackerService.getLastProcessedBlock();
    const currentBlock = await this.blockTrackerService.getCurrentBlockNumber();
    const blocksBehind = await this.blockTrackerService.getBlocksBehind();

    return {
      lastProcessedBlock,
      currentBlock,
      blocksBehind,
      isSynced: blocksBehind === 0,
    };
  }

  /**
   * Index events for a specific token address
   * Useful for on-demand token data fetching
   */
  async indexEventsForToken(
    tokenAddress: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<IndexResult> {
    const topics = this.eventParserService.getAllKnownTopics();

    // Pad token address for indexed topic matching
    const paddedAddress = '0x' + tokenAddress.slice(2).toLowerCase().padStart(64, '0');

    const logs = await this.provider.getLogs({
      address: this.coreAddress,
      topics: [topics, paddedAddress],
      fromBlock,
      toBlock,
    });

    const events = this.parseEvents(logs);

    return {
      fromBlock,
      toBlock,
      events,
      logsProcessed: logs.length,
    };
  }

  /**
   * Index events by type for a specific block range
   */
  async indexEventsByType(
    eventType: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<ParsedEvent[]> {
    const result = await this.indexBlocks(fromBlock, toBlock);
    return result.events.filter((e) => e.type === eventType);
  }

  /**
   * Run continuous indexing loop
   * Returns a function to stop the loop
   */
  startContinuousIndexing(intervalMs: number = 5000): () => void {
    let running = true;

    const indexLoop = async () => {
      while (running) {
        try {
          const hasBlocks = await this.blockTrackerService.hasBlocksToProcess();

          if (hasBlocks) {
            const result = await this.indexNextBatch();
            if (result) {
              this.logger.log(
                `Indexed ${result.events.length} events from blocks ${result.fromBlock}-${result.toBlock}`,
              );
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
          }
        } catch (error) {
          this.logger.error('Error during indexing:', error);
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }
    };

    // Start the loop
    indexLoop();

    // Return stop function
    return () => {
      running = false;
    };
  }
}
