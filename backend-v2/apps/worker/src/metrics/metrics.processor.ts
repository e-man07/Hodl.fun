import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { CacheService, PubSubService } from '@hodlfun/redis';

@Injectable()
export class MetricsProcessor implements OnModuleInit {
  private readonly logger = new Logger(MetricsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly pubsub: PubSubService,
  ) {}

  async onModuleInit() {
    // Subscribe to portfolio_update channel from the indexer
    await this.pubsub.subscribe('portfolio_update', (message: unknown) => {
      const msg = message as { type?: string; walletAddress?: string };
      if (msg.type === 'portfolio_update' && msg.walletAddress) {
        this.logger.debug(`Received portfolio update for ${msg.walletAddress}`);
        // Process async without blocking the subscriber
        this.updateUserPortfolio(msg.walletAddress).catch((err) => {
          this.logger.error(`Failed to update portfolio: ${(err as Error).message}`);
        });
      }
    });
    this.logger.log('Subscribed to portfolio_update channel');
  }

  /**
   * Calculate and cache leaderboard data by type.
   * Called directly by the scheduler every 30 seconds.
   */
  async calculateLeaderboard(type: string) {

    let result: unknown[];
    switch (type) {
      case 'gainers':
        result = await this.calculateGainers();
        break;
      case 'volume':
        result = await this.calculateVolumeLeaders();
        break;
      case 'new':
        result = await this.calculateNewTokens();
        break;
      default:
        result = [];
    }

    await this.cache.set(`leaderboard:${type}`, result, 30);
    this.logger.log(`Updated ${type} leaderboard: ${result.length} tokens`);
  }

  private async calculateGainers(): Promise<unknown[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.prisma.$queryRaw`
      WITH price_changes AS (
        SELECT
          t.address,
          t.name,
          t.symbol,
          t.current_price,
          t.market_cap,
          (SELECT price FROM trades WHERE token_address = t.address AND timestamp >= ${oneDayAgo} ORDER BY timestamp ASC LIMIT 1) as price_24h_ago
        FROM tokens t
        WHERE t.status = 'TRADING'
      )
      SELECT
        address,
        name,
        symbol,
        current_price,
        market_cap,
        CASE
          WHEN price_24h_ago IS NOT NULL AND price_24h_ago::numeric > 0
          THEN ((current_price::numeric - price_24h_ago::numeric) / price_24h_ago::numeric * 100)
          ELSE 0
        END as price_change_24h
      FROM price_changes
      ORDER BY price_change_24h DESC
      LIMIT 20
    `;
  }

  private async calculateVolumeLeaders(): Promise<unknown[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.prisma.$queryRaw`
      SELECT
        t.address,
        t.name,
        t.symbol,
        t.current_price,
        t.market_cap,
        COALESCE(SUM(tr.amount_in::numeric), 0) as volume_24h
      FROM tokens t
      LEFT JOIN trades tr ON tr.token_address = t.address AND tr.timestamp >= ${oneDayAgo}
      WHERE t.status = 'TRADING'
      GROUP BY t.address, t.name, t.symbol, t.current_price, t.market_cap
      ORDER BY volume_24h DESC
      LIMIT 20
    `;
  }

  private async calculateNewTokens(): Promise<unknown[]> {
    return this.prisma.token.findMany({
      where: { status: 'TRADING' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        address: true,
        name: true,
        symbol: true,
        currentPrice: true,
        marketCap: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update a user's portfolio with their total invested, returned, and trade count.
   * Called via PubSub when indexer processes trades.
   */
  async updateUserPortfolio(walletAddress: string) {
    const normalizedAddress = walletAddress.toLowerCase();

    const trades = await this.prisma.trade.findMany({
      where: { traderAddress: normalizedAddress },
    });

    const totalInvested = trades
      .filter((t: { type: string }) => t.type === 'BUY')
      .reduce((sum: bigint, t: { amountIn: string }) => sum + BigInt(t.amountIn), 0n);

    const totalReturned = trades
      .filter((t: { type: string }) => t.type === 'SELL')
      .reduce((sum: bigint, t: { amountOut: string }) => sum + BigInt(t.amountOut), 0n);

    await this.prisma.userPortfolio.upsert({
      where: { walletAddress: normalizedAddress },
      update: {
        totalInvested: totalInvested.toString(),
        totalReturned: totalReturned.toString(),
        totalTrades: trades.length,
      },
      create: {
        walletAddress: normalizedAddress,
        totalInvested: totalInvested.toString(),
        totalReturned: totalReturned.toString(),
        totalTrades: trades.length,
      },
    });

    this.logger.debug(`Updated portfolio for ${normalizedAddress}: invested=${totalInvested}, returned=${totalReturned}, trades=${trades.length}`);
  }
}
