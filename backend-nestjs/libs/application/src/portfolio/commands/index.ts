// Commands
export { RecordPortfolioTradeCommand } from './record-portfolio-trade.command';

// Handlers
export { RecordPortfolioTradeHandler } from './handlers/record-portfolio-trade.handler';

// Import handlers as array
import { RecordPortfolioTradeHandler } from './handlers/record-portfolio-trade.handler';

export const PORTFOLIO_COMMAND_HANDLERS = [RecordPortfolioTradeHandler];
