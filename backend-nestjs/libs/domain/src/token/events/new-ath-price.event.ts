import { DomainEvent } from '../../shared/domain-event';

/**
 * New ATH (All-Time High) Price Event
 *
 * Published when token price reaches a new all-time high.
 * ATH tracking enables market analysis and user notifications.
 *
 * Listeners use this to:
 * - Update read models with new ATH price
 * - Notify users about milestones
 * - Update token cards/charts with ATH indicators
 * - Broadcast to WebSocket clients for real-time updates
 */
export class NewATHPriceEvent extends DomainEvent {
  constructor(
    readonly tokenId: string,
    readonly tokenAddress: string,
    readonly newATHPrice: bigint,
    readonly timestamp: Date,
  ) {
    super();
  }
}
