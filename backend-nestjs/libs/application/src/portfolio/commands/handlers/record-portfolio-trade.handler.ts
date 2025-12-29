import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, Injectable } from '@nestjs/common';
import { RecordPortfolioTradeCommand } from '../record-portfolio-trade.command';
import { Portfolio, IPortfolioRepository, PORTFOLIO_REPOSITORY } from '@domain';

/**
 * Record Portfolio Trade Command Handler
 *
 * Records a trade in user portfolio:
 * 1. Load or create portfolio for user
 * 2. Record buy or sell (updates holdings, avg price, PNL)
 * 3. Save updated portfolio
 * 4. Publish domain events (PortfolioBalanceUpdatedEvent)
 *
 * Side effects:
 * - Updates read model (portfolio state in database)
 * - Triggers portfolio event handlers (caching, WebSocket updates, etc.)
 */
@Injectable()
@CommandHandler(RecordPortfolioTradeCommand)
export class RecordPortfolioTradeHandler
  implements ICommandHandler<RecordPortfolioTradeCommand>
{
  private readonly logger = new Logger(RecordPortfolioTradeHandler.name);

  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
  ) {}

  async execute(command: RecordPortfolioTradeCommand): Promise<Portfolio> {
    this.logger.log(
      `Recording portfolio ${command.type}: ${command.userId} - ${command.tokenAmount} of ${command.tokenSymbol}`,
    );

    try {
      // Get or create portfolio
      const portfolio =
        await this.portfolioRepository.findOrCreateByUserId(command.userId);

      // Record the trade
      if (command.type === 'buy') {
        portfolio.recordBuy(
          command.tokenAddress,
          command.tokenSymbol,
          command.tokenAmount,
          command.pushAmount,
          command.pricePerToken,
        );
      } else {
        portfolio.recordSell(
          command.tokenAddress,
          command.tokenAmount,
          command.pushAmount,
        );
      }

      // Save updated portfolio
      const updated = await this.portfolioRepository.save(portfolio);

      this.logger.log(
        `Portfolio trade recorded: ${command.userId} - ${command.type}`,
      );

      return updated;
    } catch (error) {
      this.logger.error(`Failed to record portfolio trade: ${error.message}`);
      throw error;
    }
  }
}
