// Queries
export { GetUserPortfolioQuery } from './get-user-portfolio.query';

// Handlers
export { GetUserPortfolioHandler } from './handlers/get-user-portfolio.handler';

// Import handlers as array
import { GetUserPortfolioHandler } from './handlers/get-user-portfolio.handler';

export const PORTFOLIO_QUERY_HANDLERS = [GetUserPortfolioHandler];
