"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockBuyTrade = createMockBuyTrade;
exports.createMockSellTrade = createMockSellTrade;
exports.createMockTrade = createMockTrade;
exports.createMockTrades = createMockTrades;
exports.createWhaleBuyTrade = createWhaleBuyTrade;
exports.createSmallBuyTrade = createSmallBuyTrade;
exports.createTradesForCandles = createTradesForCandles;
exports.resetTradeCounter = resetTradeCounter;
const ethers_mock_1 = require("../ethers.mock");
let tradeCounter = 0;
function generateTxHash() {
    tradeCounter++;
    const hex = tradeCounter.toString(16).padStart(64, '0');
    return `0x${hex}`;
}
const DEFAULT_BUY_VALUES = {
    type: 'BUY',
    amountIn: '1000000000000000000',
    amountOut: '49505000000000000000000',
    price: '20200000000000',
    feeAmount: '10000000000000000',
    blockNumber: BigInt(1001),
};
const DEFAULT_SELL_VALUES = {
    type: 'SELL',
    amountIn: '49505000000000000000000',
    amountOut: '980000000000000000',
    price: '19800000000000',
    feeAmount: '10000000000000000',
    blockNumber: BigInt(1002),
};
function createMockBuyTrade(overrides = {}) {
    const now = new Date();
    return {
        id: overrides.id || `trade-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        tokenAddress: overrides.tokenAddress || ethers_mock_1.TEST_ADDRESSES.token,
        traderAddress: overrides.traderAddress || ethers_mock_1.TEST_ADDRESSES.user1,
        txHash: overrides.txHash || generateTxHash(),
        timestamp: overrides.timestamp || now,
        ...DEFAULT_BUY_VALUES,
        ...overrides,
    };
}
function createMockSellTrade(overrides = {}) {
    const now = new Date();
    return {
        id: overrides.id || `trade-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        tokenAddress: overrides.tokenAddress || ethers_mock_1.TEST_ADDRESSES.token,
        traderAddress: overrides.traderAddress || ethers_mock_1.TEST_ADDRESSES.user1,
        txHash: overrides.txHash || generateTxHash(),
        timestamp: overrides.timestamp || now,
        ...DEFAULT_SELL_VALUES,
        ...overrides,
    };
}
function createMockTrade(overrides = {}) {
    if (overrides.type === 'SELL') {
        return createMockSellTrade(overrides);
    }
    return createMockBuyTrade(overrides);
}
function createMockTrades(count, tokenAddress = ethers_mock_1.TEST_ADDRESSES.token, options = {}) {
    const baseTime = new Date();
    return Array.from({ length: count }, (_, i) => {
        const timestamp = new Date(baseTime.getTime() - i * 60000);
        const type = options.alternateType
            ? i % 2 === 0
                ? 'BUY'
                : 'SELL'
            : 'BUY';
        return createMockTrade({
            tokenAddress,
            type,
            timestamp,
            blockNumber: BigInt(1000 + i),
        });
    });
}
function createWhaleBuyTrade(overrides = {}) {
    return createMockBuyTrade({
        amountIn: '100000000000000000000',
        amountOut: '4500000000000000000000000',
        feeAmount: '1000000000000000000',
        ...overrides,
    });
}
function createSmallBuyTrade(overrides = {}) {
    return createMockBuyTrade({
        amountIn: '10000000000000000',
        amountOut: '495000000000000000000',
        feeAmount: '100000000000000',
        ...overrides,
    });
}
function createTradesForCandles(tokenAddress, count, intervalMs = 60000) {
    const baseTime = new Date();
    const trades = [];
    for (let i = 0; i < count; i++) {
        const timestamp = new Date(baseTime.getTime() - i * intervalMs);
        const priceMultiplier = 1 + (Math.sin(i * 0.5) * 0.1);
        const basePrice = 20000000000000;
        const price = Math.floor(basePrice * priceMultiplier).toString();
        trades.push(createMockBuyTrade({
            tokenAddress,
            timestamp,
            price,
            blockNumber: BigInt(1000 + count - i),
        }));
    }
    return trades;
}
function resetTradeCounter() {
    tradeCounter = 0;
}
//# sourceMappingURL=trade.factory.js.map