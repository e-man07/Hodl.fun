import { DomainEvent } from '../../shared/domain-event';

/**
 * Token Created Event
 *
 * Published when a new token is created (from blockchain TokenCreated/Create event).
 * Signals the creation of a new token in the marketplace.
 */
export class TokenCreatedEvent extends DomainEvent {
  constructor(
    readonly tokenId: string,
    readonly tokenAddress: string,
    readonly name: string,
    readonly symbol: string,
    readonly creator: string,
    readonly initialPrice: bigint,
    readonly initialMarketCap: bigint,
    readonly createdAt: Date,
  ) {
    super();
  }
}
