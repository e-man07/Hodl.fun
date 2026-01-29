import {
  // PubSub channels
  PUBSUB_CHANNELS,
  // WebSocket events
  WS_EVENTS,
  // WebSocket rooms
  WS_ROOMS,
  // Redis key patterns
  REDIS_KEYS,
  // Cache TTL values
  CACHE_TTL,
} from '../../constants';

describe('Constants', () => {
  describe('PUBSUB_CHANNELS', () => {
    it('should define all PubSub channel names', () => {
      expect(PUBSUB_CHANNELS.TRADE).toBe('trade');
      expect(PUBSUB_CHANNELS.TOKEN_CREATED).toBe('token_created');
      expect(PUBSUB_CHANNELS.PRICE_UPDATE).toBe('price_update');
      expect(PUBSUB_CHANNELS.GRADUATION).toBe('graduation');
      expect(PUBSUB_CHANNELS.LISTING).toBe('listing');
      expect(PUBSUB_CHANNELS.PORTFOLIO_UPDATE).toBe('portfolio_update');
    });

    it('should be immutable (frozen)', () => {
      expect(Object.isFrozen(PUBSUB_CHANNELS)).toBe(true);
    });
  });

  describe('WS_EVENTS', () => {
    it('should define WebSocket event names for emitting', () => {
      expect(WS_EVENTS.TRADE).toBe('trade');
      expect(WS_EVENTS.NEW_TRADE).toBe('new_trade');
      expect(WS_EVENTS.RECENT_TRADES).toBe('recent_trades');
      expect(WS_EVENTS.MY_TRADE).toBe('my_trade');
      expect(WS_EVENTS.TOKEN_CREATED).toBe('token_created');
      expect(WS_EVENTS.PRICE_UPDATE).toBe('price_update');
      expect(WS_EVENTS.GRADUATION).toBe('graduation');
      expect(WS_EVENTS.LISTING).toBe('listing');
      expect(WS_EVENTS.PORTFOLIO_UPDATE).toBe('portfolio_update');
    });

    it('should define WebSocket subscription event names', () => {
      expect(WS_EVENTS.SUBSCRIBE_TOKEN).toBe('subscribe:token');
      expect(WS_EVENTS.UNSUBSCRIBE_TOKEN).toBe('unsubscribe:token');
      expect(WS_EVENTS.SUBSCRIBE_WALLET).toBe('subscribe:wallet');
      expect(WS_EVENTS.UNSUBSCRIBE_WALLET).toBe('unsubscribe:wallet');
      expect(WS_EVENTS.SUBSCRIBE_RECENT).toBe('subscribe:recent');
      expect(WS_EVENTS.UNSUBSCRIBE_RECENT).toBe('unsubscribe:recent');
    });

    it('should be immutable (frozen)', () => {
      expect(Object.isFrozen(WS_EVENTS)).toBe(true);
    });
  });

  describe('WS_ROOMS', () => {
    it('should define static room names', () => {
      expect(WS_ROOMS.GLOBAL).toBe('global');
    });

    it('should provide helper functions for dynamic room names', () => {
      expect(WS_ROOMS.token('0xABC123')).toBe('token:0xabc123');
      expect(WS_ROOMS.wallet('0xDEF456')).toBe('wallet:0xdef456');
      expect(WS_ROOMS.trades('0xGHI789')).toBe('trades:0xghi789');
    });

    it('should lowercase addresses in room names', () => {
      expect(WS_ROOMS.token('0xABCDEF')).toBe('token:0xabcdef');
      expect(WS_ROOMS.wallet('0xABCDEF')).toBe('wallet:0xabcdef');
      expect(WS_ROOMS.trades('0xABCDEF')).toBe('trades:0xabcdef');
    });
  });

  describe('REDIS_KEYS', () => {
    it('should provide helper functions for token keys', () => {
      expect(REDIS_KEYS.token('0xABC123')).toBe('token:0xabc123');
      expect(REDIS_KEYS.tokenList()).toBe('tokens:list');
      expect(REDIS_KEYS.tokenTrending()).toBe('tokens:trending');
      expect(REDIS_KEYS.tokenNew()).toBe('tokens:new');
    });

    it('should provide helper functions for user keys', () => {
      expect(REDIS_KEYS.user('0xABC123')).toBe('user:0xabc123');
      expect(REDIS_KEYS.userPortfolio('0xABC123')).toBe('user:0xabc123:portfolio');
      expect(REDIS_KEYS.userHoldings('0xABC123')).toBe('user:0xabc123:holdings');
      expect(REDIS_KEYS.userTrades('0xABC123')).toBe('user:0xabc123:trades');
    });

    it('should provide helper functions for holder keys', () => {
      expect(REDIS_KEYS.tokenHolders('0xABC123')).toBe('token:0xabc123:holders');
    });

    it('should provide helper functions for candle keys', () => {
      expect(REDIS_KEYS.candles('0xABC123', '1h')).toBe('candles:0xabc123:1h');
    });

    it('should provide helper functions for nonce keys', () => {
      expect(REDIS_KEYS.authNonce('0xABC123')).toBe('auth:nonce:0xabc123');
    });

    it('should provide helper functions for rate limiting', () => {
      expect(REDIS_KEYS.rateLimit('0xABC123', 'api')).toBe('ratelimit:0xabc123:api');
    });

    it('should provide pattern for cache invalidation', () => {
      expect(REDIS_KEYS.PATTERNS.ALL_TOKENS).toBe('token:*');
      expect(REDIS_KEYS.PATTERNS.ALL_USERS).toBe('user:*');
      expect(REDIS_KEYS.PATTERNS.ALL_CANDLES).toBe('candles:*');
    });

    it('should lowercase addresses in keys', () => {
      expect(REDIS_KEYS.token('0xABCDEF')).toBe('token:0xabcdef');
      expect(REDIS_KEYS.user('0xABCDEF')).toBe('user:0xabcdef');
    });
  });

  describe('CACHE_TTL', () => {
    it('should define TTL values in seconds', () => {
      expect(CACHE_TTL.TOKEN).toBe(60); // 1 minute
      expect(CACHE_TTL.TOKEN_LIST).toBe(30); // 30 seconds
      expect(CACHE_TTL.USER_PORTFOLIO).toBe(60); // 1 minute
      expect(CACHE_TTL.PRICE_HISTORY).toBe(300); // 5 minutes
      expect(CACHE_TTL.NONCE).toBe(300); // 5 minutes
      expect(CACHE_TTL.TRENDING).toBe(60); // 1 minute
    });

    it('should be immutable (frozen)', () => {
      expect(Object.isFrozen(CACHE_TTL)).toBe(true);
    });
  });
});
