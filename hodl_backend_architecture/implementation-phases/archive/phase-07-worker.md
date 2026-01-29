# Phase 7: Background Processing

## Objective
Implement the Worker service with BullMQ for background job processing (candle aggregation, metrics calculation, cleanup).

## Prerequisites
- Phase 4 completed (Core Backend)
- Phase 5 completed (Indexer)

## Duration: 2-3 days

---

## 7.1 Worker Service Setup

### Main Entry Point

```typescript
// apps/worker/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule);
  const logger = new Logger('Worker');

  const port = process.env.WORKER_PORT || 3003;
  await app.listen(port);
  logger.log(`Worker service running on port ${port}`);
}
bootstrap();
```

```typescript
// apps/worker/src/worker.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@libs/database';
import { RedisModule } from '@libs/redis';
import { HealthModule } from './health/health.module';
import { CandleModule } from './candle/candle.module';
import { MetricsModule } from './metrics/metrics.module';
import { CleanupModule } from './cleanup/cleanup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: configService.get('REDIS_URL'),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    CandleModule,
    MetricsModule,
    CleanupModule,
  ],
})
export class WorkerModule {}
```

---

## 7.2 Candle Aggregation

### Candle Module

```typescript
// apps/worker/src/candle/candle.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CandleProcessor } from './candle.processor';
import { CandleScheduler } from './candle.scheduler';
import { CandleService } from './candle.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'candle-aggregation' }),
  ],
  providers: [CandleProcessor, CandleScheduler, CandleService],
})
export class CandleModule {}
```

### Candle Service

```typescript
// apps/worker/src/candle/candle.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, PriceInterval } from '@libs/database';
import { CacheService } from '@libs/redis';

@Injectable()
export class CandleService {
  private readonly logger = new Logger(CandleService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
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
    const prices = trades.map(t => BigInt(t.price));
    const open = prices[0].toString();
    const close = prices[prices.length - 1].toString();
    const high = prices.reduce((a, b) => a > b ? a : b).toString();
    const low = prices.reduce((a, b) => a < b ? a : b).toString();

    const volumeNative = trades
      .filter(t => t.type === 'BUY')
      .reduce((sum, t) => sum + BigInt(t.amountIn), 0n)
      .toString();

    const volumeToken = trades
      .reduce((sum, t) => {
        return t.type === 'BUY'
          ? sum + BigInt(t.amountOut)
          : sum + BigInt(t.amountIn);
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

  async aggregateAllTokens(interval: PriceInterval, startTime: Date, endTime: Date): Promise<void> {
    // Get all active tokens
    const tokens = await this.prisma.token.findMany({
      where: { status: 'TRADING' },
      select: { address: true },
    });

    for (const token of tokens) {
      try {
        await this.aggregateCandles(token.address, interval, startTime, endTime);
      } catch (error) {
        this.logger.error(`Failed to aggregate candles for ${token.address}: ${error.message}`);
      }
    }
  }
}
```

### Candle Processor

```typescript
// apps/worker/src/candle/candle.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CandleService } from './candle.service';
import { PriceInterval } from '@libs/database';

@Processor('candle-aggregation')
export class CandleProcessor {
  private readonly logger = new Logger(CandleProcessor.name);

  constructor(private candleService: CandleService) {}

  @Process('aggregate-interval')
  async handleAggregateInterval(job: Job<{
    interval: PriceInterval;
    startTime: string;
    endTime: string;
  }>) {
    const { interval, startTime, endTime } = job.data;

    this.logger.log(`Processing ${interval} candle aggregation`);

    await this.candleService.aggregateAllTokens(
      interval,
      new Date(startTime),
      new Date(endTime),
    );

    this.logger.log(`Completed ${interval} candle aggregation`);
  }

  @Process('aggregate-token')
  async handleAggregateToken(job: Job<{
    tokenAddress: string;
    interval: PriceInterval;
    startTime: string;
    endTime: string;
  }>) {
    const { tokenAddress, interval, startTime, endTime } = job.data;

    await this.candleService.aggregateCandles(
      tokenAddress,
      interval,
      new Date(startTime),
      new Date(endTime),
    );
  }
}
```

### Candle Scheduler

