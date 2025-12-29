/**
 * Buy Token Command
 *
 * CQRS Command: Execute a buy operation on the bonding curve
 *
 * Command parameters:
 * - tokenId: The token being purchased
 * - buyer: User address executing the buy
 * - amountInPUSH: Amount of PUSH to spend (wei)
 * - minAmountOut: Minimum tokens to receive (slippage protection)
 * - transactionHash: Blockchain tx hash for verification
 * - blockNumber: Block where transaction occurred
 */
export class BuyTokenCommand {
  constructor(
    readonly tokenId: string,
    readonly buyer: string,
    readonly amountInPUSH: bigint,
    readonly minAmountOut: bigint,
    readonly transactionHash: string,
    readonly blockNumber: number,
  ) {}
}
