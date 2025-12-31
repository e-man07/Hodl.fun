import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueueName } from '../config/queue-config';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { BondingCurveContractService } from '../../contracts/services/bonding-curve-contract.service';
import { FactoryContractService } from '../../contracts/services/factory-contract.service';
import { TransactionBuilderService } from '../../contracts/services/transaction-builder.service';
import { PrismaService } from '@core';

/**
 * Token Graduation Processor
 *
 * Handles token graduation from bonding curve to Uniswap V3
 * Triggered when market cap reaches graduation threshold
 * Monitors curve state and emits events for frontend notification
 */
@Processor(QueueName.TOKEN_GRADUATION)
export class TokenGraduationProcessor {
  private readonly logger = new Logger(TokenGraduationProcessor.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly bondingCurveService: BondingCurveContractService,
    private readonly factoryService: FactoryContractService,
    private readonly transactionBuilder: TransactionBuilderService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process token graduation job
   */
  @Process()
  async process(
    job: Job<{
      tokenId: string;
      tokenAddress: string;
      curveAddress: string;
      marketCap: string;
    }>,
  ): Promise<{ tokenAddress: string; success: boolean; status: string; poolAddress?: string }> {
    try {
      const { tokenId, tokenAddress, curveAddress, marketCap } = job.data;

      this.logger.log(
        `Processing graduation for token ${tokenAddress} (market cap: ${marketCap})`,
      );

      // Check network connectivity
      const isHealthy = await this.blockchainService.healthCheck();
      if (!isHealthy) {
        throw new Error('Blockchain service not available');
      }

      // Get curve address if not provided
      const actualCurveAddress = curveAddress || await this.factoryService.getCurve(tokenAddress);
      if (!actualCurveAddress || actualCurveAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Bonding curve not found for token');
      }

      // Verify graduation readiness from contract
      const curveState = await this.bondingCurveService.getCurveState(actualCurveAddress);

      if (curveState.isListed) {
        this.logger.log(`Token ${tokenAddress} already graduated`);
        return {
          tokenAddress,
          success: true,
          status: 'already_graduated',
        };
      }

      // Check if market cap meets graduation threshold
      if (curveState.marketCap < curveState.graduationMarketCap) {
        this.logger.warn(
          `Token ${tokenAddress} market cap (${curveState.marketCap}) below threshold (${curveState.graduationMarketCap})`,
        );
        return {
          tokenAddress,
          success: false,
          status: 'below_threshold',
        };
      }

      // Check if already locked (graduation in progress)
      if (curveState.isLocked && !curveState.isListed) {
        this.logger.log(`Token ${tokenAddress} is locked, waiting for listing event`);

        // Emit event for frontend notification
        this.eventEmitter.emit('token.graduation.pending', {
          tokenId,
          tokenAddress,
          curveAddress: actualCurveAddress,
          marketCap: curveState.marketCap.toString(),
        });

        return {
          tokenAddress,
          success: true,
          status: 'pending_listing',
        };
      }

      // Token is ready for graduation - emit event for frontend
      // The actual listing() call must be made by an authorized wallet
      this.logger.log(`Token ${tokenAddress} ready for graduation - emitting event`);

      // Build the listing transaction for frontend
      const listingTx = this.transactionBuilder.encodeListing(actualCurveAddress);

      // Emit graduation ready event
      this.eventEmitter.emit('token.graduation.ready', {
        tokenId,
        tokenAddress,
        curveAddress: actualCurveAddress,
        marketCap: curveState.marketCap.toString(),
        graduationThreshold: curveState.graduationMarketCap.toString(),
        listingTransaction: listingTx,
      });

      // Update database to reflect pending graduation
      await this.prisma.token.update({
        where: { address: tokenAddress },
        data: {
          isLocked: true,
        },
      });

      this.logger.log(`Token ${tokenAddress} marked ready for graduation`);

      return {
        tokenAddress,
        success: true,
        status: 'ready_for_listing',
      };
    } catch (error) {
      this.logger.error(
        `Token graduation failed for job ${job.id}: ${error.message}`,
      );

      // Emit failure event
      if (job.data?.tokenAddress) {
        this.eventEmitter.emit('token.graduation.failed', {
          tokenAddress: job.data.tokenAddress,
          error: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Check graduation status for a token
   */
  async checkGraduationStatus(tokenAddress: string): Promise<{
    isReady: boolean;
    isLocked: boolean;
    isListed: boolean;
    marketCap: string;
    graduationThreshold: string;
    progress: number; // 0-100 percentage
  }> {
    const curveAddress = await this.factoryService.getCurve(tokenAddress);
    if (!curveAddress || curveAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Bonding curve not found');
    }

    const curveState = await this.bondingCurveService.getCurveState(curveAddress);

    // Calculate progress percentage
    const progress = curveState.graduationMarketCap > 0n
      ? Number((curveState.marketCap * 100n) / curveState.graduationMarketCap)
      : 0;

    return {
      isReady: curveState.marketCap >= curveState.graduationMarketCap && !curveState.isLocked,
      isLocked: curveState.isLocked,
      isListed: curveState.isListed,
      marketCap: curveState.marketCap.toString(),
      graduationThreshold: curveState.graduationMarketCap.toString(),
      progress: Math.min(progress, 100),
    };
  }

  /**
   * Get listing transaction for manual graduation
   */
  async getListingTransaction(tokenAddress: string): Promise<{
    to: string;
    data: string;
    value: string;
  }> {
    const curveAddress = await this.factoryService.getCurve(tokenAddress);
    if (!curveAddress || curveAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Bonding curve not found');
    }

    return this.transactionBuilder.encodeListing(curveAddress);
  }
}
