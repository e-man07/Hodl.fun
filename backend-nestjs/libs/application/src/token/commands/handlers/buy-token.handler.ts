import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException, Injectable } from '@nestjs/common';
import { BuyTokenCommand } from '../buy-token.command';
import {
  MarketCap,
  ITokenRepository,
  TOKEN_REPOSITORY,
  Trade,
} from '@domain';
import { ITradeRepository, TRADE_REPOSITORY } from '@domain';

/**
 * Buy Token Command Handler
 *
 * Executes a buy operation:
 * 1. Load token aggregate from repository
 * 2. Execute buy logic (bonding curve formula: x*y=k)
 * 3. Calculate new price and market cap
 * 4. Update token metrics
 * 5. Record trade
 * 6. Save state
 * 7. Publish domain events (TokenMetricsUpdatedEvent, NewATHPriceEvent, etc.)
 *
 * Result: {
 *   amountOut: tokens received,
 *   newPrice: updated price per token,
 *   newMarketCap: updated market cap,
 *   graduationReady: whether token reached graduation threshold
 * }
 */
@Injectable()
@CommandHandler(BuyTokenCommand)
export class BuyTokenHandler implements ICommandHandler<BuyTokenCommand> {
  private readonly logger = new Logger(BuyTokenHandler.name);

  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: ITokenRepository,
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: ITradeRepository,
  ) {}

  async execute(
    command: BuyTokenCommand,
  ): Promise<{
    amountOut: bigint;
    newPrice: bigint;
    newMarketCap: bigint;
    graduationReady: boolean;
  }> {
    this.logger.log(
      `Processing buy: ${command.buyer} buying ${command.amountInPUSH} PUSH of token ${command.tokenId}`,
    );

    try {
      // Load token
      const token = await this.tokenRepository.findById(command.tokenId);
      if (!token) {
        throw new BadRequestException(`Token not found: ${command.tokenId}`);
      }

      if (token.getIsLocked()) {
        throw new BadRequestException(
          'Token is locked and cannot be traded on bonding curve',
        );
      }

      // Execute buy on bonding curve
      const buyResult = token.executeBuy(command.amountInPUSH);

      // Calculate new market cap
      const newMarketCap = MarketCap.fromBigInt(
        (token.getTotalSupply() / BigInt(10 ** token.getDecimals())) *
          buyResult.newPrice.toBigInt(),
      );

      // Update metrics
      token.updateMetrics(
        buyResult.newPrice,
        newMarketCap,
        buyResult.newReserveBalance,
      );

      // Save updated token state
      await this.tokenRepository.update(token);

      // Record trade as immutable history
      const tradeId = `${command.transactionHash}-buy`;
      const trade = Trade.createBuy(
        tradeId,
        command.tokenId,
        command.buyer,
        command.amountInPUSH,
        buyResult.amountOut,
        buyResult.newPrice.toBigInt(),
        command.transactionHash,
        command.blockNumber,
        new Date(),
      );

      await this.tradeRepository.save(trade);

      // Check graduation threshold
      const graduationReady = token.isReadyForGraduation();

      this.logger.log(
        `Buy executed: ${buyResult.amountOut} tokens at ${buyResult.newPrice.toBigInt()} PUSH/token`,
      );

      return {
        amountOut: buyResult.amountOut,
        newPrice: buyResult.newPrice.toBigInt(),
        newMarketCap: newMarketCap.toBigInt(),
        graduationReady,
      };
    } catch (error) {
      this.logger.error(`Buy failed: ${error.message}`);
      throw error;
    }
  }
}
