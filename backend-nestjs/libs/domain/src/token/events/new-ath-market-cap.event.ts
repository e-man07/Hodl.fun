import { DomainEvent } from '../../shared/domain-event';

/**
 * New ATH (All-Time High) Market Cap Event
 *
 * Published when token market cap reaches a new all-time high.
 * Market cap ATH tracking enables graduation milestone tracking.
 *
 * Listeners use this to:
 * - Update read models with new ATH market cap
 * - Check if graduation threshold (100 PUSH) is reached
 * - Notify users about significant market cap milestones
 * - Update leaderboards and rankings
 * - Broadcast to WebSocket clients for real-time updates
 */
export class NewATHMarketCapEvent extends DomainEvent {
  constructor(
    readonly tokenId: string,
    readonly tokenAddress: string,
    readonly newATHMarketCap: bigint,
    readonly timestamp: Date,
  ) {
    super();
  }
}
