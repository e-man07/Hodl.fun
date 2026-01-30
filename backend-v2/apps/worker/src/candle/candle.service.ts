import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, PriceInterval } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';

@Injectable()
export class CandleService {
  private readonly logger = new Logger(CandleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async aggregateCandles(
    tokenAddress: string,
    interval: PriceInterval,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    // Get trades in the time window
    const trades = await this.prisma.trade.findMany({
      where: {
        tokenAddress,
        timestamp: { gte: startTime, lt: endTime },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (trades.length === 0) {
      return;
    }

    // Calculate OHLCV
    const prices = trades.map((t: { price: string }) => BigInt(t.price));
    const open = prices[0].toString();
    const close = prices[prices.length - 1].toString();
    const high = prices
      .reduce((a: bigint, b: bigint) => (a > b ? a : b))
      .toString();
    const low = prices
      .reduce((a: bigint, b: bigint) => (a < b ? a : b))
      .toString();

    // volumeNative = BUY amountIn (PUSH spent) + SELL amountOut (PUSH received)
    // This measures total PUSH flow through the bonding curve
    const volumeNative = trades
      .reduce((sum: bigint, t: { type: string; amountIn: string; amountOut: string }) => {
        return t.type === 'BUY' ? sum + BigInt(t.amountIn) : sum + BigInt(t.amountOut);
      }, 0n)
      .toString();

    const volumeToken = trades
      .reduce((sum: bigint, t: { type: string; amountIn: string; amountOut: string }) => {
        return t.type === 'BUY' ? sum + BigInt(t.amountOut) : sum + BigInt(t.amountIn);
      }, 0n)
      .toString();

    // Upsert candle
    await this.prisma.priceHistory.upsert({
      where: {
        tokenAddress_interval_timestamp: {
          tokenAddress,
          interval,
          timestamp: startTime,
        },
      },
      update: { open, high, low, close, volumeNative, volumeToken, tradeCount: trades.length },
      create: {
        tokenAddress,
        interval,
        timestamp: startTime,
        open,
        high,
        low,
        close,
        volumeNative,
        volumeToken,
        tradeCount: trades.length,
      },
    });

    // Invalidate cache
    await this.cache.invalidate(`candles:${tokenAddress}:${interval}`);

    this.logger.debug(`Aggregated ${interval} candle for ${tokenAddress}: ${trades.length} trades`);
  }

  async aggregateAllTokens(
    interval: PriceInterval,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    // Get all active tokens
    const tokens = await this.prisma.token.findMany({
      where: { status: 'TRADING' },
      select: { address: true },
    });

    for (const token of tokens) {
      try {
        await this.aggregateCandles(token.address, interval, startTime, endTime);
      } catch (error) {
        this.logger.error(
          `Failed to aggregate candles for ${token.address}: ${(error as Error).message}`,
        );
      }
    }
  }
}
