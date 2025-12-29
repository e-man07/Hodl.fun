// Event Handlers
export { TokenCreatedEventHandler } from './token-created.event-handler';
export { TokenMetricsUpdatedEventHandler } from './token-metrics-updated.event-handler';
export { TokenLockedEventHandler } from './token-locked.event-handler';
export { TokenListedEventHandler } from './token-listed.event-handler';
export { NewATHPriceEventHandler } from './new-ath-price.event-handler';
export { NewATHMarketCapEventHandler } from './new-ath-market-cap.event-handler';

// Import handlers as array for module registration
import { TokenCreatedEventHandler } from './token-created.event-handler';
import { TokenMetricsUpdatedEventHandler } from './token-metrics-updated.event-handler';
import { TokenLockedEventHandler } from './token-locked.event-handler';
import { TokenListedEventHandler } from './token-listed.event-handler';
import { NewATHPriceEventHandler } from './new-ath-price.event-handler';
import { NewATHMarketCapEventHandler } from './new-ath-market-cap.event-handler';

export const TOKEN_EVENT_HANDLERS = [
  TokenCreatedEventHandler,
  TokenMetricsUpdatedEventHandler,
  TokenLockedEventHandler,
  TokenListedEventHandler,
  NewATHPriceEventHandler,
  NewATHMarketCapEventHandler,
];
