import { DomainEvent } from '../../shared/domain-event';

/**
 * Portfolio Balance Updated Event
 *
 * Published when a user's token balance changes (buy or sell).
 * Signals portfolio mutation.
 *
 * Listeners use this to:
 * - Update read models (portfolio view)
 * - Invalidate caches
 * - Broadcast real-time updates to user's WebSocket clients
 * - Calculate portfolio analytics
 */
export class PortfolioBalanceUpdatedEvent extends DomainEvent {
  constructor(
    readonly portfolioId: string,
    readonly userId: string,
    readonly tokenAddress: string,
    readonly operation: 'buy' | 'sell',
    readonly tokenAmount: bigint,
    readonly pushAmount: bigint,
    readonly timestamp: Date,
  ) {
    super();
  }
}
