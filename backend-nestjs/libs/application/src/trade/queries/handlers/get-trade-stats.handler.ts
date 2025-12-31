import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { GetTradeStatsQuery } from '../get-trade-stats.query';
import { ITradeRepository, TRADE_REPOSITORY } from '@domain';

/**
 * Trade Stats Result
 */
export interface TradeStatsResult {
  tokenId?: string;
  user?: string;
  totalTrades: number;
  totalBuyVolume: bigint;
  totalSellVolume: bigint;
  totalTokensBought?: bigint;
  totalTokensSold?: bigint;
  uniqueTraders: number;
  avgBuyPrice?: bigint;
  avgSellPrice?: bigint;
  realizedPNL?: bigint;
}

/**
 * Get Trade Stats Query Handler
 *
 * Retrieves trade statistics, optionally filtered by token or user
 */
@Injectable()
@QueryHandler(GetTradeStatsQuery)
export class GetTradeStatsHandler implements IQueryHandler<GetTradeStatsQuery> {
  private readonly logger = new Logger(GetTradeStatsHandler.name);

  constructor(
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: ITradeRepository,
  ) {}

  async execute(query: GetTradeStatsQuery): Promise<TradeStatsResult> {
    try {
      // If filtering by user, get user stats
      if (query.user) {
        const userStats = await this.tradeRepository.getUserStats(query.user);
        return {
          user: query.user,
          totalTrades: userStats.totalTrades,
          totalBuyVolume: userStats.totalBuyVolume,
          totalSellVolume: userStats.totalSellVolume,
          totalTokensBought: userStats.totalTokensBought,
          totalTokensSold: userStats.totalTokensSold,
          uniqueTraders: 1, // Single user
          realizedPNL: userStats.realizedPNL,
        };
      }

      // If filtering by token, get token stats
      if (query.tokenId) {
        const tokenStats = await this.tradeRepository.getTokenStats(
          query.tokenId,
        );
        return {
          tokenId: query.tokenId,
          totalTrades: tokenStats.totalTrades,
          totalBuyVolume: tokenStats.totalBuyVolume,
          totalSellVolume: tokenStats.totalSellVolume,
          uniqueTraders: tokenStats.uniqueTraders,
          avgBuyPrice: tokenStats.avgBuyPrice,
          avgSellPrice: tokenStats.avgSellPrice,
        };
      }

      // No filter - return global stats (sum of all trades)
      const totalTrades = await this.tradeRepository.count();
      return {
        totalTrades,
        totalBuyVolume: 0n,
        totalSellVolume: 0n,
        uniqueTraders: 0,
      };
    } catch (error) {
      this.logger.error(`Query failed: ${error.message}`);
      throw error;
    }
  }
}
