/**
 * Lock Token Command
 *
 * CQRS Command: Lock a token that reached graduation threshold
 *
 * Transition:
 * - Token is active on bonding curve
 * - Market cap reaches 100 PUSH (graduation threshold)
 * - Token is locked, can no longer trade on bonding curve
 * - Next step: list on Uniswap V3
 */
export class LockTokenCommand {
  constructor(readonly tokenId: string) {}
}