```typescript
// apps/worker/src/candle/candle.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PriceInterval } from '@libs/database';

@Injectable()
export class CandleScheduler {
  private readonly logger = new Logger(CandleScheduler.name);

  constructor(@InjectQueue('candle-aggregation') private queue: Queue) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleOneMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60000);
    startTime.setSeconds(0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.ONE_MINUTE,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron('*/5 * * * *') // Every 5 minutes
  async scheduleFiveMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 5 * 60000);
    startTime.setMinutes(Math.floor(startTime.getMinutes() / 5) * 5, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.FIVE_MINUTES,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron('*/15 * * * *') // Every 15 minutes
  async scheduleFifteenMinuteCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 15 * 60000);
    startTime.setMinutes(Math.floor(startTime.getMinutes() / 15) * 15, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.FIFTEEN_MINUTES,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleOneHourCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60 * 60000);
    startTime.setMinutes(0, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.ONE_HOUR,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron('0 */4 * * *') // Every 4 hours
  async scheduleFourHourCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 4 * 60 * 60000);
    startTime.setHours(Math.floor(startTime.getHours() / 4) * 4, 0, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.FOUR_HOURS,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleOneDayCandles() {
    const now = new Date();
    const startTime = new Date(now.getTime() - 24 * 60 * 60000);
    startTime.setHours(0, 0, 0, 0);

    await this.queue.add('aggregate-interval', {
      interval: PriceInterval.ONE_DAY,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
    });
  }
}
```

---

## 7.3 Metrics Module

```typescript
// apps/worker/src/metrics/metrics.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@libs/database';
import { CacheService, PubSubService } from '@libs/redis';

@Processor('metrics')
export class MetricsProcessor {
  private readonly logger = new Logger(MetricsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private pubsub: PubSubService,
  ) {}

  @Process('calculate-leaderboard')
  async handleCalculateLeaderboard(job: Job<{ type: string }>) {
    const { type } = job.data;

    let tokens;
    switch (type) {
      case 'gainers':
        tokens = await this.calculateGainers();
        break;
      case 'volume':
        tokens = await this.calculateVolumeLeaders();
        break;
      case 'new':
        tokens = await this.calculateNewTokens();
        break;
    }

    await this.cache.set(`leaderboard:${type}`, JSON.stringify(tokens), 'EX', 30);
    this.logger.log(`Updated ${type} leaderboard: ${tokens.length} tokens`);
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
          WHEN price_24h_ago IS NOT NULL AND price_24h_ago > 0
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

    const holdings = await this.prisma.holder.findMany({
      where: { holderAddress: walletAddress.toLowerCase() },
    });

    const trades = await this.prisma.trade.findMany({
      where: { traderAddress: walletAddress.toLowerCase() },
    });

    const totalInvested = trades
      .filter(t => t.type === 'BUY')
      .reduce((sum, t) => sum + BigInt(t.amountIn), 0n);

    const totalReturned = trades
      .filter(t => t.type === 'SELL')
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
```

---

## 7.4 Cleanup Module

```typescript
// apps/worker/src/cleanup/cleanup.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '@libs/database';
import { RedisService } from '@libs/redis';

@Processor('cleanup')
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Process('cleanup-old-candles')
  async handleCleanupOldCandles(job: Job) {
    // Keep 1-minute candles for 7 days
    const oneMinuteThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const deleted = await this.prisma.priceHistory.deleteMany({
      where: {
        interval: 'ONE_MINUTE',
        timestamp: { lt: oneMinuteThreshold },
      },
    });

    this.logger.log(`Cleaned up ${deleted.count} old 1-minute candles`);
  }

  @Process('cleanup-zero-balance-holders')
  async handleCleanupZeroBalanceHolders(job: Job) {
    const deleted = await this.prisma.holder.deleteMany({
      where: { balance: '0' },
    });

    this.logger.log(`Cleaned up ${deleted.count} zero-balance holders`);
  }

  @Process('cache-warmup')
  async handleCacheWarmup(job: Job) {
    // Warm up leaderboard caches
    const types = ['gainers', 'volume', 'new'];
    for (const type of types) {
      // This triggers the leaderboard calculation
      await this.redis.del(`leaderboard:${type}`);
    }

    this.logger.log('Cache warmup completed');
  }
}
```

---

## 7.5 Dead Letter Queue Handling

```typescript
// apps/worker/src/dead-letter/dead-letter.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('dead-letter')
export class DeadLetterProcessor {
  private readonly logger = new Logger(DeadLetterProcessor.name);

  @Process()
  async handleDeadLetter(job: Job) {
    this.logger.error('Job in dead letter queue', {
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
    });

    // Optionally: Send alert to monitoring system
  }
}
```

---

## 7.6 Verification Checklist

- [ ] Worker service starts without errors
- [ ] BullMQ queues created
- [ ] Candle aggregation running on schedule
- [ ] Leaderboards calculating correctly
- [ ] User portfolio updates working
- [ ] Cleanup jobs removing old data
- [ ] Failed jobs moving to dead letter queue
- [ ] Redis queue persistence working

## Testing Commands

```bash
# Start worker
pnpm --filter worker run start:dev

# Check queue status (using Bull Board or redis-cli)
redis-cli LLEN bull:candle-aggregation:waiting
redis-cli LLEN bull:candle-aggregation:completed
redis-cli LLEN bull:candle-aggregation:failed

# Verify candles
psql -c "SELECT token_address, interval, COUNT(*) FROM price_history GROUP BY 1, 2;"
```

## Next Phase
Proceed to **Phase 8: Networking** to configure Load Balancer and Cloudflare.
