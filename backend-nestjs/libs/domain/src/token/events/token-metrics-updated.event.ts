import { DomainEvent } from '../../shared/domain-event';

/**
 * Token Metrics Updated Event
 *
 * Published after every trade (buy/sell) or blockchain sync.
 * Signals that token price, market cap, or reserves have changed.
 *
 * Listeners use this to:
 * - Invalidate caches
 * - Update read models
 * - Broadcast real-time updates to WebSocket clients
 * - Trigger graduation checks
 */
export class TokenMetricsUpdatedEvent extends DomainEvent {
  constructor(
    readonly tokenId: string,
    readonly tokenAddress: string,
    readonly currentPrice: bigint,
    readonly marketCap: bigint,
    readonly totalNativeReserve: bigint,
    readonly totalTokenReserve: bigint,
    readonly athPriceUpdated: boolean,
    readonly athMarketCapUpdated: boolean,
    readonly timestamp: Date,
  ) {
    super();
  }
}
