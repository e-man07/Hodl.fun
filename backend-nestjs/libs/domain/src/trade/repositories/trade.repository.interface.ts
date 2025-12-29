import { Trade } from '../entities/trade.entity';

/**
 * Trade Repository Interface (Port)
 *
 * Defines the contract for Trade entity persistence.
 * Trades are immutable records of blockchain transactions.
 */
export interface ITradeRepository {
  /**
   * Find a trade by ID
   */
  findById(id: string): Promise<Trade | null>;

  /**
   * Find all trades for a specific token
   */
  findByTokenId(
    tokenId: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: 'timestamp' | 'pricePerToken';
      orderDirection?: 'asc' | 'desc';
    },
  ): Promise<{
    trades: Trade[];
    total: number;
  }>;

  /**
   * Find all trades by a specific user
   */
  findByUser(
    user: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: 'timestamp' | 'totalValue';
      orderDirection?: 'asc' | 'desc';
    },
  ): Promise<{
    trades: Trade[];
    total: number;
  }>;

  /**
   * Find trades for a user on a specific token
   */
  findByUserAndToken(
    user: string,
    tokenId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    trades: Trade[];
    total: number;
  }>;

  /**
   * Save a new trade (immutable insert)
   */
  save(trade: Trade): Promise<Trade>;

  /**
   * Batch save multiple trades
   */
  saveBatch(trades: Trade[]): Promise<Trade[]>;

  /**
   * Get trades after a specific timestamp (for indexing)
   */
  findAfterTimestamp(
    timestamp: Date,
    limit?: number,
  ): Promise<Trade[]>;

  /**
   * Get trades within a block range (for indexing)
   */
  findByBlockRange(
    startBlock: number,
    endBlock: number,
    limit?: number,
  ): Promise<Trade[]>;

  /**
   * Count total trades
   */
  count(): Promise<number>;

  /**
   * Get trade statistics for a token
   */
  getTokenStats(tokenId: string): Promise<{
    totalTrades: number;
    totalBuyVolume: bigint;
    totalSellVolume: bigint;
    uniqueTraders: number;
    avgBuyPrice: bigint;
    avgSellPrice: bigint;
  }>;

  /**
   * Get user trade statistics
   */
  getUserStats(user: string): Promise<{
    totalTrades: number;
    totalBuyVolume: bigint;
    totalSellVolume: bigint;
    totalTokensBought: bigint;
    totalTokensSold: bigint;
    realizedPNL: bigint;
  }>;
}

/**
 * Trade Repository Symbol for DI
 */
export const TRADE_REPOSITORY = Symbol('ITradeRepository');
