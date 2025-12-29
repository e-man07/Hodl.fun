/**
 * List On Uniswap Command
 *
 * CQRS Command: List a locked token on Uniswap V3
 *
 * Prerequisites:
 * - Token must be locked (market cap >= 100 PUSH)
 * - Uniswap V3 pool must be created and have liquidity
 *
 * Final step in graduation flow:
 * - Token → Active on bonding curve
 * - → Market cap >= 100 PUSH → Locked
 * - → Liquidity added to Uniswap → Listed
 */
export class ListOnUniswapCommand {
  constructor(
    readonly tokenId: string,
    readonly uniswapV3PoolAddress: string,
  ) {}
}
