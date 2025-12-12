// Token service - Business logic for token operations

import { db } from '../config/database';
import { cacheService } from '../config/redis';
import { contractService } from './contractService';
import { cacheConfig } from '../config';
import logger from '../utils/logger';
import { TokenData, TokenQueryParams, TokenHolderData, NotFoundError } from '../types';
import { ethers } from 'ethers';

export class TokenService {
  /**
   * Get all tokens with pagination, filtering, and sorting
   */
  async getTokens(params: TokenQueryParams) {
    const {
      page = 1,
      limit = 24,
      sort = 'marketCap',
      order = 'desc',
      search,
      creator,
      minMarketCap: _minMarketCap,
      maxMarketCap: _maxMarketCap,
      minPrice: _minPrice,
      maxPrice: _maxPrice,
    } = params;

    const skip = (page - 1) * limit;

    // Build cache key
    const cacheKey = `tokens:list:${JSON.stringify(params)}`;

    // Try cache first
    if (cacheService.isAvailable()) {
      const cached = await cacheService.get<{ tokens: TokenData[]; total: number }>(cacheKey);
      if (cached) {
        logger.debug('Token list cache hit');
        return cached;
      }
    }

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { symbol: { contains: search, mode: 'insensitive' } },
        { address: { equals: search.toLowerCase() } },
      ];
    }

    if (creator) {
      where.creator = creator.toLowerCase();
    }

    // Get tokens from database
    const [tokens, total] = await Promise.all([
      db.token.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildOrderBy(sort, order),
      }),
      db.token.count({ where }),
    ]);

    // Transform to TokenData format (without metrics - frontend calculates these)
    const tokenData = await Promise.all(
      tokens.map(async (token) => {
        return this.formatTokenData(token);
      })
    );

    const filteredTokens = tokenData;

    const result = {
      tokens: filteredTokens,
      total,
    };

    // Cache the result
    if (cacheService.isAvailable()) {
      await cacheService.set(cacheKey, result, cacheConfig.ttl.tokenList / 1000);
    }

    return result;
  }

  /**
   * Get token details by address
   */
  async getTokenByAddress(address: string): Promise<TokenData> {
    const tokenAddress = address.toLowerCase();
    const cacheKey = `token:${tokenAddress}`;

    // Try cache first
    if (cacheService.isAvailable()) {
      const cached = await cacheService.get<TokenData>(cacheKey);
      if (cached) {
        logger.debug(`Token cache hit: ${tokenAddress}`);
        return cached;
      }
    }

    // Get from database
    const token = await db.token.findUnique({
      where: { address: tokenAddress },
      include: {
        _count: {
          select: { holders: true },
        },
      },
    });

    if (!token) {
      throw new NotFoundError(`Token ${tokenAddress} not found`);
    }

    const tokenData = this.formatTokenData(token);

    // Cache the result
    if (cacheService.isAvailable()) {
      await cacheService.set(cacheKey, tokenData, cacheConfig.ttl.tokenDetails / 1000);
    }

    return tokenData;
  }

  /**
   * Get token metrics (price history)
   * DEPRECATED: TokenMetric table removed - frontend calculates these values
   */
  async getTokenMetrics(
    _address: string,
    _period: '1h' | '24h' | '7d' | '30d' | 'all' = '24h'
  ) {
    // Return empty array - frontend doesn't use this anymore
    return [];
  }

  /**
   * Get token holders
   */
  async getTokenHolders(
    address: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ holders: TokenHolderData[]; total: number }> {
    const tokenAddress = address.toLowerCase();
    const skip = (page - 1) * limit;

    const [holders, total] = await Promise.all([
      db.holder.findMany({
        where: {
          tokenAddress,
          balance: { not: '0' }, // Only non-zero balances
        },
        skip,
        take: limit,
        orderBy: { balance: 'desc' },
      }),
      db.holder.count({
        where: {
          tokenAddress,
          balance: { not: '0' },
        },
      }),
    ]);

    // Get token details for percentage calculation
    const token = await db.token.findUnique({
      where: { address: tokenAddress },
      select: { totalSupply: true },
    });

    const totalSupply = token ? BigInt(token.totalSupply) : BigInt(0);

    // Format holder data
    const holderData: TokenHolderData[] = holders.map((holder) => {
      const balance = BigInt(holder.balance);
      const balanceFormatted = ethers.formatEther(balance);
      const percentage = totalSupply > 0
        ? (Number(balance) / Number(totalSupply)) * 100
        : 0;

      return {
        holderAddress: holder.holderAddress,
        balance: holder.balance,
        balanceFormatted,
        percentage,
        firstAcquired: holder.firstAcquired.toISOString(),
        lastUpdated: holder.lastUpdated.toISOString(),
      };
    });

    return { holders: holderData, total };
  }

  /**
   * Get token trades (transactions)
   */
  async getTokenTrades(address: string, page: number = 1, limit: number = 50) {
    const tokenAddress = address.toLowerCase();
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where: {
          tokenAddress,
          type: { in: ['BUY', 'SELL'] },
        },
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
      db.transaction.count({
        where: {
          tokenAddress,
          type: { in: ['BUY', 'SELL'] },
        },
      }),
    ]);

    // Format transaction data
    const trades = transactions.map((tx) => ({
      hash: tx.hash,
      userAddress: tx.userAddress,
      tokenAddress: tx.tokenAddress,
      type: tx.type as 'BUY' | 'SELL',
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

    return { trades, total };
  }

  /**
   * Update token metrics from blockchain
   * Fetches current price, market cap, volume, and other metrics
   */
  async updateTokenMetrics(address: string): Promise<void> {
    const tokenAddress = address.toLowerCase();

    try {
      // Fetch current price and market info from blockchain
      const [priceBigInt, marketInfo, holderCount] = await Promise.all([
        contractService.getCurrentPrice(tokenAddress),
        contractService.getTokenMarketInfo(tokenAddress),
        this.getHolderCount(tokenAddress),
      ]);

      const currentPrice = Number(priceBigInt) / 1e18;
      const currentSupply = marketInfo.currentSupply.toString();
      const reserveBalance = marketInfo.reserveBalance.toString();
      const marketCap = (Number(currentSupply) / 1e18) * currentPrice;

      // Calculate 24h volume from transactions
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTrades = await db.transaction.findMany({
        where: {
          tokenAddress,
          type: { in: ['BUY', 'SELL'] },
          timestamp: { gte: twentyFourHoursAgo },
        },
      });

      const volume24h = recentTrades.reduce((sum, tx) => {
        // For buy transactions, count ETH spent (amountIn)
        // For sell transactions, count ETH received (amountOut)
        const ethAmount = tx.type === 'BUY'
          ? Number(tx.amountIn) / 1e18
          : Number(tx.amountOut) / 1e18;
        return sum + ethAmount;
      }, 0);

      // Calculate 24h price change
      // Find the trade closest to 24 hours ago (not just the oldest in the range)
      let priceChange24h = 0;
      if (recentTrades.length > 0) {
        const twentyFourHoursAgoTime = twentyFourHoursAgo.getTime();

        // Sort by timestamp ascending
        const sortedTrades = [...recentTrades].sort((a, b) =>
          a.timestamp.getTime() - b.timestamp.getTime()
        );

        // Find the trade closest to 24h ago for baseline price
        let baselinePrice = sortedTrades[0]?.price || currentPrice;
        let closestTimeDiff = Math.abs(sortedTrades[0]?.timestamp.getTime() - twentyFourHoursAgoTime);

        for (const trade of sortedTrades) {
          const timeDiff = Math.abs(trade.timestamp.getTime() - twentyFourHoursAgoTime);
          if (timeDiff < closestTimeDiff) {
            closestTimeDiff = timeDiff;
            baselinePrice = trade.price;
          }
        }

        // Calculate percentage change from baseline
        if (baselinePrice > 0) {
          priceChange24h = ((currentPrice - baselinePrice) / baselinePrice) * 100;
        }
      }

      // Update token record with new metrics
      await db.token.update({
        where: { address: tokenAddress },
        data: {
          currentPrice,
          marketCap,
          volume24h,
          priceChange24h,
          currentSupply,
          reserveBalance,
          holderCount,
          metricsUpdatedAt: new Date(),
        },
      });

      // Invalidate cache after updating metrics
      await this.invalidateTokenCache(tokenAddress);

      logger.debug(`Updated metrics for ${tokenAddress}: price=${currentPrice}, marketCap=${marketCap}, volume24h=${volume24h}`);
    } catch (error) {
      logger.error(`Error updating token metrics for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Format token data
   * Returns metrics stored in database (updated by indexer and workers)
   * Converts wei values to human-readable numbers for frontend consumption
   */
  private formatTokenData(token: any): TokenData {
    const metadata = token.metadataCache as any;

    // Convert wei strings to human-readable token amounts
    // Database stores raw BigInt strings (e.g., "32000000000000000000" for 32 tokens)
    const currentSupplyWei = token.currentSupply || token.totalSupply || '0';
    const totalSupplyWei = token.totalSupply || '0';
    const reserveBalanceWei = token.reserveBalance || '0';

    // Safe conversion from wei to tokens (18 decimals)
    const formatWeiToTokens = (weiString: string): string => {
      try {
        // Handle already formatted numbers (backwards compatibility)
        const num = Number(weiString);
        if (!isNaN(num) && num > 0 && num < 1e15) {
          // Already a reasonable number, not wei
          return weiString;
        }
        // Convert from wei (18 decimals)
        return ethers.formatEther(weiString);
      } catch {
        return '0';
      }
    };

    // Format supplies as token amounts
    const currentSupplyFormatted = formatWeiToTokens(currentSupplyWei);
    const totalSupplyFormatted = formatWeiToTokens(totalSupplyWei);
    const reserveBalanceFormatted = formatWeiToTokens(reserveBalanceWei);

    // Recalculate market cap if it seems incorrect
    // Market cap = currentSupply (in tokens) × price
    let marketCap = token.marketCap || 0;
    const currentSupplyNum = parseFloat(currentSupplyFormatted);
    const price = token.currentPrice || 0;

    // If stored marketCap is suspiciously small (scientific notation bug) or zero, recalculate
    if (marketCap < 0.000001 && currentSupplyNum > 0 && price > 0) {
      marketCap = currentSupplyNum * price;
    }

    return {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      description: token.description || metadata?.description,
      price: price,
      priceChange24h: token.priceChange24h || 0,
      marketCap: marketCap,
      volume24h: token.volume24h || 0,
      holders: token.holderCount || 0,
      createdAt: token.createdAt.toISOString(),
      creator: token.creator,
      reserveRatio: token.reserveRatio,
      tradingEnabled: token.tradingEnabled,
      logo: token.logoURL || metadata?.image,
      currentSupply: currentSupplyFormatted,
      totalSupply: totalSupplyFormatted,
      reserveBalance: reserveBalanceFormatted,
      socialLinks: token.socialLinks || metadata?.social,
    };
  }

  /**
   * Build order by clause
   */
  private buildOrderBy(sort: string, order: string): any {
    const orderDir = (order === 'desc' ? 'desc' : 'asc') as 'desc' | 'asc';

    switch (sort) {
      case 'created':
        return { createdAt: orderDir };
      case 'holders':
        return { holderCount: orderDir };
      case 'volume':
        return { volume24h: orderDir };
      case 'price':
        return { currentPrice: orderDir };
      case 'marketCap':
        return { marketCap: orderDir };
      default:
        return { createdAt: 'desc' };
    }
  }

  /**
   * Get holder count (public method for external use)
   */
  async getHolderCount(tokenAddress: string): Promise<number> {
    // Cache holder count for 5 minutes to reduce DB load
    const cacheKey = `holderCount:${tokenAddress.toLowerCase()}`;

    if (cacheService.isAvailable()) {
      const cached = await cacheService.get<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const count = await db.holder.count({
      where: {
        tokenAddress: tokenAddress.toLowerCase(),
        balance: { not: '0' },
      },
    });

    // Cache for 5 minutes (300 seconds)
    if (cacheService.isAvailable()) {
      await cacheService.set(cacheKey, count, 300);
    }

    return count;
  }

  /**
   * Invalidate token cache
   */
  private async invalidateTokenCache(tokenAddress: string): Promise<void> {
    if (cacheService.isAvailable()) {
      await cacheService.delete(`token:${tokenAddress}`);
      await cacheService.deletePattern(`token:${tokenAddress}:*`);
      await cacheService.deletePattern('tokens:list:*');
    }
  }
}

// Export singleton instance
export const tokenService = new TokenService();
