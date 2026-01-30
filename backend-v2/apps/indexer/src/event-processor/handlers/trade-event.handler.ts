import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '@hodlfun/database';
import { PubSubService, CacheService } from '@hodlfun/redis';
import { MetricsService, PUBSUB_CHANNELS } from '@hodlfun/common';
import { BaseEventHandler, EventHandlerContext, EventHandlerDependencies } from './base-event.handler';

/**
 * Handler for trade-related events: Buy and Sell from Core contract
 */
@Injectable()
export class TradeEventHandler extends BaseEventHandler {
  private readonly prisma: PrismaService;
  private readonly pubsub: PubSubService;
  private readonly cache: CacheService;
  private readonly metrics: MetricsService;
  private readonly configService: ConfigService;

  constructor(deps: EventHandlerDependencies) {
    super(deps, TradeEventHandler.name);
    this.prisma = deps.prisma as PrismaService;
    this.pubsub = deps.pubsub as PubSubService;
    this.cache = deps.cache as CacheService;
    this.metrics = deps.metrics as MetricsService;
    this.configService = deps.configService as ConfigService;
  }

  getSupportedEvents(): string[] {
    return ['Buy', 'Sell'];
  }

  async handle(
    parsed: ethers.LogDescription,
    log: ethers.Log,
    _context?: EventHandlerContext,
  ): Promise<void> {
    switch (parsed.name) {
      case 'Buy':
        await this.handleBuy(parsed, log);
        break;
      case 'Sell':
        await this.handleSell(parsed, log);
        break;
    }
  }

  private async handleBuy(parsed: ethers.LogDescription, log: ethers.Log): Promise<void> {
    const { token, to, amountIn, amountOut, price, timestamp } = parsed.args;
    const tokenAddress = token.toLowerCase();
    const traderAddress = to.toLowerCase();

    // Check for duplicate
    const existingTrade = await this.prisma.trade.findUnique({
      where: { txHash: log.transactionHash },
    });

    if (existingTrade) {
      this.logger.debug(`Skipping duplicate trade: ${log.transactionHash}`);
      return;
    }

    // Insert trade
    await this.prisma.trade.create({
      data: {
        tokenAddress,
        type: 'BUY',
        traderAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        feeAmount: (BigInt(amountIn) / 100n).toString(),
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
        balance: {
          set: await this.getUpdatedBalance(tokenAddress, traderAddress, amountOut, true),
        },
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
    await this.pubsub.publish(PUBSUB_CHANNELS.TRADE, {
      type: 'trade',
      tokenAddress,
      trade: {
        type: 'BUY',
        trader: traderAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        txHash: log.transactionHash,
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidate(`price:${tokenAddress}`);

    this.metrics.tradesTotal.inc({ type: 'BUY', status: 'success' });
    this.metrics.tradingVolume.inc({ type: 'BUY' }, Number(amountIn));
    this.metrics.indexerEventsProcessed.inc({ event_type: 'Buy' });

    // Note: Portfolio update is handled by the parent EventProcessorService
  }

  private async handleSell(parsed: ethers.LogDescription, log: ethers.Log): Promise<void> {
    const { token, from, amountIn, amountOut, price, timestamp } = parsed.args;
    const tokenAddress = token.toLowerCase();
    const sellerAddress = from.toLowerCase();

    // Check for duplicate
    const existingTrade = await this.prisma.trade.findUnique({
      where: { txHash: log.transactionHash },
    });

    if (existingTrade) {
      this.logger.debug(`Skipping duplicate trade: ${log.transactionHash}`);
      return;
    }

    // Insert trade
    await this.prisma.trade.create({
      data: {
        tokenAddress,
        type: 'SELL',
        traderAddress: sellerAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        feeAmount: (BigInt(amountOut) / 100n).toString(),
        txHash: log.transactionHash,
        blockNumber: BigInt(log.blockNumber),
        timestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // Update holder balance
    const holder = await this.prisma.holder.findUnique({
      where: {
        tokenAddress_holderAddress: { tokenAddress, holderAddress: sellerAddress },
      },
    });

    if (holder) {
      const newBalance = BigInt(holder.balance) - BigInt(amountIn);

      if (newBalance < 0n) {
        this.logger.error(
          `Invalid balance detected: ${sellerAddress} attempting to sell ${amountIn} but only holds ${holder.balance} of token ${tokenAddress}`,
        );
      }

      await this.prisma.holder.update({
        where: {
          tokenAddress_holderAddress: { tokenAddress, holderAddress: sellerAddress },
        },
        data: {
          balance: (newBalance < 0n ? 0n : newBalance).toString(),
          lastActivityTimestamp: new Date(Number(timestamp) * 1000),
        },
      });
    }

    // Update token price
    await this.prisma.token.update({
      where: { address: tokenAddress },
      data: { currentPrice: price.toString() },
    });

    // Publish trade event
    await this.pubsub.publish(PUBSUB_CHANNELS.TRADE, {
      type: 'trade',
      tokenAddress,
      trade: {
        type: 'SELL',
        trader: sellerAddress,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        price: price.toString(),
        txHash: log.transactionHash,
      },
    });

    // Invalidate caches
    await this.cache.invalidate(`token:${tokenAddress}`);
    await this.cache.invalidate(`price:${tokenAddress}`);

    this.metrics.tradesTotal.inc({ type: 'SELL', status: 'success' });
    this.metrics.tradingVolume.inc({ type: 'SELL' }, Number(amountOut));
    this.metrics.indexerEventsProcessed.inc({ event_type: 'Sell' });
  }

  private async getUpdatedBalance(
    tokenAddress: string,
    holderAddress: string,
    amountChange: bigint,
    isAdd: boolean,
  ): Promise<string> {
    const holder = await this.prisma.holder.findUnique({
      where: {
        tokenAddress_holderAddress: { tokenAddress, holderAddress },
      },
    });

    const currentBalance = holder ? BigInt(holder.balance) : 0n;
    const newBalance = isAdd ? currentBalance + amountChange : currentBalance - amountChange;
    return newBalance.toString();
  }
}
