// Commands
export { CreateTokenCommand } from './create-token.command';
export { BuyTokenCommand } from './buy-token.command';
export { SellTokenCommand } from './sell-token.command';
export { LockTokenCommand } from './lock-token.command';
export { ListOnUniswapCommand } from './list-on-uniswap.command';

// Handlers
export { CreateTokenHandler } from './handlers/create-token.handler';
export { BuyTokenHandler } from './handlers/buy-token.handler';
export { SellTokenHandler } from './handlers/sell-token.handler';
export { LockTokenHandler } from './handlers/lock-token.handler';
export { ListOnUniswapHandler } from './handlers/list-on-uniswap.handler';

// Import handlers as array
import { CreateTokenHandler } from './handlers/create-token.handler';
import { BuyTokenHandler } from './handlers/buy-token.handler';
import { SellTokenHandler } from './handlers/sell-token.handler';
import { LockTokenHandler } from './handlers/lock-token.handler';
import { ListOnUniswapHandler } from './handlers/list-on-uniswap.handler';

export const TOKEN_COMMAND_HANDLERS = [
  CreateTokenHandler,
  BuyTokenHandler,
  SellTokenHandler,
  LockTokenHandler,
  ListOnUniswapHandler,
];
