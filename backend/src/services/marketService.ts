// Market statistics service
// Calculates market stats from Token table (metrics updated by indexer/workers)

import { db } from '../config/database';
import { ethers } from 'ethers';
import logger from '../utils/logger';

export class MarketService {
  /**
   * Get trending tokens (sorted by 24h volume)
   */
  async getTrendingTokens(limit: number = 10) {
    try {
      const tokens = await db.token.findMany({
        where: {
          tradingEnabled: true,
          volume24h: { gt: 0 },
        },
        orderBy: { volume24h: 'desc' },
        take: limit,
      });
      return tokens;
    } catch (error) {
      logger.error('Error getting trending tokens:', error);
      return [];
    }
  }

  /**
   * Get top tokens by market cap
   */
  async getTopTokens(limit: number = 10) {
    try {
      const tokens = await db.token.findMany({
        where: {
          tradingEnabled: true,
          marketCap: { gt: 0 },
        },
        orderBy: { marketCap: 'desc' },
        take: limit,
      });
      return tokens;
    } catch (error) {
      logger.error('Error getting top tokens:', error);
      return [];
    }
  }

  /**
   * Get biggest gainers (sorted by 24h price change)
   */
  async getBiggestGainers(limit: number = 10) {
    try {
      const tokens = await db.token.findMany({
        where: {
          tradingEnabled: true,
          priceChange24h: { gt: 0 },
        },
        orderBy: { priceChange24h: 'desc' },
        take: limit,
      });
      return tokens;
    } catch (error) {
      logger.error('Error getting biggest gainers:', error);
      return [];
    }
  }

  /**
   * Get top gainers (alias for getBiggestGainers)
   */
  async getTopGainers(limit: number = 10) {
    return this.getBiggestGainers(limit);
  }

  /**
   * Get top losers (sorted by 24h price change ascending)
   */
  async getTopLosers(limit: number = 10) {
    try {
      const tokens = await db.token.findMany({
        where: {
          tradingEnabled: true,
          priceChange24h: { lt: 0 },
        },
        orderBy: { priceChange24h: 'asc' },
        take: limit,
      });
      return tokens;
    } catch (error) {
      logger.error('Error getting top losers:', error);
      return [];
    }
  }

  /**
   * Get market stats (aggregated from Token table)
   */
  async getMarketStats() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Run aggregations in parallel
      const [
        totalTokens,
        marketCapSum,
        volumeSum,
        holderCountSum,
        newTokens24h,
        trades24h,
        activeUsers24h,
        avgPrice,
      ] = await Promise.all([
        // Total number of tokens
        db.token.count(),

        // Total market cap
        db.token.aggregate({
          _sum: { marketCap: true },
        }),

        // Total 24h volume
        db.token.aggregate({
          _sum: { volume24h: true },
        }),

        // Total holders across all tokens
        db.token.aggregate({
          _sum: { holderCount: true },
        }),

        // New tokens created in last 24h
        db.token.count({
          where: {
            createdAt: { gte: twentyFourHoursAgo },
          },
        }),

        // Number of trades in last 24h
        db.transaction.count({
          where: {
            type: { in: ['BUY', 'SELL'] },
            timestamp: { gte: twentyFourHoursAgo },
          },
        }),

        // Active users in last 24h (unique addresses)
        db.transaction.findMany({
          where: {
            timestamp: { gte: twentyFourHoursAgo },
          },
          select: { userAddress: true },
          distinct: ['userAddress'],
        }),

        // Average token price
        db.token.aggregate({
          _avg: { currentPrice: true },
          where: {
            tradingEnabled: true,
            currentPrice: { gt: 0 },
          },
        }),
      ]);

      return {
        totalTokens,
        totalMarketCap: marketCapSum._sum.marketCap || 0,
        totalVolume24h: volumeSum._sum.volume24h || 0,
        totalHolders: holderCountSum._sum.holderCount || 0,
        newTokens24h,
        trades24h,
        activeUsers24h: activeUsers24h.length,
        avgTokenPrice: avgPrice._avg.currentPrice || 0,
      };
    } catch (error) {
      logger.error('Error getting market stats:', error);
      return {
        totalTokens: 0,
        totalMarketCap: 0,
        totalVolume24h: 0,
        totalHolders: 0,
        newTokens24h: 0,
        trades24h: 0,
        activeUsers24h: 0,
        avgTokenPrice: 0,
      };
    }
  }

  /**
   * Get recent trades across all tokens (for trading activity banner)
   */
  async getRecentTrades(limit: number = 10) {
    try {
      const transactions = await db.transaction.findMany({
        where: {
          type: { in: ['BUY', 'SELL'] },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
          token: {
            select: {
              name: true,
              symbol: true,
              metadataCache: true,
            },
          },
        },
      });

      // Format transaction data for frontend
      const trades = transactions.map((tx) => {
        // Convert wei strings to formatted numbers
        const amountInFormatted = ethers.formatEther(tx.amountIn);
        const amountOutFormatted = ethers.formatEther(tx.amountOut);

        // For BUY: amountIn is ETH spent, amountOut is tokens received
        // For SELL: amountIn is tokens sold, amountOut is ETH received
        const ethAmount = tx.type === 'BUY' ? amountInFormatted : amountOutFormatted;
        const tokenAmount = tx.type === 'BUY' ? amountOutFormatted : amountInFormatted;

        // Clean token symbol (remove ETH prefix if present)
        let symbol = tx.token.symbol;
        const upperSymbol = symbol.toUpperCase();
        if (upperSymbol.startsWith('ETH ') && symbol.length > 4) {
          symbol = symbol.substring(4).trim();
        } else if (upperSymbol.startsWith('ETH') && symbol.length > 3 && upperSymbol !== 'ETH') {
          symbol = symbol.substring(3).trim();
        }

        return {
          hash: tx.hash,
          type: tx.type.toLowerCase() as 'buy' | 'sell',
          userAddress: tx.userAddress,
          tokenAddress: tx.tokenAddress,
          ethAmount,
          tokenAmount,
          price: tx.price,
          timestamp: tx.timestamp.toISOString(),
          blockNumber: Number(tx.blockNumber),
          tokenSymbol: symbol || 'TOKEN',
          tokenName: tx.token.name,
          tokenLogo: (tx.token.metadataCache as any)?.image,
        };
      });

      return trades;
    } catch (error) {
      logger.error('Error getting recent trades:', error);
      return [];
    }
  }
}

export const marketService = new MarketService();
