// User service - Business logic for user operations

import { db } from '../config/database';
import { cacheService } from '../config/redis';
// import { contractService } from './contractService';
import { cacheConfig } from '../config';
import logger from '../utils/logger';
import { UserPortfolioData, PortfolioTokenData, TransactionData } from '../types';
import { ethers } from 'ethers';

export class UserService {
  /**
   * Get user portfolio
   */
  async getUserPortfolio(address: string): Promise<UserPortfolioData> {
    const userAddress = address.toLowerCase();
    const cacheKey = `user:${userAddress}:portfolio`;

    // Try cache first
    if (cacheService.isAvailable()) {
      const cached = await cacheService.get<UserPortfolioData>(cacheKey);
      if (cached) {
        logger.debug(`Portfolio cache hit: ${userAddress}`);
        return cached;
      }
    }

    // Get portfolio from database
    const portfolioRecords = await db.userPortfolio.findMany({
      where: {
        userAddress,
        balance: { not: '0' }, // Only non-zero balances
      },
      include: {
        token: true,
      },
    });

    // Format portfolio data (frontend calculates prices)
    const tokens: PortfolioTokenData[] = portfolioRecords.map((record) => {
      const token = record.token;
      const balance = BigInt(record.balance);
      const balanceFormatted = ethers.formatEther(balance);

      const pnl = record.unrealizedPnL + record.realizedPnL;
      const invested = record.totalInvested;
      const pnlPercentage = invested > 0 ? (pnl / invested) * 100 : 0;

      const metadata = token.metadataCache as any;

      return {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        balance: record.balance,
        balanceFormatted,
        price: 0, // Frontend calculates
        value: 0, // Frontend calculates
        averagePrice: record.averagePrice,
        totalInvested: record.totalInvested,
        unrealizedPnL: record.unrealizedPnL,
        realizedPnL: record.realizedPnL,
        pnlPercentage,
        priceChange24h: 0, // Frontend calculates
        isCreator: token.creator === userAddress,
        logo: token.logoURL || metadata?.image,
      };
    });

    // Calculate totals
    const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);
    const totalInvested = tokens.reduce((sum, t) => sum + t.totalInvested, 0);
    const totalPnL = tokens.reduce((sum, t) => sum + t.unrealizedPnL + t.realizedPnL, 0);
    const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    const portfolio: UserPortfolioData = {
      userAddress,
      tokens,
      totalValue,
      totalInvested,
      totalPnL,
      pnlPercentage,
    };

    // Cache the result
    if (cacheService.isAvailable()) {
      await cacheService.set(cacheKey, portfolio, cacheConfig.ttl.tokenDetails / 1000);
    }

    return portfolio;
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(
    address: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ transactions: TransactionData[]; total: number }> {
    const userAddress = address.toLowerCase();
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where: { userAddress },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          token: {
            select: {
              name: true,
              symbol: true,
              metadataCache: true,
            },
          },
        },
      }),
      db.transaction.count({ where: { userAddress } }),
    ]);

    // Format transactions
    const formattedTransactions: TransactionData[] = transactions.map((tx) => ({
      hash: tx.hash,
      userAddress: tx.userAddress,
      tokenAddress: tx.tokenAddress,
      type: tx.type as 'BUY' | 'SELL' | 'CREATE',
      amountIn: tx.amountIn,
      amountOut: tx.amountOut,
      price: tx.price,
      timestamp: tx.timestamp.toISOString(),
      blockNumber: Number(tx.blockNumber),
      status: tx.status as 'SUCCESS' | 'FAILED' | 'PENDING',
      tokenInfo: {
        name: tx.token.name,
        symbol: tx.token.symbol,
        logo: (tx.token.metadataCache as any)?.image,
      },
    }));

    return { transactions: formattedTransactions, total };
  }

  /**
   * Get user created tokens
   */
  async getUserCreatedTokens(address: string) {
    const userAddress = address.toLowerCase();

    const tokens = await db.token.findMany({
      where: { creator: userAddress },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map((token) => {
      const metadata = token.metadataCache as any;

      return {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        description: token.description || metadata?.description,
        logo: token.logoURL || metadata?.image,
        createdAt: token.createdAt.toISOString(),
        marketCap: 0, // Frontend calculates
        price: 0, // Frontend calculates
        holders: 0, // Frontend calculates
        volume24h: 0, // Frontend calculates
        priceChange24h: 0, // Frontend calculates
        tradingEnabled: token.tradingEnabled,
      };
    });
  }

  /**
   * Get user PnL summary
   */
  async getUserPnLSummary(address: string) {
    const userAddress = address.toLowerCase();

    const portfolio = await this.getUserPortfolio(userAddress);

    // Calculate additional stats
    const winningPositions = portfolio.tokens.filter(
      (t) => t.unrealizedPnL + t.realizedPnL > 0
    ).length;
    const losingPositions = portfolio.tokens.filter(
      (t) => t.unrealizedPnL + t.realizedPnL < 0
    ).length;
    const totalPositions = portfolio.tokens.length;

    const winRate =
      totalPositions > 0 ? (winningPositions / totalPositions) * 100 : 0;

    return {
      totalValue: portfolio.totalValue,
      totalInvested: portfolio.totalInvested,
      totalPnL: portfolio.totalPnL,
      pnlPercentage: portfolio.pnlPercentage,
      totalPositions,
      winningPositions,
      losingPositions,
      winRate,
    };
  }

  /**
   * Invalidate user cache
   */
  async invalidateUserCache(userAddress: string): Promise<void> {
    if (cacheService.isAvailable()) {
      await cacheService.deletePattern(`user:${userAddress.toLowerCase()}:*`);
    }
  }
}

// Export singleton instance
export const userService = new UserService();
