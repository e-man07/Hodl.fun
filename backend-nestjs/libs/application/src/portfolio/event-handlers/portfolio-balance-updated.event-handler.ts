import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Injectable } from '@nestjs/common';
import { PortfolioBalanceUpdatedEvent } from '@domain';

/**
 * Portfolio Balance Updated Event Handler
 *
 * Listens for PortfolioBalanceUpdatedEvent (published when user buys/sells tokens)
 *
 * Side effects:
 * - Update user's portfolio view in real-time
 * - Invalidate portfolio cache for user
 * - Broadcast portfolio changes to user's WebSocket connections
 * - Update portfolio analytics
 * - Trigger any user-specific notifications
 *
 * High-frequency event (happens on every trade), should be efficient
 */
@Injectable()
@EventsHandler(PortfolioBalanceUpdatedEvent)
export class PortfolioBalanceUpdatedEventHandler
  implements IEventHandler<PortfolioBalanceUpdatedEvent>
{
  private readonly logger = new Logger(PortfolioBalanceUpdatedEventHandler.name);

  handle(event: PortfolioBalanceUpdatedEvent): void {
    this.logger.debug(
      `Portfolio updated: ${event.userId} - ${event.operation} ${event.tokenAmount} of ${event.tokenAddress}`,
    );

    // Side effects:
    // - this.cacheService.invalidate(`portfolio:${event.userId}`)
    // - this.websocketGateway.sendToUser(event.userId, 'portfolio.balance.updated', event)
    // - this.portfolioService.updateHoldings(event.userId, event.tokenAddress, event.tokenAmount, event.operation)
    // - this.analyticsService.trackPortfolioTrade(event.userId, {
    //     operation: event.operation,
    //     tokenAmount: event.tokenAmount,
    //     pushAmount: event.pushAmount,
    //     timestamp: event.timestamp
    //   })
  }
}
