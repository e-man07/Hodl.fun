/**
 * Live E2E Test WebSocket Client
 * Client for testing real-time WebSocket events
 */
import { io, Socket } from 'socket.io-client';
import { SERVICE_URLS, WEBSOCKET_EVENTS, TIMEOUTS, testLog } from './config';

// Types for WebSocket events
export interface TradeEvent {
  tokenAddress: string;
  type: 'BUY' | 'SELL';
  traderAddress: string;
  amountIn: string;
  amountOut: string;
  price: string;
  txHash: string;
  timestamp: string;
}

export interface PriceUpdateEvent {
  tokenAddress: string;
  price: string;
  marketCap: string;
  timestamp: string;
}

export interface TokenCreatedEvent {
  address: string;
  name: string;
  symbol: string;
  creatorAddress: string;
  curveAddress: string;
}

export interface RecentTradesEvent {
  trades: TradeEvent[];
}

// Event collector for testing
export interface EventCollector<T> {
  events: T[];
  waitForEvent: (timeoutMs?: number) => Promise<T>;
  waitForEvents: (count: number, timeoutMs?: number) => Promise<T[]>;
  clear: () => void;
}

// WebSocket client instance
let socket: Socket | null = null;
let eventsSocket: Socket | null = null;
let tradesSocket: Socket | null = null;

// Event collectors
const eventCollectors: Map<string, EventCollector<unknown>> = new Map();

/**
 * Create an event collector
 */
function createEventCollector<T>(): EventCollector<T> {
  const events: T[] = [];
  const waiters: Array<{ resolve: (value: T) => void; reject: (reason: Error) => void }> = [];

  return {
    events,

    waitForEvent(timeoutMs = TIMEOUTS.websocketEvent): Promise<T> {
      // Check if we already have an event
      if (events.length > 0) {
        return Promise.resolve(events.shift()!);
      }

      // Wait for next event
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = waiters.findIndex((w) => w.resolve === resolve);
          if (index !== -1) {
            waiters.splice(index, 1);
          }
          reject(new Error(`Timeout waiting for WebSocket event after ${timeoutMs}ms`));
        }, timeoutMs);

        waiters.push({
          resolve: (value: T) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject,
        });
      });
    },

    waitForEvents(count: number, timeoutMs = TIMEOUTS.websocketEvent): Promise<T[]> {
      return new Promise((resolve, reject) => {
        const collectedEvents: T[] = [];
        const startTime = Date.now();

        const checkEvents = () => {
          while (events.length > 0 && collectedEvents.length < count) {
            collectedEvents.push(events.shift()!);
          }

          if (collectedEvents.length >= count) {
            resolve(collectedEvents);
            return;
          }

          if (Date.now() - startTime >= timeoutMs) {
            reject(
              new Error(
                `Timeout: Only received ${collectedEvents.length}/${count} events after ${timeoutMs}ms`,
              ),
            );
            return;
          }

          setTimeout(checkEvents, 100);
        };

        checkEvents();
      });
    },

    clear() {
      events.length = 0;
    },
  };
}

/**
 * Add event to collector and notify waiters
 */
function addEventToCollector<T>(collectorName: string, event: T): void {
  let collector = eventCollectors.get(collectorName) as EventCollector<T> | undefined;
  if (!collector) {
    collector = createEventCollector<T>();
    eventCollectors.set(collectorName, collector as EventCollector<unknown>);
  }
  collector.events.push(event);
}

/**
 * Get or create event collector
 */
export function getEventCollector<T>(name: string): EventCollector<T> {
  let collector = eventCollectors.get(name) as EventCollector<T> | undefined;
  if (!collector) {
    collector = createEventCollector<T>();
    eventCollectors.set(name, collector as EventCollector<unknown>);
  }
  return collector;
}

/**
 * Connect to the main WebSocket namespace
 */
export function connectMainSocket(): Socket {
  if (!socket) {
    socket = io(SERVICE_URLS.websocket, {
      transports: ['websocket'],
      timeout: TIMEOUTS.websocketEvent,
    });

    socket.on('connect', () => {
      testLog('Main WebSocket connected', { id: socket?.id });
    });

    socket.on('disconnect', (reason) => {
      testLog('Main WebSocket disconnected', { reason });
    });

    socket.on('error', (error) => {
      testLog('Main WebSocket error', { error });
    });

    // Listen for common events
    socket.on(WEBSOCKET_EVENTS.trade, (data: TradeEvent) => {
      testLog('Trade event received', data);
      addEventToCollector('trade', data);
    });

    socket.on(WEBSOCKET_EVENTS.priceUpdate, (data: PriceUpdateEvent) => {
      testLog('Price update event received', data);
      addEventToCollector('price_update', data);
    });

    socket.on(WEBSOCKET_EVENTS.tokenCreated, (data: TokenCreatedEvent) => {
      testLog('Token created event received', data);
      addEventToCollector('token_created', data);
    });
  }

  return socket;
}

