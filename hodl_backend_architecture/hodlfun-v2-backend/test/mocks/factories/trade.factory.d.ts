export type TradeType = 'BUY' | 'SELL';
export interface MockTrade {
    id: string;
    tokenAddress: string;
    type: TradeType;
    traderAddress: string;
    amountIn: string;
    amountOut: string;
    price: string;
    feeAmount: string;
    txHash: string;
    blockNumber: bigint;
    timestamp: Date;
}
export declare function createMockBuyTrade(overrides?: Partial<MockTrade>): MockTrade;
export declare function createMockSellTrade(overrides?: Partial<MockTrade>): MockTrade;
export declare function createMockTrade(overrides?: Partial<MockTrade>): MockTrade;
export declare function createMockTrades(count: number, tokenAddress?: string, options?: {
    alternateType?: boolean;
}): MockTrade[];
export declare function createWhaleBuyTrade(overrides?: Partial<MockTrade>): MockTrade;
export declare function createSmallBuyTrade(overrides?: Partial<MockTrade>): MockTrade;
export declare function createTradesForCandles(tokenAddress: string, count: number, intervalMs?: number): MockTrade[];
export declare function resetTradeCounter(): void;
