import { DomainEvent } from '../../shared/domain-event';

/**
 * Token Listed Event
 *
 * Published when a token is listed on Uniswap V3 after successful graduation.
 * Contains the Uniswap V3 pool address for the token-PUSH pair.
 *
 * Signals completion of the graduation flow:
 * 1. Market cap reaches 100 PUSH threshold
 * 2. Token is locked from bonding curve trading
 * 3. Liquidity is provided to Uniswap V3
 * 4. TokenListedEvent is published
 *
 * Listeners use this to:
 * - Update read models with pool address
 * - Redirect users to trade on Uniswap
 * - Disable bonding curve UI
 * - Archive token from marketplace feed
 */
export class TokenListedEvent extends DomainEvent {
  constructor(
    readonly tokenId: string,
    readonly tokenAddress: string,
    readonly uniswapV3PoolAddress: string,
    readonly listedAt: Date,
  ) {
    super();
  }
}
