import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Injectable } from '@nestjs/common';
import { TokenCreatedEvent } from '@domain';

/**
 * Token Created Event Handler
 *
 * Listens for TokenCreatedEvent (published when new token is created)
 *
 * Side effects:
 * - Update read model (cache token in Redis)
 * - Log creation event for audit trail
 * - Trigger any downstream processes (webhooks, notifications, etc.)
 *
 * Note: Read model updates will happen in infrastructure layer
 * (repositories, caching service, etc.)
 */
@Injectable()
@EventsHandler(TokenCreatedEvent)
export class TokenCreatedEventHandler implements IEventHandler<TokenCreatedEvent> {
  private readonly logger = new Logger(TokenCreatedEventHandler.name);

  handle(event: TokenCreatedEvent): void {
    this.logger.log(
      `Token created: ${event.tokenAddress} (${event.symbol}) by ${event.creator}`,
    );

    // Side effects would be triggered here:
    // - this.redisService.cache(`token:${event.tokenAddress}`, event)
    // - this.webhookService.trigger('token.created', event)
    // - this.analyticsService.track('token_created', { symbol: event.tokenSymbol })
  }
}
