import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException, Injectable } from '@nestjs/common';
import { SellTokenCommand } from '../sell-token.command';
import {
  MarketCap,
  ITokenRepository,
  TOKEN_REPOSITORY,
  Trade,
  TokenPrice,
  ReserveBalance,
} from '@domain';
import { ITradeRepository, TRADE_REPOSITORY } from '@domain';
import { CoreContractService } from '@infrastructure/contracts/services/core-contract.service';
import { BondingCurveContractService } from '@infrastructure/contracts/services/bonding-curve-contract.service';
import { FactoryContractService } from '@infrastructure/contracts/services/factory-contract.service';

/**
 * Sell Token Command Handler
 *
 * Executes a sell operation:
 * 1. Load token aggregate from repository
 * 2. Read current on-chain state from contracts
 * 3. Verify trade parameters
 * 4. Calculate expected output using bonding curve formula
 * 5. Record trade (after on-chain execution via indexer)
 * 6. Update token metrics with on-chain data
 * 7. Publish domain events
 *
 * Note: With v2 architecture, actual sell transactions happen on-chain.
 * This handler processes confirmed trades from the indexer.
 */
@Injectable()
@CommandHandler(SellTokenCommand)
export class SellTokenHandler implements ICommandHandler<SellTokenCommand> {
  private readonly logger = new Logger(SellTokenHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: ITradeRepository,
    private readonly coreContract: CoreContractService,
    private readonly bondingCurveContract: BondingCurveContractService,
    private readonly factoryContract: FactoryContractService,
  ) {}

  async execute(
    command: SellTokenCommand,
  ): Promise<{
    amountOut: bigint;
    newPrice: bigint;
    newMarketCap: bigint;
  }> {
    this.logger.log(
      `Processing sell: ${command.seller} selling ${command.amountInTokens} tokens of ${command.tokenId}`,
    );

    try {
      // Load token from repository
      const token = await this.tokenRepository.findById(command.tokenId);
      if (!token) {
        throw new BadRequestException(`Token not found: ${command.tokenId}`);
      }

      const tokenAddress = token.getAddress().toString();

      // Get curve address for this token
      const curveAddress = await this.factoryContract.getCurve(tokenAddress);
      if (!curveAddress) {
        throw new BadRequestException(
          `No bonding curve found for token: ${tokenAddress}`,
        );
      }

      // Check if token is locked on-chain
      const isLocked = await this.bondingCurveContract.getLock(curveAddress);
      if (isLocked) {
        throw new BadRequestException(
          'Token is locked and cannot be traded on bonding curve',
        );
      }

      // Read current on-chain state
      const curveData = await this.coreContract.getCurveData(curveAddress);
      const virtualReserves =
        await this.bondingCurveContract.getVirtualReserves(curveAddress);
      const realReserves =
        await this.bondingCurveContract.getReserves(curveAddress);

      // Calculate expected output using bonding curve formula (sell tokens for native)
      const totalNativeReserve =
        virtualReserves.virtualNativeReserve + realReserves.nativeReserves;
      const totalTokenReserve =
        virtualReserves.virtualTokenReserve + realReserves.tokenReserves;

      // For sell: amountIn = tokens, amountOut = native (PUSH)
      const amountOut = await this.coreContract.getAmountIn(
        command.amountInTokens,
        curveData.k,
        totalTokenReserve,
        totalNativeReserve,
      );

      // Calculate new reserves after sell
      const newTokenReserve = totalTokenReserve + command.amountInTokens;
      const newNativeReserve = totalNativeReserve - amountOut;

      // Calculate new price after sell
      const newPrice =
        newTokenReserve > 0n ? newNativeReserve / newTokenReserve : 0n;

      // Calculate new market cap
      const newMarketCap =
        (token.getTotalSupply() / BigInt(10 ** token.getDecimals())) * newPrice;

      // Update token with on-chain data
      const newReserveBalance = ReserveBalance.create(
        realReserves.nativeReserves - amountOut,
        realReserves.tokenReserves + command.amountInTokens,
        virtualReserves.virtualNativeReserve,
        virtualReserves.virtualTokenReserve,
      );

      token.updateMetrics(
        TokenPrice.fromBigInt(newPrice),
        MarketCap.fromBigInt(newMarketCap),
        newReserveBalance,
      );

      // Save updated token state
      await this.tokenRepository.update(token);

      // Record trade as immutable history
      const tradeId = `${command.transactionHash}-sell`;

      // Check if trade already exists (idempotency)
      const existingTrade = await this.tradeRepository.findById(tradeId);
      if (!existingTrade) {
        const trade = Trade.createSell(
          tradeId,
          command.tokenId,
          command.seller,
          command.amountInTokens,
          amountOut,
          newPrice,
          command.transactionHash,
          command.blockNumber,
          new Date(),
        );

        await this.tradeRepository.save(trade);
      }

      this.logger.log(
        `Sell executed: ${amountOut} PUSH at ${newPrice} PUSH/token`,
      );

      return {
        amountOut,
        newPrice,
        newMarketCap,
      };
    } catch (error) {
      this.logger.error(`Sell failed: ${error.message}`);
      throw error;
    }
  }
}
