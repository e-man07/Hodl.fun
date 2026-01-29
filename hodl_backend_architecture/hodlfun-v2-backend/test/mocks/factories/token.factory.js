"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockToken = createMockToken;
exports.createMockTokens = createMockTokens;
exports.createGraduatedToken = createGraduatedToken;
exports.createListedToken = createListedToken;
exports.createTokenWithATH = createTokenWithATH;
exports.createTrendingToken = createTrendingToken;
exports.resetTokenCounter = resetTokenCounter;
const ethers_mock_1 = require("../ethers.mock");
let tokenCounter = 0;
function generateTokenAddress() {
    tokenCounter++;
    const hex = tokenCounter.toString(16).padStart(40, '0');
    return `0x${hex}`;
}
const DEFAULT_VALUES = {
    creatorAddress: ethers_mock_1.TEST_ADDRESSES.user1,
    name: 'Test Token',
    symbol: 'TEST',
    tokenUri: 'https://example.com/token.json',
    virtualNative: '1000000000000000000',
    virtualToken: '50000000000000000000000000',
    realNative: '0',
    realToken: '0',
    k: '50000000000000000000000000000000000000000000',
    currentPrice: '20000000000000',
    marketCap: '20000000000000000000000',
    athPrice: null,
    athPriceTimestamp: null,
    athMarketCap: null,
    athMarketCapTimestamp: null,
    status: 'TRADING',
    poolAddress: null,
    createdBlock: BigInt(1000),
    graduatedAt: null,
    listedAt: null,
    listingBlock: null,
};
function createMockToken(overrides = {}) {
    const now = new Date();
    const address = overrides.address || generateTokenAddress();
    const curveAddress = overrides.curveAddress || generateTokenAddress();
    return {
        id: overrides.id || `token-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        address,
        curveAddress,
        createdAt: overrides.createdAt || now,
        updatedAt: overrides.updatedAt || now,
        ...DEFAULT_VALUES,
        ...overrides,
    };
}
function createMockTokens(count, overrides = {}) {
    return Array.from({ length: count }, (_, i) => createMockToken({
        name: `Token ${i + 1}`,
        symbol: `TK${i + 1}`,
        ...overrides,
    }));
}
function createGraduatedToken(overrides = {}) {
    return createMockToken({
        status: 'LOCKED',
        graduatedAt: new Date(),
        marketCap: '1000000000000000000000000',
        ...overrides,
    });
}
function createListedToken(overrides = {}) {
    return createMockToken({
        status: 'LISTED',
        graduatedAt: new Date(Date.now() - 3600000),
        listedAt: new Date(),
        listingBlock: BigInt(2000),
        poolAddress: ethers_mock_1.TEST_ADDRESSES.pool,
        marketCap: '1500000000000000000000000',
        ...overrides,
    });
}
function createTokenWithATH(overrides = {}) {
    const athTimestamp = new Date(Date.now() - 86400000);
    return createMockToken({
        athPrice: '50000000000000',
        athPriceTimestamp: athTimestamp,
        athMarketCap: '50000000000000000000000',
        athMarketCapTimestamp: athTimestamp,
        ...overrides,
    });
}
function createTrendingToken(overrides = {}) {
    return createMockToken({
        marketCap: '500000000000000000000000',
        currentPrice: '500000000000000',
        realNative: '100000000000000000000000',
        realToken: '200000000000000000000000000',
        ...overrides,
    });
}
function resetTokenCounter() {
    tokenCounter = 0;
}
//# sourceMappingURL=token.factory.js.map