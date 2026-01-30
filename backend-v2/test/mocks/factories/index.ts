/**
 * Test Data Factories - Central Export
 */

// Token factory
export {
  createMockToken,
  createMockTokens,
  createGraduatedToken,
  createListedToken,
  createTokenWithATH,
  createTrendingToken,
  resetTokenCounter,
  type MockToken,
  type TokenStatus,
} from './token.factory';

// Trade factory
export {
  createMockTrade,
  createMockBuyTrade,
  createMockSellTrade,
  createMockTrades,
  createWhaleBuyTrade,
  createSmallBuyTrade,
  createTradesForCandles,
  resetTradeCounter,
  type MockTrade,
  type TradeType,
} from './trade.factory';

// Holder factory
export {
  createMockHolder,
  createMockHolders,
  createWhaleHolder,
  createSmallHolder,
  createZeroBalanceHolder,
  createCreatorAsHolder,
  createHolderDistribution,
  resetHolderCounter,
  createMockUserPortfolio,
  createProfitablePortfolio,
  createLosingPortfolio,
  createMockPriceHistory,
  createMockPriceHistorySeries,
  type MockHolder,
  type MockUserPortfolio,
  type MockPriceHistory,
} from './holder.factory';

/**
 * Reset all counters between test suites
 */
export function resetAllFactories(): void {
  const { resetTokenCounter } = require('./token.factory');
  const { resetTradeCounter } = require('./trade.factory');
  const { resetHolderCounter } = require('./holder.factory');

  resetTokenCounter();
  resetTradeCounter();
  resetHolderCounter();
}
