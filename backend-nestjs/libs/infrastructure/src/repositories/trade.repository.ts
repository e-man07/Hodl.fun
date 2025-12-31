import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core';
import { Trade, ITradeRepository } from '@domain';
import { Transaction as PrismaTransaction, Prisma } from '@prisma/client';

/**
 * Order by type for transaction queries
 */
type TransactionOrderBy = Prisma.TransactionOrderByWithRelationInput;

/**
 * Trade Repository (Adapter)
 *
 * Implements ITradeRepository interface using Prisma ORM
 * Handles all database operations for Trade entities
 *
 * Trades are immutable records - no updates, only inserts and reads
 * Maps between Prisma Transaction model and domain Trade entity
 */
@Injectable()
export class TradeRepository implements ITradeRepository {
  private readonly logger = new Logger(TradeRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Trade | null> {
    try {
      const tradeData = await this.prisma.transaction.findUnique({
        where: { hash: id },
      });

      if (!tradeData) {
        return null;
      }

      return this.mapPrismaToTrade(tradeData);
    } catch (error) {
      this.logger.error(`Error finding trade by ID ${id}: ${error.message}`);
      throw error;
    }
  }

  async findByTokenId(
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
  }> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      const sortBy = options?.orderBy === 'pricePerToken' ? 'price' : 'timestamp';
      const sortDirection = options?.orderDirection || 'desc';

      const orderBy: TransactionOrderBy = sortBy === 'timestamp'
        ? { timestamp: sortDirection }
        : { price: sortDirection };

      const [tradeDataList, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { tokenAddress: tokenId },
          orderBy,
          take: limit,
          skip: offset,
        }),
        this.prisma.transaction.count({ where: { tokenAddress: tokenId } }),
      ]);

      const trades = tradeDataList.map((data) => this.mapPrismaToTrade(data));

      return {
        trades,
        total,
      };
    } catch (error) {
      this.logger.error(
        `Error finding trades by token ID ${tokenId}: ${error.message}`,
      );
      throw error;
    }
  }

  async findByUser(
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
  }> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      const sortBy = options?.orderBy || 'timestamp';
      const sortDirection = options?.orderDirection || 'desc';

      const orderBy: TransactionOrderBy = sortBy === 'totalValue'
        ? { price: sortDirection }
        : { timestamp: sortDirection };

      const [tradeDataList, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { userAddress: user },
          orderBy,
          take: limit,
          skip: offset,
        }),
        this.prisma.transaction.count({ where: { userAddress: user } }),
      ]);

      const trades = tradeDataList.map((data) => this.mapPrismaToTrade(data));

      return {
        trades,
        total,
      };
    } catch (error) {
      this.logger.error(
        `Error finding trades by user ${user}: ${error.message}`,
      );
      throw error;
    }
  }

  async findByUserAndToken(
    user: string,
    tokenId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    trades: Trade[];
    total: number;
  }> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const [tradeDataList, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { userAddress: user, tokenAddress: tokenId },
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.transaction.count({
          where: { userAddress: user, tokenAddress: tokenId },
        }),
      ]);

      const trades = tradeDataList.map((data) => this.mapPrismaToTrade(data));

      return {
        trades,
        total,
      };
    } catch (error) {
      this.logger.error(
        `Error finding trades by user ${user} and token ${tokenId}: ${error.message}`,
      );
      throw error;
    }
  }

  async save(trade: Trade): Promise<Trade> {
    try {
      const tradeData = await this.prisma.transaction.create({
        data: {
          hash: trade.id,
          tokenAddress: trade.tokenId,
          type: trade.type.toUpperCase() as 'BUY' | 'SELL',
          userAddress: trade.user,
          amountIn: trade.amountIn.toString(),
          amountOut: trade.amountOut.toString(),
          price: Number(trade.pricePerToken) / 1e18, // Convert wei to float
          timestamp: trade.timestamp,
          blockNumber: BigInt(trade.blockNumber),
        },
      });

      return this.mapPrismaToTrade(tradeData);
    } catch (error) {
      this.logger.error(`Error saving trade ${trade.id}: ${error.message}`);
      throw error;
    }
  }

  async saveBatch(trades: Trade[]): Promise<Trade[]> {
    try {
      const createdTrades = await Promise.all(
        trades.map((trade) => this.save(trade)),
      );
      return createdTrades;
    } catch (error) {
      this.logger.error(
        `Error saving batch of ${trades.length} trades: ${error.message}`,
      );
      throw error;
    }
  }

  async findAfterTimestamp(
    timestamp: Date,
    limit?: number,
  ): Promise<Trade[]> {
    try {
      const tradeDataList = await this.prisma.transaction.findMany({
        where: {
          timestamp: {
            gte: timestamp,
          },
        },
        orderBy: { timestamp: 'asc' },
        take: limit || 1000,
      });

      return tradeDataList.map((data) => this.mapPrismaToTrade(data));
    } catch (error) {
      this.logger.error(
        `Error finding trades after timestamp: ${error.message}`,
      );
      throw error;
    }
  }

  async findByBlockRange(
    startBlock: number,
    endBlock: number,
    limit?: number,
  ): Promise<Trade[]> {
    try {
      const tradeDataList = await this.prisma.transaction.findMany({
        where: {
          blockNumber: {
            gte: BigInt(startBlock),
            lte: BigInt(endBlock),
          },
        },
        orderBy: { blockNumber: 'asc' },
        take: limit || 1000,
      });

      return tradeDataList.map((data) => this.mapPrismaToTrade(data));
    } catch (error) {
      this.logger.error(
        `Error finding trades in block range ${startBlock}-${endBlock}: ${error.message}`,
      );
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      return await this.prisma.transaction.count();
    } catch (error) {
      this.logger.error(`Error counting trades: ${error.message}`);
      throw error;
    }
  }

  async getTokenStats(tokenId: string): Promise<{
    totalTrades: number;
    totalBuyVolume: bigint;
    totalSellVolume: bigint;
    uniqueTraders: number;
    avgBuyPrice: bigint;
    avgSellPrice: bigint;
  }> {
    try {
      const buyTrades = await this.prisma.transaction.findMany({
        where: { tokenAddress: tokenId, type: 'BUY' },
      });

      const sellTrades = await this.prisma.transaction.findMany({
        where: { tokenAddress: tokenId, type: 'SELL' },
      });

      const allTrades = [...buyTrades, ...sellTrades];
      const uniqueTraders = new Set(allTrades.map((t) => t.userAddress)).size;

      const totalBuyVolume = buyTrades.reduce(
        (sum: bigint, t: PrismaTransaction) => sum + BigInt(t.amountIn),
        0n,
      );
      const totalSellVolume = sellTrades.reduce(
        (sum: bigint, t: PrismaTransaction) => sum + BigInt(t.amountOut),
        0n,
      );

      const avgBuyPrice =
        buyTrades.length > 0
          ? buyTrades.reduce(
              (sum: bigint, t: PrismaTransaction) => sum + BigInt(Math.floor(t.price * 1e18)),
              0n,
            ) / BigInt(buyTrades.length)
          : 0n;

      const avgSellPrice =
        sellTrades.length > 0
          ? sellTrades.reduce(
              (sum: bigint, t: PrismaTransaction) => sum + BigInt(Math.floor(t.price * 1e18)),
              0n,
            ) / BigInt(sellTrades.length)
          : 0n;

      return {
        totalTrades: allTrades.length,
        totalBuyVolume,
        totalSellVolume,
        uniqueTraders,
        avgBuyPrice,
        avgSellPrice,
      };
    } catch (error) {
      this.logger.error(
        `Error getting stats for token ${tokenId}: ${error.message}`,
      );
      throw error;
    }
  }

  async getUserStats(user: string): Promise<{
    totalTrades: number;
    totalBuyVolume: bigint;
    totalSellVolume: bigint;
    totalTokensBought: bigint;
    totalTokensSold: bigint;
    realizedPNL: bigint;
  }> {
    try {
      const buyTrades = await this.prisma.transaction.findMany({
        where: { userAddress: user, type: 'BUY' },
      });

      const sellTrades = await this.prisma.transaction.findMany({
        where: { userAddress: user, type: 'SELL' },
      });

      const totalBuyVolume = buyTrades.reduce(
        (sum: bigint, t: PrismaTransaction) => sum + BigInt(t.amountIn),
        0n,
      );
      const totalSellVolume = sellTrades.reduce(
        (sum: bigint, t: PrismaTransaction) => sum + BigInt(t.amountOut),
        0n,
      );

      const totalTokensBought = buyTrades.reduce(
        (sum: bigint, t: PrismaTransaction) => sum + BigInt(t.amountOut),
        0n,
      );
      const totalTokensSold = sellTrades.reduce(
        (sum: bigint, t: PrismaTransaction) => sum + BigInt(t.amountIn),
        0n,
      );

      // Simple PNL calculation (total received - total spent)
      const realizedPNL = totalSellVolume - totalBuyVolume;

      return {
        totalTrades: buyTrades.length + sellTrades.length,
        totalBuyVolume,
        totalSellVolume,
        totalTokensBought,
        totalTokensSold,
        realizedPNL,
      };
    } catch (error) {
      this.logger.error(
        `Error getting stats for user ${user}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Map Prisma transaction data to Trade domain entity
   */
  private mapPrismaToTrade(prismaTradeData: PrismaTransaction): Trade {
    return Trade.reconstruct({
      id: prismaTradeData.hash,
      tokenId: prismaTradeData.tokenAddress,
      type: prismaTradeData.type.toLowerCase() as 'buy' | 'sell',
      user: prismaTradeData.userAddress,
      amountIn: BigInt(prismaTradeData.amountIn),
      amountOut: BigInt(prismaTradeData.amountOut),
      pricePerToken: BigInt(Math.floor(prismaTradeData.price * 1e18)), // Convert float to wei
      totalValue: BigInt(prismaTradeData.amountIn), // Using amountIn as totalValue for now
      transactionHash: prismaTradeData.hash,
      blockNumber: Number(prismaTradeData.blockNumber),
      timestamp: prismaTradeData.timestamp,
    });
  }
}
