import { io, Socket } from 'socket.io-client';
import type {
  TokenUpdateEvent,
  PriceUpdateEvent,
  GraduationEvent,
  AthEvent,
  TokenTrade,
} from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

// Socket instances for different namespaces
let eventsSocket: Socket | null = null;
let tradesSocket: Socket | null = null;

/**
 * Get or create socket connection for events namespace
 */
export function getEventsSocket(): Socket {
  if (!eventsSocket) {
    eventsSocket = io(`${WS_URL}/events`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    eventsSocket.on('connect', () => {
      console.log('[WS] Events connected');
    });

    eventsSocket.on('disconnect', (reason) => {
      console.log('[WS] Events disconnected:', reason);
    });

    eventsSocket.on('connect_error', (error) => {
      console.error('[WS] Events connection error:', error);
    });
  }

  return eventsSocket;
}

/**
 * Get or create socket connection for trades namespace
 */
export function getTradesSocket(): Socket {
  if (!tradesSocket) {
    tradesSocket = io(`${WS_URL}/trades`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    tradesSocket.on('connect', () => {
      console.log('[WS] Trades connected');
    });

    tradesSocket.on('disconnect', (reason) => {
      console.log('[WS] Trades disconnected:', reason);
    });

    tradesSocket.on('connect_error', (error) => {
      console.error('[WS] Trades connection error:', error);
    });
  }

  return tradesSocket;
}

/**
 * Subscribe to token updates
 */
export function subscribeToToken(
  tokenAddress: string,
  callbacks: {
    onPriceUpdate?: (data: PriceUpdateEvent) => void;
    onTokenUpdate?: (data: TokenUpdateEvent) => void;
    onGraduation?: (data: GraduationEvent) => void;
    onAthPrice?: (data: AthEvent) => void;
    onAthMarketCap?: (data: AthEvent) => void;
  }
): () => void {
  const socket = getEventsSocket();

  socket.emit('subscribe:token', { tokenAddress });

  if (callbacks.onPriceUpdate) {
    socket.on('price_update', callbacks.onPriceUpdate);
  }
  if (callbacks.onTokenUpdate) {
    socket.on('token_updated', callbacks.onTokenUpdate);
  }
  if (callbacks.onGraduation) {
    socket.on('graduation', callbacks.onGraduation);
  }
  if (callbacks.onAthPrice) {
    socket.on('ath_price', callbacks.onAthPrice);
  }
  if (callbacks.onAthMarketCap) {
    socket.on('ath_marketcap', callbacks.onAthMarketCap);
  }

  // Return cleanup function
  return () => {
    socket.emit('unsubscribe:token', { tokenAddress });
    if (callbacks.onPriceUpdate) socket.off('price_update', callbacks.onPriceUpdate);
    if (callbacks.onTokenUpdate) socket.off('token_updated', callbacks.onTokenUpdate);
    if (callbacks.onGraduation) socket.off('graduation', callbacks.onGraduation);
    if (callbacks.onAthPrice) socket.off('ath_price', callbacks.onAthPrice);
    if (callbacks.onAthMarketCap) socket.off('ath_marketcap', callbacks.onAthMarketCap);
  };
}

/**
 * Subscribe to wallet activity
 */
export function subscribeToWallet(
  walletAddress: string,
  callbacks: {
    onTokenUpdate?: (data: TokenUpdateEvent) => void;
  }
): () => void {
  const socket = getEventsSocket();

  socket.emit('subscribe:wallet', { walletAddress });

  if (callbacks.onTokenUpdate) {
    socket.on('token_updated', callbacks.onTokenUpdate);
  }

  return () => {
    socket.emit('unsubscribe:wallet', { walletAddress });
    if (callbacks.onTokenUpdate) socket.off('token_updated', callbacks.onTokenUpdate);
  };
}

/**
 * Subscribe to live trades for a token
 */
export function subscribeToTrades(
  tokenAddress: string,
  callbacks: {
    onRecentTrades?: (data: { trades: TokenTrade[] }) => void;
    onNewTrade?: (trade: TokenTrade) => void;
  }
): () => void {
  const socket = getTradesSocket();

  socket.emit('subscribe:recent', { tokenAddress });

  if (callbacks.onRecentTrades) {
    socket.on('recent_trades', callbacks.onRecentTrades);
  }
  if (callbacks.onNewTrade) {
    socket.on('new_trade', callbacks.onNewTrade);
  }

  return () => {
    socket.emit('unsubscribe:recent', { tokenAddress });
    if (callbacks.onRecentTrades) socket.off('recent_trades', callbacks.onRecentTrades);
    if (callbacks.onNewTrade) socket.off('new_trade', callbacks.onNewTrade);
  };
}

/**
 * Disconnect all sockets
 */
export function disconnectAll(): void {
  if (eventsSocket) {
    eventsSocket.disconnect();
    eventsSocket = null;
  }
  if (tradesSocket) {
    tradesSocket.disconnect();
    tradesSocket = null;
  }
}
