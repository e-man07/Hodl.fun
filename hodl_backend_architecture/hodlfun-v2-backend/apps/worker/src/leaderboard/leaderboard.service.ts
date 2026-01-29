import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { CacheService, PubSubService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';

export interface LeaderboardToken {
  id: string;
  address: string;
  name: string;
  symbol: string;
  currentPrice: string;
  marketCap: string;
  createdAt: Date;
  status: string;
  priceChange24h?: number;
  volume24h?: string;
}

export type LeaderboardType = 'gainers' | 'losers' | 'volume' | 'new' | 'graduated';

const LEADERBOARD_CACHE_TTL = 30; // 30 seconds
const DEFAULT_LIMIT = 50;

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly pubsub: PubSubService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Compute top gainers by 24h price change
   */
  async computeGainers(limit: number = DEFAULT_LIMIT): Promise<LeaderboardToken[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get all trading tokens
    const tokens = await this.prisma.token.findMany({
      where: { status: 'TRADING' },
      take: 500, // Get more tokens to filter
    });

    // Get 24h ago prices from price history (daily candles)
    const priceHistory = await this.prisma.priceHistory.findMany({
      where: {
        tokenAddress: { in: tokens.map((t) => t.address) },
        interval: 'ONE_DAY',
        timestamp: { gte: oneDayAgo },
      },
      orderBy: { timestamp: 'asc' },
      distinct: ['tokenAddress'],
    });

    // Create a map of token address to 24h ago price
    const priceMap = new Map<string, string>();
    for (const ph of priceHistory) {
      priceMap.set(ph.tokenAddress, ph.close);
    }

    // Calculate price change for each token
    const tokensWithChange: LeaderboardToken[] = tokens.map((token) => {
      const oldPrice = priceMap.get(token.address);
      let priceChange24h = 0;

      if (oldPrice && BigInt(oldPrice) > 0n) {
        const currentPrice = BigInt(token.currentPrice);
        const previousPrice = BigInt(oldPrice);
        // Calculate percentage change: ((current - previous) / previous) * 100
        priceChange24h = Number(((currentPrice - previousPrice) * 10000n) / previousPrice) / 100;
      }

      return {
        id: token.id,
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        currentPrice: token.currentPrice,
        marketCap: token.marketCap,
        createdAt: token.createdAt,
        status: token.status,
        priceChange24h,
      };
    });

    // Sort by price change descending and take top N
    return tokensWithChange
      .sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0))
      .slice(0, limit);
  }

  /**
   * Compute top losers by 24h price change
   */
  async computeLosers(limit: number = DEFAULT_LIMIT): Promise<LeaderboardToken[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get all trading tokens
    const tokens = await this.prisma.token.findMany({
      where: { status: 'TRADING' },
      take: 500,
    });

    // Get 24h ago prices
    const priceHistory = await this.prisma.priceHistory.findMany({
      where: {
        tokenAddress: { in: tokens.map((t) => t.address) },
        interval: 'ONE_DAY',
        timestamp: { gte: oneDayAgo },
      },
      orderBy: { timestamp: 'asc' },
      distinct: ['tokenAddress'],
    });

    const priceMap = new Map<string, string>();
    for (const ph of priceHistory) {
      priceMap.set(ph.tokenAddress, ph.close);
    }

    const tokensWithChange: LeaderboardToken[] = tokens.map((token) => {
      const oldPrice = priceMap.get(token.address);
      let priceChange24h = 0;

      if (oldPrice && BigInt(oldPrice) > 0n) {
        const currentPrice = BigInt(token.currentPrice);
        const previousPrice = BigInt(oldPrice);
        priceChange24h = Number(((currentPrice - previousPrice) * 10000n) / previousPrice) / 100;
      }

      return {
        id: token.id,
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        currentPrice: token.currentPrice,
        marketCap: token.marketCap,
        createdAt: token.createdAt,
        status: token.status,
        priceChange24h,
      };
    });

    // Sort by price change ascending (biggest losers first) and take top N
    return tokensWithChange
      .sort((a, b) => (a.priceChange24h || 0) - (b.priceChange24h || 0))
      .slice(0, limit);
  }

  /**
   * Compute top tokens by 24h trading volume
   */
  async computeVolumeLeaders(limit: number = DEFAULT_LIMIT): Promise<LeaderboardToken[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get recent trades grouped by token
    const trades = await this.prisma.trade.findMany({
      where: {
        timestamp: { gte: oneDayAgo },
      },
      select: {
        tokenAddress: true,
        amountIn: true,
      },
    });

    // Calculate volume per token manually (amountIn is stored as string for BigInt)
    const volumeMap = new Map<string, bigint>();
    for (const trade of trades) {
      const current = volumeMap.get(trade.tokenAddress) || 0n;
      volumeMap.set(trade.tokenAddress, current + BigInt(trade.amountIn));
    }

    if (volumeMap.size === 0) {
      return [];
    }

    // Sort by volume and take top N
    const sortedTokens = Array.from(volumeMap.entries())
      .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
      .slice(0, limit);

    // Get token details
    const tokenAddresses = sortedTokens.map(([addr]) => addr);
    const tokens = await this.prisma.token.findMany({
      where: { address: { in: tokenAddresses } },
    });

    // Create a map for quick lookup
    const tokenMap = new Map(tokens.map((t) => [t.address, t]));

    // Combine volume with token data, preserving volume order
    const result: LeaderboardToken[] = [];
    for (const [tokenAddress, volume] of sortedTokens) {
      const token = tokenMap.get(tokenAddress);
      if (token) {
        result.push({
          id: token.id,
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          currentPrice: token.currentPrice,
          marketCap: token.marketCap,
          createdAt: token.createdAt,
          status: token.status,
          volume24h: volume.toString(),
        });
      }
    }

    return result;
  }

  /**
   * Compute newest tokens
   */
  async computeNewest(limit: number = DEFAULT_LIMIT): Promise<LeaderboardToken[]> {
    const tokens = await this.prisma.token.findMany({
      where: { status: 'TRADING' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return tokens.map((token) => ({
      id: token.id,
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      currentPrice: token.currentPrice,
      marketCap: token.marketCap,
      createdAt: token.createdAt,
      status: token.status,
    }));
  }

  /**
   * Compute recently graduated tokens
   */
  async computeGraduated(limit: number = DEFAULT_LIMIT): Promise<LeaderboardToken[]> {
    const tokens = await this.prisma.token.findMany({
      where: { status: 'LISTED' },
      orderBy: { graduatedAt: 'desc' },
      take: limit,
    });

    return tokens.map((token) => ({
      id: token.id,
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      currentPrice: token.currentPrice,
      marketCap: token.marketCap,
      createdAt: token.createdAt,
      status: token.status,
    }));
  }

  /**
   * Update all leaderboards and cache them
   */
  async updateAllLeaderboards(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log('Starting leaderboard update...');

      // Compute all leaderboards in parallel
      const [gainers, losers, volume, newest, graduated] = await Promise.all([
        this.computeGainers(),
        this.computeLosers(),
        this.computeVolumeLeaders(),
        this.computeNewest(),
        this.computeGraduated(),
      ]);

      // Cache all leaderboards
      await Promise.all([
        this.cache.set('leaderboard:gainers', gainers, LEADERBOARD_CACHE_TTL),
        this.cache.set('leaderboard:losers', losers, LEADERBOARD_CACHE_TTL),
        this.cache.set('leaderboard:volume', volume, LEADERBOARD_CACHE_TTL),
        this.cache.set('leaderboard:new', newest, LEADERBOARD_CACHE_TTL),
        this.cache.set('leaderboard:graduated', graduated, LEADERBOARD_CACHE_TTL),
      ]);

      // Publish update event for WebSocket clients
      await this.pubsub.publish('leaderboard_updated', {
        updated: true,
        timestamp: Date.now(),
      });

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.queueJobsProcessed.inc({ queue: 'leaderboard', status: 'completed' });
      this.metrics.queueJobDuration.observe({ queue: 'leaderboard' }, duration);

      this.logger.log(`Leaderboard update completed in ${duration.toFixed(2)}s`);
    } catch (error) {
      this.metrics.queueJobsProcessed.inc({ queue: 'leaderboard', status: 'failed' });
      this.logger.error(`Leaderboard update failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get a specific leaderboard (with cache fallback)
   */
  async getLeaderboard(type: LeaderboardType): Promise<LeaderboardToken[]> {
    const cacheKey = `leaderboard:${type}`;
    const cached = await this.cache.get<LeaderboardToken[]>(cacheKey);

    if (cached) {
      return cached;
    }

    // Cache miss - compute on demand
    let data: LeaderboardToken[];
    switch (type) {
      case 'gainers':
        data = await this.computeGainers();
        break;
      case 'losers':
        data = await this.computeLosers();
        break;
      case 'volume':
        data = await this.computeVolumeLeaders();
        break;
      case 'new':
        data = await this.computeNewest();
        break;
      case 'graduated':
        data = await this.computeGraduated();
        break;
      default:
        throw new Error(`Unknown leaderboard type: ${type}`);
    }

    // Cache for next time
    await this.cache.set(cacheKey, data, LEADERBOARD_CACHE_TTL);
    return data;
  }
}
