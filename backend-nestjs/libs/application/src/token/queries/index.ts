// Queries
export { GetTokenQuery } from './get-token.query';
export { GetTokensQuery } from './get-tokens.query';
export { GetTrendingTokensQuery } from './get-trending-tokens.query';
export { GetGraduationReadyTokensQuery } from './get-graduation-ready-tokens.query';

// Handlers
export { GetTokenHandler } from './handlers/get-token.handler';
export { GetTokensHandler } from './handlers/get-tokens.handler';
export { GetTrendingTokensHandler } from './handlers/get-trending-tokens.handler';
export { GetGraduationReadyTokensHandler } from './handlers/get-graduation-ready-tokens.handler';

// Import handlers as array
import { GetTokenHandler } from './handlers/get-token.handler';
import { GetTokensHandler } from './handlers/get-tokens.handler';
import { GetTrendingTokensHandler } from './handlers/get-trending-tokens.handler';
import { GetGraduationReadyTokensHandler } from './handlers/get-graduation-ready-tokens.handler';

export const TOKEN_QUERY_HANDLERS = [
  GetTokenHandler,
  GetTokensHandler,
  GetTrendingTokensHandler,
  GetGraduationReadyTokensHandler,
];
