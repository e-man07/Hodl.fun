import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';

@Processor('metrics')
export class MetricsProcessor {
  private readonly logger = new Logger(MetricsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Process('calculate-leaderboard')
  async handleCalculateLeaderboard(job: Job<{ type: string }>) {
    const { type } = job.data;

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

  private async calculateGainers() {
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

  private async calculateVolumeLeaders() {
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

  private async calculateNewTokens() {
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

  @Process('update-user-portfolio')
  async handleUpdateUserPortfolio(job: Job<{ walletAddress: string }>) {
    const { walletAddress } = job.data;

    const trades = await this.prisma.trade.findMany({
      where: { traderAddress: walletAddress.toLowerCase() },
    });

    const totalInvested = trades
      .filter((t) => t.type === 'BUY')
      .reduce((sum, t) => sum + BigInt(t.amountIn), 0n);

    const totalReturned = trades
      .filter((t) => t.type === 'SELL')
      .reduce((sum, t) => sum + BigInt(t.amountOut), 0n);

    await this.prisma.userPortfolio.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: {
        totalInvested: totalInvested.toString(),
        totalReturned: totalReturned.toString(),
        totalTrades: trades.length,
      },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        totalInvested: totalInvested.toString(),
        totalReturned: totalReturned.toString(),
        totalTrades: trades.length,
      },
    });
  }
}
