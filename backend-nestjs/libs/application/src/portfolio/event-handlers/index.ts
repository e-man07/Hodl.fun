// Event Handlers
export { PortfolioBalanceUpdatedEventHandler } from './portfolio-balance-updated.event-handler';

// Import handlers as array for module registration
import { PortfolioBalanceUpdatedEventHandler } from './portfolio-balance-updated.event-handler';

export const PORTFOLIO_EVENT_HANDLERS = [PortfolioBalanceUpdatedEventHandler];