/**
 * Connect to the events namespace
 */
export function connectEventsSocket(): Socket {
  if (!eventsSocket) {
    eventsSocket = io(`${SERVICE_URLS.websocket}/events`, {
      transports: ['websocket'],
      timeout: TIMEOUTS.websocketEvent,
    });

    eventsSocket.on('connect', () => {
      testLog('Events WebSocket connected', { id: eventsSocket?.id });
    });

    eventsSocket.on('disconnect', (reason) => {
      testLog('Events WebSocket disconnected', { reason });
    });

    // Listen for events
    eventsSocket.on(WEBSOCKET_EVENTS.trade, (data: TradeEvent) => {
      testLog('Events namespace: Trade event', data);
      addEventToCollector('events:trade', data);
    });

    eventsSocket.on(WEBSOCKET_EVENTS.priceUpdate, (data: PriceUpdateEvent) => {
      testLog('Events namespace: Price update', data);
      addEventToCollector('events:price_update', data);
    });

    eventsSocket.on(WEBSOCKET_EVENTS.tokenCreated, (data: TokenCreatedEvent) => {
      testLog('Events namespace: Token created', data);
      addEventToCollector('events:token_created', data);
    });
  }

  return eventsSocket;
}

/**
 * Connect to the trades namespace
 */
export function connectTradesSocket(): Socket {
  if (!tradesSocket) {
    tradesSocket = io(`${SERVICE_URLS.websocket}/trades`, {
      transports: ['websocket'],
      timeout: TIMEOUTS.websocketEvent,
    });

    tradesSocket.on('connect', () => {
      testLog('Trades WebSocket connected', { id: tradesSocket?.id });
    });

    tradesSocket.on('disconnect', (reason) => {
      testLog('Trades WebSocket disconnected', { reason });
    });

    tradesSocket.on(WEBSOCKET_EVENTS.newTrade, (data: TradeEvent) => {
      testLog('Trades namespace: New trade', data);
      addEventToCollector('trades:new_trade', data);
    });

    tradesSocket.on(WEBSOCKET_EVENTS.recentTrades, (data: RecentTradesEvent) => {
      testLog('Trades namespace: Recent trades', { count: data.trades?.length });
      addEventToCollector('trades:recent', data);
    });
  }

  return tradesSocket;
}

/**
 * Subscribe to token updates
 */
export function subscribeToToken(tokenAddress: string): void {
  const eventsSocketInst = connectEventsSocket();
  eventsSocketInst.emit(WEBSOCKET_EVENTS.subscribeToken, { tokenAddress: tokenAddress.toLowerCase() });
  testLog('Subscribed to token', { tokenAddress });
}

/**
 * Unsubscribe from token updates
 */
export function unsubscribeFromToken(tokenAddress: string): void {
  const eventsSocketInst = connectEventsSocket();
  eventsSocketInst.emit(WEBSOCKET_EVENTS.unsubscribeToken, { tokenAddress: tokenAddress.toLowerCase() });
  testLog('Unsubscribed from token', { tokenAddress });
}

/**
 * Subscribe to wallet updates
 */
export function subscribeToWallet(walletAddress: string): void {
  const eventsSocketInst = connectEventsSocket();
  eventsSocketInst.emit(WEBSOCKET_EVENTS.subscribeWallet, { walletAddress: walletAddress.toLowerCase() });
  testLog('Subscribed to wallet', { walletAddress });
}

/**
 * Unsubscribe from wallet updates
 */
export function unsubscribeFromWallet(walletAddress: string): void {
  const eventsSocketInst = connectEventsSocket();
  eventsSocketInst.emit(WEBSOCKET_EVENTS.unsubscribeWallet, { walletAddress: walletAddress.toLowerCase() });
  testLog('Unsubscribed from wallet', { walletAddress });
}

/**
 * Subscribe to recent trades for a token
 */
export function subscribeToRecentTrades(tokenAddress: string): void {
  const tradesSocketInstance = connectTradesSocket();
  tradesSocketInstance.emit(WEBSOCKET_EVENTS.subscribeRecent, {
    tokenAddress: tokenAddress.toLowerCase(),
  });
  testLog('Subscribed to recent trades', { tokenAddress });
}

/**
 * Unsubscribe from recent trades
 */
