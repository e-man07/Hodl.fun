// Repository implementations
export { TokenRepository } from './token.repository';
export { TradeRepository } from './trade.repository';
export { PortfolioRepository } from './portfolio.repository';

// Provider array for module registration
import { TokenRepository } from './token.repository';
import { TradeRepository } from './trade.repository';
import { PortfolioRepository } from './portfolio.repository';

import {
  TOKEN_REPOSITORY,
  TRADE_REPOSITORY,
  PORTFOLIO_REPOSITORY,
} from '@domain';

export const REPOSITORY_PROVIDERS = [
  {
    provide: TOKEN_REPOSITORY,
    useClass: TokenRepository,
  },
  {
    provide: TRADE_REPOSITORY,
    useClass: TradeRepository,
  },
  {
    provide: PORTFOLIO_REPOSITORY,
    useClass: PortfolioRepository,
  },
];
