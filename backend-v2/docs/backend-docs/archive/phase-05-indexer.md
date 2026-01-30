# Phase 5: Blockchain Indexer

## Objective
Implement the blockchain indexer service to process smart contract events and synchronize data to PostgreSQL.

## Prerequisites
- Phase 4 completed (Core Backend, Database schema)

## Duration: 3-5 days

---

## 5.1 Indexer Service Setup

### Main Entry Point

```typescript
// apps/indexer/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IndexerModule } from './indexer.module';

async function bootstrap() {
  const app = await NestFactory.create(IndexerModule);
  const logger = new Logger('Indexer');

  const port = process.env.INDEXER_PORT || 3002;
  await app.listen(port);
  logger.log(`Indexer service running on port ${port}`);
}
bootstrap();
```

```typescript
// apps/indexer/src/indexer.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@libs/database';
import { RedisModule } from '@libs/redis';
import { HealthModule } from './health/health.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { EventProcessorModule } from './event-processor/event-processor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    HealthModule,
    BlockchainModule,
    EventProcessorModule,
  ],
})
export class IndexerModule {}
```

---

## 5.2 RPC Provider Service

```typescript
// apps/indexer/src/blockchain/rpc.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class RpcService implements OnModuleInit {
  private readonly logger = new Logger(RpcService.name);
  private provider: ethers.JsonRpcProvider;
  private fallbackProvider: ethers.JsonRpcProvider;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get('RPC_URL');
    const fallbackUrl = this.configService.get('RPC_URL_FALLBACK', rpcUrl);

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.fallbackProvider = new ethers.JsonRpcProvider(fallbackUrl);

    this.logger.log('RPC providers initialized');
  }

  async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      this.logger.warn('Primary RPC failed, using fallback');
      return await this.fallbackProvider.getBlockNumber();
    }
  }

  async getBlock(blockNumber: number): Promise<ethers.Block | null> {
    return this.withRetry(() => this.provider.getBlock(blockNumber));
  }

  async getLogs(filter: ethers.Filter): Promise<ethers.Log[]> {
    return this.withRetry(() => this.provider.getLogs(filter));
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let lastError: Error;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## 5.3 Contract ABI Definitions

```typescript
// apps/indexer/src/blockchain/abis/index.ts

export const CORE_ABI = [
  'event CreateCurve(address indexed creator, address indexed curve, address indexed token, string tokenURI, string name, string symbol)',
  'event Buy(address indexed token, address indexed to, uint256 amountIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sell(address indexed token, address indexed from, address indexed to, uint256 amountIn, uint256 amountOut, uint256 price, uint256 timestamp)',
];

export const BONDING_CURVE_ABI = [
  'event Buy(address indexed to, address indexed token, uint256 amountNativeIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sell(address indexed to, address indexed token, uint256 amountTokenIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sync(address indexed token, uint256 realNative, uint256 realToken, uint256 virtualNative, uint256 virtualToken, uint256 price, uint256 timestamp)',
  'event Lock(address indexed token)',
  'event Listing(address indexed curve, address indexed token, address indexed pool, uint256 amount0, uint256 amount1, uint128 liquidity)',
  'event NewATHPrice(address indexed token, uint256 newPrice, uint256 timestamp)',
  'event NewATHMarketCap(address indexed token, uint256 newMarketCap, uint256 timestamp)',
];

