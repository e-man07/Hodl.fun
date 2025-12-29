import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

/**
 * Market WebSocket Gateway
 *
 * Provides real-time updates for token prices, trades, and market events
 */
@WebSocketGateway({
  namespace: 'market',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class MarketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private connectedClients = new Map<string, Set<string>>();

  /**
   * Handle client connection
   */
  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, new Set());
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * Subscribe to token price updates
   *
   * Client event: subscribe:token
   * Server event: token:price-updated
   */
  @SubscribeMessage('subscribe:token')
  handleSubscribeToken(
    client: Socket,
    payload: { tokenAddress: string },
  ): void {
    const { tokenAddress } = payload;

    if (!tokenAddress) {
      client.emit('error', { message: 'Token address is required' });
      return;
    }

    const key = `token:${tokenAddress}`;
    const subscriptions = this.connectedClients.get(client.id);

    if (subscriptions) {
      subscriptions.add(key);
      client.join(key);
      client.emit('subscribed', {
        type: 'token',
        tokenAddress,
        message: `Subscribed to price updates for ${tokenAddress}`,
      });
    }
  }

  /**
   * Unsubscribe from token price updates
   *
   * Client event: unsubscribe:token
   */
  @SubscribeMessage('unsubscribe:token')
  handleUnsubscribeToken(
    client: Socket,
    payload: { tokenAddress: string },
  ): void {
    const { tokenAddress } = payload;
    const key = `token:${tokenAddress}`;

    const subscriptions = this.connectedClients.get(client.id);
    if (subscriptions) {
      subscriptions.delete(key);
      client.leave(key);
    }
  }

  /**
   * Subscribe to portfolio updates
   *
   * Client event: subscribe:portfolio
   * Server event: portfolio:updated
   */
  @SubscribeMessage('subscribe:portfolio')
  handleSubscribePortfolio(
    client: Socket,
    payload: { userId: string },
  ): void {
    const { userId } = payload;

    if (!userId) {
      client.emit('error', { message: 'User ID is required' });
      return;
    }

    const key = `portfolio:${userId}`;
    const subscriptions = this.connectedClients.get(client.id);

    if (subscriptions) {
      subscriptions.add(key);
      client.join(key);
      client.emit('subscribed', {
        type: 'portfolio',
        userId,
        message: `Subscribed to portfolio updates for ${userId}`,
      });
    }
  }

  /**
   * Unsubscribe from portfolio updates
   *
   * Client event: unsubscribe:portfolio
   */
  @SubscribeMessage('unsubscribe:portfolio')
  handleUnsubscribePortfolio(
    client: Socket,
    payload: { userId: string },
  ): void {
    const { userId } = payload;
    const key = `portfolio:${userId}`;

    const subscriptions = this.connectedClients.get(client.id);
    if (subscriptions) {
      subscriptions.delete(key);
      client.leave(key);
    }
  }

  /**
   * Subscribe to trade stream
   *
   * Client event: subscribe:trades
   * Server event: trade:executed
   */
  @SubscribeMessage('subscribe:trades')
  handleSubscribeTrades(client: Socket, payload: { tokenAddress?: string }): void {
    const { tokenAddress } = payload;

    const key = tokenAddress ? `trades:${tokenAddress}` : 'trades:all';
    const subscriptions = this.connectedClients.get(client.id);

    if (subscriptions) {
      subscriptions.add(key);
      client.join(key);
      client.emit('subscribed', {
        type: 'trades',
        tokenAddress: tokenAddress || 'all',
        message: `Subscribed to trade stream${tokenAddress ? ` for ${tokenAddress}` : ''}`,
      });
    }
  }

  /**
   * Unsubscribe from trade stream
   *
   * Client event: unsubscribe:trades
   */
  @SubscribeMessage('unsubscribe:trades')
  handleUnsubscribeTrades(client: Socket, payload: { tokenAddress?: string }): void {
    const { tokenAddress } = payload;
    const key = tokenAddress ? `trades:${tokenAddress}` : 'trades:all';

    const subscriptions = this.connectedClients.get(client.id);
    if (subscriptions) {
      subscriptions.delete(key);
      client.leave(key);
    }
  }

  /**
   * Emit price update to subscribed clients
   */
  emitPriceUpdate(
    tokenAddress: string,
    data: {
      price: string;
      priceChange24h: number;
      marketCap: string;
      volume24h: string;
      timestamp: Date;
    },
  ): void {
    this.server.to(`token:${tokenAddress}`).emit('token:price-updated', {
      tokenAddress,
      ...data,
    });
  }

  /**
   * Emit portfolio update to user
   */
  emitPortfolioUpdate(
    userId: string,
    data: {
      totalValue: string;
      totalPNL: string;
      realizedPNL: string;
      unrealizedPNL: string;
      timestamp: Date;
    },
  ): void {
    this.server.to(`portfolio:${userId}`).emit('portfolio:updated', {
      userId,
      ...data,
    });
  }

  /**
   * Emit trade execution event
   */
  emitTradeExecuted(
    data: {
      tokenAddress: string;
      type: 'buy' | 'sell';
      user: string;
      amountIn: string;
      amountOut: string;
      pricePerToken: string;
      totalValue: string;
      timestamp: Date;
    },
  ): void {
    this.server.to(`trades:${data.tokenAddress}`).emit('trade:executed', data);
    this.server.to('trades:all').emit('trade:executed', data);
  }

  /**
   * Broadcast market event to all connected clients
   */
  broadcastMarketEvent(eventType: string, data: any): void {
    this.server.emit(`market:${eventType}`, {
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get subscriptions for a specific client
   */
  getClientSubscriptions(clientId: string): string[] {
    const subscriptions = this.connectedClients.get(clientId);
    return subscriptions ? Array.from(subscriptions) : [];
  }
}
