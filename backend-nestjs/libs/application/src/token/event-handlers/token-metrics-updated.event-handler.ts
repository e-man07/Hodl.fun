import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Injectable } from '@nestjs/common';
import { TokenMetricsUpdatedEvent } from '@domain';

/**
 * Token Metrics Updated Event Handler
 *
 * Listens for TokenMetricsUpdatedEvent (published after every trade)
 *
 * Side effects:
 * - Invalidate cached token data
 * - Update real-time dashboards
 * - Broadcast to WebSocket clients (price changes)
 * - Update time-series data for charts
 *
 * This is a high-frequency event (happens on every buy/sell)
 * so implementations should be efficient
 */
@Injectable()
@EventsHandler(TokenMetricsUpdatedEvent)
export class TokenMetricsUpdatedEventHandler
  implements IEventHandler<TokenMetricsUpdatedEvent>
{
  private readonly logger = new Logger(TokenMetricsUpdatedEventHandler.name);

  handle(event: TokenMetricsUpdatedEvent): void {
    this.logger.debug(
      `Token metrics updated: ${event.tokenAddress} - Price: ${event.currentPrice}, Market Cap: ${event.marketCap}`,
    );

    // Side effects:
    // - this.cacheService.invalidate(`token:${event.tokenAddress}`)
    // - this.websocketGateway.broadcast('token.metrics.updated', event)
    // - this.timeSeriesService.record(event.tokenAddress, { price: event.currentPrice, marketCap: event.marketCap })
    // - if (event.athPriceUpdated) this.notificationService.sendATHAlert(event.tokenAddress)
  }
}