export const FACTORY_ABI = [
  'event Create(address indexed creator, address indexed curve, address indexed token, string tokenURI, string name, string symbol, uint256 virtualNative, uint256 virtualToken)',
  'event CreatorFeesAccumulated(address indexed creator, uint256 amount, uint256 totalAccumulated)',
  'event CreatorFeesClaimed(address indexed creator, uint256 amount)',
];
```

---

## 5.4 Event Processor Service

```typescript
// apps/indexer/src/event-processor/event-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '@libs/database';
import { PubSubService, CacheService } from '@libs/redis';
import { RpcService } from '../blockchain/rpc.service';
import { CORE_ABI, BONDING_CURVE_ABI, FACTORY_ABI } from '../blockchain/abis';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);
  private isProcessing = false;
  private coreInterface: ethers.Interface;
  private factoryInterface: ethers.Interface;
  private curveInterface: ethers.Interface;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private rpc: RpcService,
    private pubsub: PubSubService,
    private cache: CacheService,
  ) {
    this.coreInterface = new ethers.Interface(CORE_ABI);
    this.factoryInterface = new ethers.Interface(FACTORY_ABI);
    this.curveInterface = new ethers.Interface(BONDING_CURVE_ABI);
  }

  @Interval(5000) // Poll every 5 seconds
  async processNewBlocks() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const currentBlock = await this.rpc.getBlockNumber();
      const state = await this.getIndexerState();
      const fromBlock = state.lastProcessedBlock + 1n;

      if (fromBlock > BigInt(currentBlock)) {
        return;
      }

      const batchSize = parseInt(this.configService.get('INDEXER_BATCH_SIZE', '100'));
      const toBlock = Math.min(Number(fromBlock) + batchSize - 1, currentBlock);

      this.logger.debug(`Processing blocks ${fromBlock} to ${toBlock}`);

      await this.processBlockRange(Number(fromBlock), toBlock);
      await this.updateIndexerState(BigInt(toBlock));

    } catch (error) {
      this.logger.error(`Error processing blocks: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBlockRange(fromBlock: number, toBlock: number) {
    const coreAddress = this.configService.get('CORE_ADDRESS');
    const factoryAddress = this.configService.get('FACTORY_ADDRESS');

    // Fetch logs from Core and Factory
    const [coreLogs, factoryLogs] = await Promise.all([
      this.rpc.getLogs({
        address: coreAddress,
        fromBlock,
        toBlock,
      }),
      this.rpc.getLogs({
        address: factoryAddress,
        fromBlock,
        toBlock,
      }),
    ]);

    // Process in chronological order
    const allLogs = [...coreLogs, ...factoryLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.index - b.index;
    });

    for (const log of allLogs) {
      await this.processLog(log);
    }
  }

  private async processLog(log: ethers.Log) {
    const coreAddress = this.configService.get('CORE_ADDRESS').toLowerCase();
    const factoryAddress = this.configService.get('FACTORY_ADDRESS').toLowerCase();

    try {
      if (log.address.toLowerCase() === coreAddress) {
        await this.processCoreEvent(log);
      } else if (log.address.toLowerCase() === factoryAddress) {
        await this.processFactoryEvent(log);
      }
    } catch (error) {
      this.logger.error(`Error processing log: ${error.message}`, {
        txHash: log.transactionHash,
        logIndex: log.index,
      });
    }
  }

  private async processCoreEvent(log: ethers.Log) {
    const parsed = this.coreInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (!parsed) return;

    switch (parsed.name) {
      case 'CreateCurve':
        await this.handleCreateCurve(parsed, log);
        break;
      case 'Buy':
        await this.handleBuy(parsed, log);
        break;
      case 'Sell':
        await this.handleSell(parsed, log);
        break;
    }
  }

  private async processFactoryEvent(log: ethers.Log) {
    const parsed = this.factoryInterface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });

    if (!parsed) return;

    switch (parsed.name) {
      case 'Create':
        await this.handleFactoryCreate(parsed, log);
        break;
      case 'CreatorFeesAccumulated':
        await this.handleCreatorFeesAccumulated(parsed, log);
        break;
    }
  }

  private async handleCreateCurve(parsed: ethers.LogDescription, log: ethers.Log) {
    const { creator, curve, token, tokenURI, name, symbol } = parsed.args;

    await this.prisma.token.upsert({
      where: { address: token.toLowerCase() },
      update: {},
      create: {
        address: token.toLowerCase(),
        curveAddress: curve.toLowerCase(),
        creatorAddress: creator.toLowerCase(),
        name,
        symbol,
        tokenUri: tokenURI,
        virtualNative: '1000000000000000000', // 1 PUSH
        virtualToken: '50000000000000000000000000', // 50M tokens
        k: '50000000000000000000000000000000000000000000',
        currentPrice: '20000000000', // Initial price
        marketCap: '20000000000000000000000000000', // ~20M PUSH
        status: 'TRADING',
        createdBlock: BigInt(log.blockNumber),
      },
    });

    // Publish event
    await this.pubsub.publish('token_created', {
      type: 'token_created',
      token: { address: token.toLowerCase(), name, symbol, creator: creator.toLowerCase() },
    });

    // Invalidate cache
    await this.cache.invalidatePattern('tokens:*');
  }

  private async handleBuy(parsed: ethers.LogDescription, log: ethers.Log) {
    const { token, to, amountIn, amountOut, price, timestamp } = parsed.args;
    const tokenAddress = token.toLowerCase();
    const traderAddress = to.toLowerCase();

    // Insert trade
    await this.prisma.trade.create({
      data: {
        tokenAddress,
        type: 'BUY',
        traderAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        feeAmount: (amountIn / 100n).toString(), // 1% fee
        txHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber),
        timestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update or create holder
    await this.prisma.holder.upsert({
      where: {
        tokenAddress_holderAddress: { tokenAddress, holderAddress: traderAddress },
      },
      update: {
        balance: { increment: amountOut.toString() },
        lastActivityTimestamp: new Date(Number(timestamp) * 1000),
      },
      create: {
        tokenAddress,
        holderAddress: traderAddress,
        balance: amountOut.toString(),
        firstBuyTimestamp: new Date(Number(timestamp) * 1000),
        lastActivityTimestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update token price
    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: { currentPrice: price.toString() },
    });

    // Publish trade event
    await this.pubsub.publish('trade', {
      type: 'trade',
      tokenAddress,
      trade: {
        type: 'BUY',
        trader: traderAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidate(`price:${tokenAddress}`);
  }

  private async handleSell(parsed: ethers.LogDescription, log: ethers.Log) {
    const { token, from, to, amountIn, amountOut, price, timestamp } = parsed.args;
    const tokenAddress = token.toLowerCase();
    const sellerAddress = from.toLowerCase();

    // Insert trade
    await this.prisma.trade.create({
      data: {
        tokenAddress,
        type: 'SELL',
        traderAddress: sellerAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        feeAmount: (amountOut / 100n).toString(),
        txHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber),
        timestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update holder balance
    await this.prisma.holder.update({
      where: {
        tokenAddress_holderAddress: { tokenAddress, holderAddress: sellerAddress },
      },
      data: {
        balance: { decrement: amountIn.toString() },
        lastActivityTimestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update token price
    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: { currentPrice: price.toString() },
    });

    // Publish trade event
    await this.pubsub.publish('trade', {
      type: 'trade',
      tokenAddress,
      trade: {
        type: 'SELL',
        trader: sellerAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidate(`price:${tokenAddress}`);
  }

  private async handleFactoryCreate(parsed: ethers.LogDescription, log: ethers.Log) {
    const { virtualNative, virtualToken } = parsed.args;
    const k = (BigInt(virtualNative) * BigInt(virtualToken)).toString();

    // Update token with factory data
    const token = parsed.args.token.toLowerCase();
    await this.prisma.token.update({
      where: { address: token },
      data: {
        virtualNative: virtualNative.toString(),
        virtualToken: virtualToken.toString(),
        k,
      },
    });
  }

  private async handleCreatorFeesAccumulated(parsed: ethers.LogDescription, log: ethers.Log) {
    const { creator, amount, totalAccumulated } = parsed.args;

    await this.prisma.creatorFee.upsert({
      where: { creatorAddress: creator.toLowerCase() },
      update: {
        accumulatedFees: totalAccumulated.toString(),
        lastAccumulationTimestamp: new Date(),
      },
      create: {
        creatorAddress: creator.toLowerCase(),
        accumulatedFees: totalAccumulated.toString(),
        lastAccumulationTimestamp: new Date(),
      },
    });
  }

  private async getIndexerState() {
    let state = await this.prisma.indexerState.findUnique({
      where: { id: 'main' },
    });

    if (!state) {
      const startBlock = parseInt(this.configService.get('INDEXER_START_BLOCK', '0'));
      state = await this.prisma.indexerState.create({
        data: {
          id: 'main',
          lastProcessedBlock: BigInt(startBlock),
        },
      });
    }

    return state;
  }

  private async updateIndexerState(blockNumber: bigint) {
    await this.prisma.indexerState.update({
      where: { id: 'main' },
      data: { lastProcessedBlock: blockNumber },
    });
  }
}
```

---

## 5.5 Verification Checklist

- [ ] Indexer service starts without errors
- [ ] RPC connection working
- [ ] Events being fetched from blockchain
- [ ] CreateCurve events creating Token records
- [ ] Buy/Sell events creating Trade records
- [ ] Holder balances updating correctly
- [ ] Cache invalidation working
- [ ] Pub/Sub events being published
- [ ] Indexer state persisting across restarts

## Testing Commands

```bash
# Start indexer
pnpm --filter indexer run start:dev

# Check indexer state
psql -c "SELECT * FROM indexer_state;"

# Check tokens
psql -c "SELECT address, name, symbol, status FROM tokens ORDER BY created_at DESC LIMIT 10;"

# Check trades
psql -c "SELECT token_address, type, trader_address, amount_in FROM trades ORDER BY timestamp DESC LIMIT 10;"
```

## Next Phase
Proceed to **Phase 6: Real-time** to implement WebSocket service.
