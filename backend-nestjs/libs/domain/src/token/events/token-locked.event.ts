import { DomainEvent } from '../../shared/domain-event';

/**
 * Token Locked Event
 *
 * Published when a token reaches the graduation threshold and is locked from bonding curve trading.
 * This typically happens when market cap reaches 100 PUSH (1,000,000 in scaled value).
 *
 * After locking, the token transitions to Uniswap V3 integration.
 * Bonding curve trading is disabled.
 */
export class TokenLockedEvent extends DomainEvent {
  constructor(
    readonly tokenId: string,
    readonly tokenAddress: string,
    readonly lockedAt: Date,
  ) {
    super();
  }
}
