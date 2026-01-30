"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockHolder = createMockHolder;
exports.createMockHolders = createMockHolders;
exports.createWhaleHolder = createWhaleHolder;
exports.createSmallHolder = createSmallHolder;
exports.createZeroBalanceHolder = createZeroBalanceHolder;
exports.createCreatorAsHolder = createCreatorAsHolder;
exports.createHolderDistribution = createHolderDistribution;
exports.resetHolderCounter = resetHolderCounter;
exports.createMockUserPortfolio = createMockUserPortfolio;
exports.createProfitablePortfolio = createProfitablePortfolio;
exports.createLosingPortfolio = createLosingPortfolio;
exports.createMockPriceHistory = createMockPriceHistory;
exports.createMockPriceHistorySeries = createMockPriceHistorySeries;
const ethers_mock_1 = require("../ethers.mock");
let holderCounter = 0;
function generateHolderAddress() {
    holderCounter++;
    const hex = holderCounter.toString(16).padStart(40, 'a');
    return '0x' + hex;
}
const DEFAULT_HOLDER_VALUES = {
    balance: '1000000000000000000',
};
function createMockHolder(overrides = {}) {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.random().toString(36).slice(2, 9);
    return {
        id: overrides.id || 'holder-' + timestamp + '-' + random,
        tokenAddress: overrides.tokenAddress || ethers_mock_1.TEST_ADDRESSES.token,
        holderAddress: overrides.holderAddress || generateHolderAddress(),
        firstBuyTimestamp: overrides.firstBuyTimestamp || now,
        lastActivityTimestamp: overrides.lastActivityTimestamp || now,
        ...DEFAULT_HOLDER_VALUES,
        ...overrides,
    };
}
function createMockHolders(count, overrides = {}) {
    return Array.from({ length: count }, () => createMockHolder(overrides));
}
function createWhaleHolder(overrides = {}) {
    return createMockHolder({
        balance: '100000000000000000000000000',
        ...overrides,
    });
}
function createSmallHolder(overrides = {}) {
    return createMockHolder({
        balance: '100000000000000000',
        ...overrides,
    });
}
function createZeroBalanceHolder(overrides = {}) {
    return createMockHolder({
        balance: '0',
        ...overrides,
    });
}
function createCreatorAsHolder(creatorAddress, overrides = {}) {
    return createMockHolder({
        holderAddress: creatorAddress,
        balance: '50000000000000000000000000',
        ...overrides,
    });
}
function createHolderDistribution(tokenAddress, config = {}) {
    const whales = config.whales ?? 3;
    const medium = config.medium ?? 10;
    const small = config.small ?? 20;
    const holders = [];
    for (let i = 0; i < whales; i++) {
        const amount = (10 + Math.random() * 90).toFixed(0);
        holders.push(createMockHolder({
            tokenAddress,
            balance: amount + '000000000000000000000000',
        }));
    }
    for (let i = 0; i < medium; i++) {
        const amount = (10 + Math.random() * 990).toFixed(0);
        holders.push(createMockHolder({
            tokenAddress,
            balance: amount + '000000000000000000000',
        }));
    }
    for (let i = 0; i < small; i++) {
        const amount = (1 + Math.random() * 9).toFixed(0);
        holders.push(createMockHolder({
            tokenAddress,
            balance: amount + '000000000000000000000',
        }));
    }
    return holders;
}
function resetHolderCounter() {
    holderCounter = 0;
}
const DEFAULT_PORTFOLIO_VALUES = {
    totalInvested: '1000000000000000000',
    totalReturned: '0',
    totalTrades: 0,
};
function createMockUserPortfolio(overrides = {}) {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.random().toString(36).slice(2, 9);
    return {
        id: overrides.id || 'portfolio-' + timestamp + '-' + random,
        walletAddress: overrides.walletAddress || generateHolderAddress(),
        updatedAt: overrides.updatedAt || now,
        ...DEFAULT_PORTFOLIO_VALUES,
        ...overrides,
    };
}
function createProfitablePortfolio(overrides = {}) {
    return createMockUserPortfolio({
        totalInvested: '10000000000000000000',
        totalReturned: '25000000000000000000',
        totalTrades: 15,
        ...overrides,
    });
}
function createLosingPortfolio(overrides = {}) {
    return createMockUserPortfolio({
        totalInvested: '10000000000000000000',
        totalReturned: '3000000000000000000',
        totalTrades: 8,
        ...overrides,
    });
}
const DEFAULT_CANDLE_VALUES = {
    interval: 'ONE_MINUTE',
    open: '20000000000000',
    high: '22000000000000',
    low: '19000000000000',
    close: '21000000000000',
    volumeNative: '1000000000000000000',
    volumeToken: '50000000000000000000000',
    tradeCount: 10,
};
function createMockPriceHistory(overrides = {}) {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.random().toString(36).slice(2, 9);
    return {
        id: overrides.id || 'candle-' + timestamp + '-' + random,
        tokenAddress: overrides.tokenAddress || ethers_mock_1.TEST_ADDRESSES.token,
        timestamp: overrides.timestamp || now,
        ...DEFAULT_CANDLE_VALUES,
        ...overrides,
    };
}
function createMockPriceHistorySeries(tokenAddress, count, interval = 'ONE_MINUTE', startTimestamp) {
    const intervalMs = {
        ONE_MINUTE: 60 * 1000,
        FIVE_MINUTES: 5 * 60 * 1000,
        FIFTEEN_MINUTES: 15 * 60 * 1000,
        ONE_HOUR: 60 * 60 * 1000,
        FOUR_HOURS: 4 * 60 * 60 * 1000,
        ONE_DAY: 24 * 60 * 60 * 1000,
    };
    const start = startTimestamp || new Date(Date.now() - count * intervalMs[interval]);
    let currentPrice = 20000000000000;
    const candles = [];
    for (let i = 0; i < count; i++) {
        const timestamp = new Date(start.getTime() + i * intervalMs[interval]);
        const change = (Math.random() - 0.48) * 0.1;
        const open = currentPrice;
        const close = Math.floor(currentPrice * (1 + change));
        const high = Math.max(open, close) + Math.floor(Math.random() * 1000000000000);
        const low = Math.min(open, close) - Math.floor(Math.random() * 1000000000000);
        const volumeNativeNum = Math.floor(Math.random() * 10 + 1);
        const volumeTokenNum = Math.floor(Math.random() * 100 + 10);
        candles.push(createMockPriceHistory({
            tokenAddress,
            timestamp,
            interval,
            open: open.toString(),
            high: Math.max(high, open, close).toString(),
            low: Math.max(low, 1).toString(),
            close: close.toString(),
            volumeNative: volumeNativeNum + '000000000000000000',
            volumeToken: volumeTokenNum + '000000000000000000000',
            tradeCount: Math.floor(Math.random() * 20 + 1),
        }));
        currentPrice = close;
    }
    return candles;
}
//# sourceMappingURL=holder.factory.js.map