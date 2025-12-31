// Query classes
export { GetTradesByTokenQuery } from './get-trades-by-token.query';
export { GetTradesByUserQuery } from './get-trades-by-user.query';
export { GetTradeStatsQuery } from './get-trade-stats.query';

// Handler classes
import { GetTradesByTokenHandler } from './handlers/get-trades-by-token.handler';
import { GetTradesByUserHandler } from './handlers/get-trades-by-user.handler';
import { GetTradeStatsHandler } from './handlers/get-trade-stats.handler';

export { GetTradesByTokenHandler } from './handlers/get-trades-by-token.handler';
export { GetTradesByUserHandler } from './handlers/get-trades-by-user.handler';
export { GetTradeStatsHandler, TradeStatsResult } from './handlers/get-trade-stats.handler';

/**
 * All Trade Query Handlers for module registration
 */
export const TRADE_QUERY_HANDLERS = [
  GetTradesByTokenHandler,
  GetTradesByUserHandler,
  GetTradeStatsHandler,
];
