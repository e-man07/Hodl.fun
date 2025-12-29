import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, BadRequestException, Injectable } from '@nestjs/common';
import { SellTokenCommand } from '../sell-token.command';
import {
  MarketCap,
  ITokenRepository,
  TOKEN_REPOSITORY,
  Trade,
} from '@domain';
import { ITradeRepository, TRADE_REPOSITORY } from '@domain';

/**
 * Sell Token Command Handler
 *
 * Executes a sell operation:
 * 1. Load token aggregate from repository
 * 2. Execute sell logic (bonding curve formula: x*y=k)
 * 3. Calculate new price and market cap
 * 4. Update token metrics
 * 5. Record trade
 * 6. Save state
 * 7. Publish domain events (TokenMetricsUpdatedEvent, etc.)
 *
 * Result: {
 *   amountOut: PUSH received,
 *   newPrice: updated price per token,
 *   newMarketCap: updated market cap
 * }
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

      // Execute sell on bonding curve
      const sellResult = token.executeSell(command.amountInTokens);

      // Calculate new market cap
      const newMarketCap = MarketCap.fromBigInt(
        (token.getTotalSupply() / BigInt(10 ** token.getDecimals())) *
          sellResult.newPrice.toBigInt(),
      );

      // Update metrics
      token.updateMetrics(
        sellResult.newPrice,
        newMarketCap,
        sellResult.newReserveBalance,
      );

      // Save updated token state
      await this.tokenRepository.update(token);

      // Record trade as immutable history
      const tradeId = `${command.transactionHash}-sell`;
      const trade = Trade.createSell(
        tradeId,
        command.tokenId,
        command.seller,
        command.amountInTokens,
        sellResult.amountOut,
        sellResult.newPrice.toBigInt(),
        command.transactionHash,
        command.blockNumber,
        new Date(),
      );

      await this.tradeRepository.save(trade);

      this.logger.log(
        `Sell executed: ${sellResult.amountOut} PUSH at ${sellResult.newPrice.toBigInt()} PUSH/token`,
      );

      return {
        amountOut: sellResult.amountOut,
        newPrice: sellResult.newPrice.toBigInt(),
        newMarketCap: newMarketCap.toBigInt(),
      };
    } catch (error) {
      this.logger.error(`Sell failed: ${error.message}`);
      throw error;
    }
  }
}
