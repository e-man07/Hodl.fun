/**
 * PubSub channel names for Redis pub/sub communication between services.
 * These channels are used by the indexer to publish events and by the
 * WebSocket service to broadcast real-time updates to clients.
 */
export const PUBSUB_CHANNELS = Object.freeze({
  /** Published when a trade (buy/sell) occurs on a token */
  TRADE: 'trade',

  /** Published when a new token is created via the factory */
  TOKEN_CREATED: 'token_created',

  /** Published when a token's price changes significantly */
  PRICE_UPDATE: 'price_update',

  /** Published when a token reaches graduation threshold */
  GRADUATION: 'graduation',

  /** Published when a token is listed on DEX after graduation */
  LISTING: 'listing',

  /** Published when a user's portfolio value changes */
  PORTFOLIO_UPDATE: 'portfolio_update',
} as const);

export type PubSubChannel = (typeof PUBSUB_CHANNELS)[keyof typeof PUBSUB_CHANNELS];
