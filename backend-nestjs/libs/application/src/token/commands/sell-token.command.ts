/**
 * Sell Token Command
 *
 * CQRS Command: Execute a sell operation on the bonding curve
 *
 * Command parameters:
 * - tokenId: The token being sold
 * - seller: User address executing the sell
 * - amountInTokens: Amount of tokens to sell (wei)
 * - minAmountOut: Minimum PUSH to receive (slippage protection)
 * - transactionHash: Blockchain tx hash for verification
 * - blockNumber: Block where transaction occurred
 */
export class SellTokenCommand {
  constructor(
    readonly tokenId: string,
    readonly seller: string,
    readonly amountInTokens: bigint,
    readonly minAmountOut: bigint,
    readonly transactionHash: string,
    readonly blockNumber: number,
  ) {}
}
