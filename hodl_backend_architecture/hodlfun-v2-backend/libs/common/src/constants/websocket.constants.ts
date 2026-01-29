/**
 * WebSocket event names for real-time client communication.
 * Events are categorized into:
 * - Broadcast events: emitted by server to clients
 * - Subscription events: sent by clients to manage subscriptions
 */
export const WS_EVENTS = Object.freeze({
  // Broadcast events (server -> client)
  /** Trade event for a specific token room */
  TRADE: 'trade',

  /** New trade event for the trades feed */
  NEW_TRADE: 'new_trade',

  /** Initial trades snapshot when subscribing */
  RECENT_TRADES: 'recent_trades',

  /** Trade event for the trader's personal wallet room */
  MY_TRADE: 'my_trade',

  /** New token created event (global broadcast) */
  TOKEN_CREATED: 'token_created',

  /** Price update event for a specific token */
  PRICE_UPDATE: 'price_update',

  /** Token graduation event */
  GRADUATION: 'graduation',

  /** Token DEX listing event */
  LISTING: 'listing',

  /** Portfolio value update for a wallet */
  PORTFOLIO_UPDATE: 'portfolio_update',

  // Subscription events (client -> server)
  /** Subscribe to a specific token's events */
  SUBSCRIBE_TOKEN: 'subscribe:token',

  /** Unsubscribe from a specific token's events */
  UNSUBSCRIBE_TOKEN: 'unsubscribe:token',

  /** Subscribe to wallet-specific events */
  SUBSCRIBE_WALLET: 'subscribe:wallet',

  /** Unsubscribe from wallet-specific events */
  UNSUBSCRIBE_WALLET: 'unsubscribe:wallet',

  /** Subscribe to recent trades feed for a token */
  SUBSCRIBE_RECENT: 'subscribe:recent',

  /** Unsubscribe from recent trades feed */
  UNSUBSCRIBE_RECENT: 'unsubscribe:recent',
} as const);

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

/**
 * WebSocket room naming conventions.
 * Rooms are used to group clients for targeted event broadcasting.
 */
export const WS_ROOMS = {
  /** Global room that all clients join automatically */
  GLOBAL: 'global',

  /**
   * Create a token-specific room name
   * @param tokenAddress - The token contract address
   * @returns Room name in format `token:<address>`
   */
  token: (tokenAddress: string): string => `token:${tokenAddress.toLowerCase()}`,

  /**
   * Create a wallet-specific room name
   * @param walletAddress - The user's wallet address
   * @returns Room name in format `wallet:<address>`
   */
  wallet: (walletAddress: string): string => `wallet:${walletAddress.toLowerCase()}`,

  /**
   * Create a trades room name for a token
   * @param tokenAddress - The token contract address
   * @returns Room name in format `trades:<address>`
   */
  trades: (tokenAddress: string): string => `trades:${tokenAddress.toLowerCase()}`,
} as const;

/**
 * WebSocket namespace paths
 */
export const WS_NAMESPACES = Object.freeze({
  /** Events namespace for token/wallet subscriptions */
  EVENTS: '/events',

  /** Trades namespace for trade feeds */
  TRADES: '/trades',
} as const);

export type WsNamespace = (typeof WS_NAMESPACES)[keyof typeof WS_NAMESPACES];
