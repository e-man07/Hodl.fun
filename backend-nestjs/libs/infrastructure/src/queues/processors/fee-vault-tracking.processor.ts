import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from '../config/queue-config';
import { FeeVaultContractService } from '../../contracts/services/fee-vault-contract.service';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { PrismaService } from '@core';

/**
 * FeeVault Tracking Processor
 *
 * Periodically polls the FeeVault contract to track balance changes.
 * Since FeeVault doesn't emit events for deposits, we use polling
 * to create an audit trail of balance changes.
 */
@Processor(QueueName.FEE_VAULT_TRACKING)
export class FeeVaultTrackingProcessor {
  private readonly logger = new Logger(FeeVaultTrackingProcessor.name);

  constructor(
    private readonly feeVaultService: FeeVaultContractService,
    private readonly blockchainService: BlockchainService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QueueName.FEE_VAULT_TRACKING)
    private readonly feeVaultQueue: Queue,
  ) {}

  /**
   * Schedule regular snapshots every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleSnapshot(): Promise<void> {
    await this.feeVaultQueue.add('snapshot', {}, { priority: 1 });
  }

  /**
   * Process snapshot job
   */
  @Process('snapshot')
  async processSnapshot(_job: Job): Promise<void> {
    try {
      this.logger.debug('Taking FeeVault snapshot...');
      await this.takeSnapshot();
      this.logger.debug('FeeVault snapshot completed');
    } catch (error) {
      this.logger.error(`FeeVault snapshot failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Take a snapshot of FeeVault state
   */
  async takeSnapshot(): Promise<void> {
    // Get current vault stats
    const stats = await this.feeVaultService.getVaultStats();
    const currentBlock = await this.blockchainService.getBlockNumber();

    // Get the last snapshot to calculate delta
    const lastSnapshot = await this.prisma.feeVaultSnapshot.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    // Calculate assets delta
    let assetsDelta: string | null = null;
    if (lastSnapshot) {
      const previousAssets = BigInt(lastSnapshot.totalAssets);
      const currentAssets = stats.totalAssets;
      const delta = currentAssets - previousAssets;
      assetsDelta = delta.toString();

      // Only emit event if there's a significant change (> 0)
      if (delta !== 0n) {
        this.eventEmitter.emit('fee-vault.balance.changed', {
          previousBalance: lastSnapshot.totalAssets,
          currentBalance: stats.totalAssets.toString(),
          delta: assetsDelta,
          blockNumber: currentBlock,
          timestamp: new Date(),
        });

        this.logger.log(
          `FeeVault balance changed: ${delta > 0n ? '+' : ''}${assetsDelta} (Total: ${stats.totalAssets})`,
        );
      }
    }

    // Store the snapshot
    await this.prisma.feeVaultSnapshot.create({
      data: {
        totalAssets: stats.totalAssets.toString(),
        totalSupply: stats.totalSupply.toString(),
        pricePerShare: stats.pricePerShare.toString(),
        blockNumber: BigInt(currentBlock),
        assetsDelta,
      },
    });
  }

  /**
   * Get FeeVault balance history
   * @param limit Number of snapshots to return
   * @returns Array of snapshots
   */
  async getBalanceHistory(limit: number = 100): Promise<{
    snapshots: Array<{
      totalAssets: string;
      totalSupply: string;
      pricePerShare: string;
      blockNumber: string;
      timestamp: Date;
      assetsDelta: string | null;
    }>;
    currentBalance: string;
    totalFeesCollected: string;
  }> {
    const snapshots = await this.prisma.feeVaultSnapshot.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Get current balance from contract
    const currentStats = await this.feeVaultService.getVaultStats();

    // Calculate total fees collected (sum of positive deltas)
    const allSnapshots = await this.prisma.feeVaultSnapshot.findMany({
      where: {
        assetsDelta: { not: null },
      },
    });

    let totalFeesCollected = BigInt(0);
    for (const snapshot of allSnapshots) {
      if (snapshot.assetsDelta) {
        const delta = BigInt(snapshot.assetsDelta);
        if (delta > 0n) {
          totalFeesCollected += delta;
        }
      }
    }

    return {
      snapshots: snapshots.map((s: {
        totalAssets: string;
        totalSupply: string;
        pricePerShare: string;
        blockNumber: bigint;
        timestamp: Date;
        assetsDelta: string | null;
      }) => ({
        totalAssets: s.totalAssets,
        totalSupply: s.totalSupply,
        pricePerShare: s.pricePerShare,
        blockNumber: s.blockNumber.toString(),
        timestamp: s.timestamp,
        assetsDelta: s.assetsDelta,
      })),
      currentBalance: currentStats.totalAssets.toString(),
      totalFeesCollected: totalFeesCollected.toString(),
    };
  }

  /**
   * Get latest FeeVault stats
   */
  async getLatestStats(): Promise<{
    totalAssets: string;
    totalSupply: string;
    pricePerShare: string;
    asset: string;
    lastSnapshotAt: Date | null;
    recentChange: string | null;
  }> {
    const stats = await this.feeVaultService.getVaultStats();
    const lastSnapshot = await this.prisma.feeVaultSnapshot.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    return {
      totalAssets: stats.totalAssets.toString(),
      totalSupply: stats.totalSupply.toString(),
      pricePerShare: stats.pricePerShare.toString(),
      asset: stats.asset,
      lastSnapshotAt: lastSnapshot?.timestamp || null,
      recentChange: lastSnapshot?.assetsDelta || null,
    };
  }
}
