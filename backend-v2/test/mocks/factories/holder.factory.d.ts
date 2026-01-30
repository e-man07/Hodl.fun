export type PriceInterval = 'ONE_MINUTE' | 'FIVE_MINUTES' | 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'FOUR_HOURS' | 'ONE_DAY';
export interface MockHolder {
    id: string;
    tokenAddress: string;
    holderAddress: string;
    balance: string;
    firstBuyTimestamp: Date;
    lastActivityTimestamp: Date;
}
export interface MockUserPortfolio {
    id: string;
    walletAddress: string;
    totalInvested: string;
    totalReturned: string;
    totalTrades: number;
    updatedAt: Date;
}
export interface MockPriceHistory {
    id: string;
    tokenAddress: string;
    timestamp: Date;
    interval: PriceInterval;
    open: string;
    high: string;
    low: string;
    close: string;
    volumeNative: string;
    volumeToken: string;
    tradeCount: number;
}
export declare function createMockHolder(overrides?: Partial<MockHolder>): MockHolder;
export declare function createMockHolders(count: number, overrides?: Partial<MockHolder>): MockHolder[];
export declare function createWhaleHolder(overrides?: Partial<MockHolder>): MockHolder;
export declare function createSmallHolder(overrides?: Partial<MockHolder>): MockHolder;
export declare function createZeroBalanceHolder(overrides?: Partial<MockHolder>): MockHolder;
export declare function createCreatorAsHolder(creatorAddress: string, overrides?: Partial<MockHolder>): MockHolder;
export declare function createHolderDistribution(tokenAddress: string, config?: {
    whales?: number;
    medium?: number;
    small?: number;
}): MockHolder[];
export declare function resetHolderCounter(): void;
export declare function createMockUserPortfolio(overrides?: Partial<MockUserPortfolio>): MockUserPortfolio;
export declare function createProfitablePortfolio(overrides?: Partial<MockUserPortfolio>): MockUserPortfolio;
export declare function createLosingPortfolio(overrides?: Partial<MockUserPortfolio>): MockUserPortfolio;
export declare function createMockPriceHistory(overrides?: Partial<MockPriceHistory>): MockPriceHistory;
export declare function createMockPriceHistorySeries(tokenAddress: string, count: number, interval?: PriceInterval, startTimestamp?: Date): MockPriceHistory[];
