/**
 * Constants module providing centralized definitions for:
 * - PubSub channel names
 * - WebSocket events and rooms
 * - Redis key patterns
 * - Cache TTL values
 *
 * Using these constants instead of magic strings ensures:
 * - Type safety with TypeScript
 * - Single source of truth
 * - Easier refactoring
 * - Better IDE autocomplete
 */

export { PUBSUB_CHANNELS, type PubSubChannel } from './pubsub.constants';

export {
  WS_EVENTS,
  WS_ROOMS,
  WS_NAMESPACES,
  type WsEvent,
  type WsNamespace,
} from './websocket.constants';

export { REDIS_KEYS, CACHE_TTL, type CacheTTL } from './redis.constants';