export function unsubscribeFromRecentTrades(tokenAddress: string): void {
  const tradesSocketInstance = connectTradesSocket();
  tradesSocketInstance.emit(WEBSOCKET_EVENTS.unsubscribeRecent, {
    tokenAddress: tokenAddress.toLowerCase(),
  });
  testLog('Unsubscribed from recent trades', { tokenAddress });
}

/**
 * Wait for connection to be established
 */
export function waitForConnection(socketInstance: Socket, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socketInstance.connected) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error(`WebSocket connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    socketInstance.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    socketInstance.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket connection error: ${error.message}`));
    });
  });
}

/**
 * Wait for trade event
 */
export async function waitForTradeEvent(timeoutMs = TIMEOUTS.websocketEvent): Promise<TradeEvent> {
  const collector = getEventCollector<TradeEvent>('trade');
  return collector.waitForEvent(timeoutMs);
}

/**
 * Wait for price update event
 */
export async function waitForPriceUpdateEvent(
  timeoutMs = TIMEOUTS.websocketEvent,
): Promise<PriceUpdateEvent> {
  const collector = getEventCollector<PriceUpdateEvent>('price_update');
  return collector.waitForEvent(timeoutMs);
}

/**
 * Wait for token created event
 */
export async function waitForTokenCreatedEvent(
  timeoutMs = TIMEOUTS.websocketEvent,
): Promise<TokenCreatedEvent> {
  const collector = getEventCollector<TokenCreatedEvent>('token_created');
  return collector.waitForEvent(timeoutMs);
}

/**
 * Wait for trade event on /events namespace
 */
export async function waitForEventsNamespaceTradeEvent(
  timeoutMs = TIMEOUTS.websocketEvent,
): Promise<TradeEvent> {
  const collector = getEventCollector<TradeEvent>('events:trade');
  return collector.waitForEvent(timeoutMs);
}

/**
 * Wait for price update event on /events namespace
 */
export async function waitForEventsNamespacePriceUpdateEvent(
  timeoutMs = TIMEOUTS.websocketEvent,
): Promise<PriceUpdateEvent> {
  const collector = getEventCollector<PriceUpdateEvent>('events:price_update');
  return collector.waitForEvent(timeoutMs);
}

/**
 * Wait for new_trade event on /trades namespace
 */
export async function waitForTradesNamespaceNewTradeEvent(
  timeoutMs = TIMEOUTS.websocketEvent,
): Promise<TradeEvent> {
  const collector = getEventCollector<TradeEvent>('trades:new_trade');
  return collector.waitForEvent(timeoutMs);
}

/**
 * Wait for recent_trades snapshot on /trades namespace
 */
export async function waitForTradesNamespaceRecentSnapshot(
  timeoutMs = TIMEOUTS.websocketEvent,
): Promise<RecentTradesEvent> {
  const collector = getEventCollector<RecentTradesEvent>('trades:recent');
  return collector.waitForEvent(timeoutMs);
}

/**
 * Wait for specific trade event (by token address)
 */
export async function waitForTradeEventForToken(
  tokenAddress: string,
  timeoutMs = TIMEOUTS.websocketEvent,
): Promise<TradeEvent> {
  const collector = getEventCollector<TradeEvent>('trade');
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const event = await collector.waitForEvent(Math.max(100, timeoutMs - (Date.now() - startTime)));
      if (event.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
        return event;
      }
      // Put back events that don't match
      collector.events.push(event);
    } catch {
      // Continue waiting
    }
  }

  throw new Error(`Timeout waiting for trade event for token ${tokenAddress}`);
}

/**
 * Get all collected events
 */
export function getCollectedEvents(): Map<string, unknown[]> {
  const result = new Map<string, unknown[]>();
  eventCollectors.forEach((collector, name) => {
    result.set(name, [...collector.events]);
  });
  return result;
}

/**
 * Clear all collected events
 */
export function clearAllEvents(): void {
  eventCollectors.forEach((collector) => collector.clear());
  testLog('All event collectors cleared');
}

/**
 * Get connection status
 */
export function getConnectionStatus(): {
  main: boolean;
  events: boolean;
  trades: boolean;
} {
  return {
    main: socket?.connected || false,
    events: eventsSocket?.connected || false,
    trades: tradesSocket?.connected || false,
  };
}

/**
 * Disconnect all sockets
 */
export function disconnectAll(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (eventsSocket) {
    eventsSocket.disconnect();
    eventsSocket = null;
  }
  if (tradesSocket) {
    tradesSocket.disconnect();
    tradesSocket = null;
  }

  // Clear event collectors
  eventCollectors.clear();

  testLog('All WebSocket connections closed');
}

/**
 * Cleanup WebSocket clients
 */
export function cleanupWebsocketClient(): void {
  disconnectAll();
  testLog('WebSocket client cleanup complete');
}
