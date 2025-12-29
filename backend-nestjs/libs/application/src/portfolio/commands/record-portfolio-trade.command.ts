/**
 * Record Portfolio Trade Command
 *
 * CQRS Command: Record a buy/sell operation in user portfolio
 *
 * Typically called after successful buy/sell on bonding curve.
 * Updates user's holdings, average buy price, and PNL calculations.
 */
export class RecordPortfolioTradeCommand {
  constructor(
    readonly userId: string,
    readonly tokenAddress: string,
    readonly tokenSymbol: string,
    readonly type: 'buy' | 'sell',
    readonly tokenAmount: bigint,
    readonly pushAmount: bigint,
    readonly pricePerToken: bigint,
  ) {}
}
