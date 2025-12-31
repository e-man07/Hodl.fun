import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TokenMetricsUpdatedEvent,
  TokenCreatedEvent,
  TokenLockedEvent,
  TokenListedEvent,
  NewATHPriceEvent,
  NewATHMarketCapEvent,
  PortfolioBalanceUpdatedEvent,
} from '@domain';

/**
 * Market WebSocket Gateway
 *
 * Provides real-time updates for token prices, trades, and market events.
 * Listens to domain events and broadcasts them to subscribed WebSocket clients.
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
  private readonly logger = new Logger(MarketGateway.name);

  @WebSocketServer() server!: Server;

  private connectedClients = new Map<string, Set<string>>();

  /**
   * Handle client connection
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, new Set());
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
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
  broadcastMarketEvent(eventType: string, data: Record<string, unknown>): void {
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

  // === Domain Event Handlers ===

  /**
   * Handle TokenMetricsUpdatedEvent
   * Broadcasts price and market cap updates to subscribed clients
   */
  @OnEvent('token.metrics.updated')
  handleTokenMetricsUpdated(event: TokenMetricsUpdatedEvent): void {
    this.logger.debug(
      `Broadcasting metrics update for token ${event.tokenAddress}`,
    );

    this.server.to(`token:${event.tokenAddress}`).emit('token:price-updated', {
      tokenAddress: event.tokenAddress,
      price: event.currentPrice.toString(),
      marketCap: event.marketCap.toString(),
      totalNativeReserve: event.totalNativeReserve.toString(),
      totalTokenReserve: event.totalTokenReserve.toString(),
      athPriceUpdated: event.athPriceUpdated,
      athMarketCapUpdated: event.athMarketCapUpdated,
      timestamp: event.timestamp,
    });
  }

  /**
   * Handle TokenCreatedEvent
   * Broadcasts new token creation to all connected clients
   */
  @OnEvent('token.created')
  handleTokenCreated(event: TokenCreatedEvent): void {
    this.logger.log(
      `Broadcasting new token: ${event.symbol} (${event.tokenAddress})`,
    );

    this.server.emit('token:created', {
      tokenId: event.tokenId,
      tokenAddress: event.tokenAddress,
      name: event.name,
      symbol: event.symbol,
      creator: event.creator,
      initialPrice: event.initialPrice.toString(),
      initialMarketCap: event.initialMarketCap.toString(),
      createdAt: event.createdAt,
    });
  }

  /**
   * Handle TokenLockedEvent
   * Broadcasts token lock (graduation threshold reached) to subscribed clients
   */
  @OnEvent('token.locked')
  handleTokenLocked(event: TokenLockedEvent): void {
    this.logger.log(`Broadcasting token locked: ${event.tokenAddress}`);

    this.server.to(`token:${event.tokenAddress}`).emit('token:locked', {
      tokenId: event.tokenId,
      tokenAddress: event.tokenAddress,
      lockedAt: event.lockedAt,
    });

    // Also broadcast to all clients as this is a market-wide event
    this.broadcastMarketEvent('token-locked', {
      tokenAddress: event.tokenAddress,
    });
  }

  /**
   * Handle TokenListedEvent
   * Broadcasts token listing on Uniswap to subscribed clients
   */
  @OnEvent('token.listed')
  handleTokenListed(event: TokenListedEvent): void {
    this.logger.log(
      `Broadcasting token listed: ${event.tokenAddress} on pool ${event.uniswapV3PoolAddress}`,
    );

    this.server.to(`token:${event.tokenAddress}`).emit('token:listed', {
      tokenId: event.tokenId,
      tokenAddress: event.tokenAddress,
      uniswapV3Pool: event.uniswapV3PoolAddress,
      listedAt: event.listedAt,
    });

    // Also broadcast to all clients as this is a market-wide event
    this.broadcastMarketEvent('token-graduated', {
      tokenAddress: event.tokenAddress,
      uniswapV3Pool: event.uniswapV3PoolAddress,
    });
  }

  /**
   * Handle NewATHPriceEvent
   * Broadcasts ATH price achievement to subscribed clients
   */
  @OnEvent('token.ath.price')
  handleNewATHPrice(event: NewATHPriceEvent): void {
    this.logger.log(
      `Broadcasting new ATH price for ${event.tokenAddress}: ${event.newATHPrice}`,
    );

    this.server.to(`token:${event.tokenAddress}`).emit('token:ath-price', {
      tokenAddress: event.tokenAddress,
      newATHPrice: event.newATHPrice.toString(),
      timestamp: event.timestamp,
    });

    // Broadcast milestone to all clients
    this.broadcastMarketEvent('ath-price-reached', {
      tokenAddress: event.tokenAddress,
      newATHPrice: event.newATHPrice.toString(),
    });
  }

  /**
   * Handle NewATHMarketCapEvent
   * Broadcasts ATH market cap achievement to subscribed clients
   */
  @OnEvent('token.ath.marketCap')
  handleNewATHMarketCap(event: NewATHMarketCapEvent): void {
    this.logger.log(
      `Broadcasting new ATH market cap for ${event.tokenAddress}: ${event.newATHMarketCap}`,
    );

    this.server.to(`token:${event.tokenAddress}`).emit('token:ath-market-cap', {
      tokenAddress: event.tokenAddress,
      newATHMarketCap: event.newATHMarketCap.toString(),
      timestamp: event.timestamp,
    });

    // Broadcast milestone to all clients
    this.broadcastMarketEvent('ath-market-cap-reached', {
      tokenAddress: event.tokenAddress,
      newATHMarketCap: event.newATHMarketCap.toString(),
    });
  }

  /**
   * Handle PortfolioBalanceUpdatedEvent
   * Broadcasts portfolio updates to the specific user
   */
  @OnEvent('portfolio.balance.updated')
  handlePortfolioBalanceUpdated(event: PortfolioBalanceUpdatedEvent): void {
    this.logger.debug(
      `Broadcasting portfolio update for user ${event.userId}`,
    );

    this.server.to(`portfolio:${event.userId}`).emit('portfolio:trade', {
      portfolioId: event.portfolioId,
      userId: event.userId,
      tokenAddress: event.tokenAddress,
      operation: event.operation,
      tokenAmount: event.tokenAmount.toString(),
      pushAmount: event.pushAmount.toString(),
      timestamp: event.timestamp,
    });

    // Also emit to trade stream for the specific token
    this.server.to(`trades:${event.tokenAddress}`).emit('trade:executed', {
      tokenAddress: event.tokenAddress,
      type: event.operation,
      user: event.userId,
      amountIn:
        event.operation === 'buy'
          ? event.pushAmount.toString()
          : event.tokenAmount.toString(),
      amountOut:
        event.operation === 'buy'
          ? event.tokenAmount.toString()
          : event.pushAmount.toString(),
      timestamp: event.timestamp,
    });

    // Also emit to global trade stream
    this.server.to('trades:all').emit('trade:executed', {
      tokenAddress: event.tokenAddress,
      type: event.operation,
      user: event.userId,
      amountIn:
        event.operation === 'buy'
          ? event.pushAmount.toString()
          : event.tokenAmount.toString(),
      amountOut:
        event.operation === 'buy'
          ? event.tokenAmount.toString()
          : event.pushAmount.toString(),
      timestamp: event.timestamp,
    });
  }

  // === Infrastructure Event Handlers (from TradeIndexingProcessor) ===

  /**
   * Handle trade.buy event from indexer
   */
  @OnEvent('trade.buy')
  handleTradeBuy(event: {
    tokenAddress: string;
    trader: string;
    amountIn: string;
    amountOut: string;
    price: string;
    timestamp: number;
    transactionHash: string;
  }): void {
    this.logger.debug(`Broadcasting buy trade for ${event.tokenAddress}`);

    const tradeData = {
      tokenAddress: event.tokenAddress,
      type: 'buy' as const,
      trader: event.trader,
      amountIn: event.amountIn,
      amountOut: event.amountOut,
      price: event.price,
      timestamp: new Date(event.timestamp * 1000),
      transactionHash: event.transactionHash,
    };

    this.server.to(`trades:${event.tokenAddress}`).emit('trade:executed', tradeData);
    this.server.to('trades:all').emit('trade:executed', tradeData);
  }

  /**
   * Handle trade.sell event from indexer
   */
  @OnEvent('trade.sell')
  handleTradeSell(event: {
    tokenAddress: string;
    trader: string;
    amountIn: string;
    amountOut: string;
    price: string;
    timestamp: number;
    transactionHash: string;
  }): void {
    this.logger.debug(`Broadcasting sell trade for ${event.tokenAddress}`);

    const tradeData = {
      tokenAddress: event.tokenAddress,
      type: 'sell' as const,
      trader: event.trader,
      amountIn: event.amountIn,
      amountOut: event.amountOut,
      price: event.price,
      timestamp: new Date(event.timestamp * 1000),
      transactionHash: event.transactionHash,
    };

    this.server.to(`trades:${event.tokenAddress}`).emit('trade:executed', tradeData);
    this.server.to('trades:all').emit('trade:executed', tradeData);
  }

  /**
   * Handle token.sync event from indexer (price update)
   */
  @OnEvent('token.sync')
  handleTokenSync(event: {
    tokenAddress: string;
    price: string;
    marketCap: string;
    realNative: string;
    realToken: string;
    virtualNative: string;
    virtualToken: string;
    timestamp: number;
  }): void {
    this.logger.debug(`Broadcasting sync for ${event.tokenAddress}`);

    this.server.to(`token:${event.tokenAddress}`).emit('token:price-updated', {
      tokenAddress: event.tokenAddress,
      price: event.price,
      marketCap: event.marketCap,
      realNative: event.realNative,
      realToken: event.realToken,
      virtualNative: event.virtualNative,
      virtualToken: event.virtualToken,
      timestamp: new Date(event.timestamp * 1000),
    });
  }

  /**
   * Handle token.graduated event from indexer
   */
  @OnEvent('token.graduated')
  handleTokenGraduated(event: {
    tokenAddress: string;
    poolAddress: string;
    liquidity: string;
    amount0: string;
    amount1: string;
  }): void {
    this.logger.log(`Broadcasting graduation for ${event.tokenAddress}`);

    this.server.to(`token:${event.tokenAddress}`).emit('token:graduated', event);
    this.broadcastMarketEvent('token-graduated', event);
  }

  /**
   * Handle creator.fees.accumulated event
   */
  @OnEvent('creator.fees.accumulated')
  handleCreatorFeesAccumulated(event: {
    creatorAddress: string;
    tokenAddress: string;
    totalAccumulated: string;
  }): void {
    this.logger.debug(
      `Broadcasting creator fees accumulated for ${event.creatorAddress}`,
    );

    this.server.to(`portfolio:${event.creatorAddress}`).emit('creator:fees-accumulated', event);
  }

  /**
   * Handle creator.fees.claimed event
   */
  @OnEvent('creator.fees.claimed')
  handleCreatorFeesClaimed(event: {
    creatorAddress: string;
    tokenAddress: string;
    amount: string;
  }): void {
    this.logger.log(
      `Broadcasting creator fees claimed: ${event.amount} by ${event.creatorAddress}`,
    );

    this.server.to(`portfolio:${event.creatorAddress}`).emit('creator:fees-claimed', event);
    this.broadcastMarketEvent('creator-fees-claimed', event);
  }

  /**
   * Handle token.graduation.ready event
   */
  @OnEvent('token.graduation.ready')
  handleGraduationReady(event: {
    tokenId: string;
    tokenAddress: string;
    curveAddress: string;
    marketCap: string;
    graduationThreshold: string;
    listingTransaction: { to: string; data: string; value: string };
  }): void {
    this.logger.log(`Broadcasting graduation ready for ${event.tokenAddress}`);

    this.server.to(`token:${event.tokenAddress}`).emit('token:graduation-ready', {
      tokenAddress: event.tokenAddress,
      curveAddress: event.curveAddress,
      marketCap: event.marketCap,
      graduationThreshold: event.graduationThreshold,
    });

    this.broadcastMarketEvent('graduation-ready', {
      tokenAddress: event.tokenAddress,
      marketCap: event.marketCap,
    });
  }

  /**
   * Handle token.graduation.pending event
   */
  @OnEvent('token.graduation.pending')
  handleGraduationPending(event: {
    tokenId: string;
    tokenAddress: string;
    curveAddress: string;
    marketCap: string;
  }): void {
    this.logger.log(`Broadcasting graduation pending for ${event.tokenAddress}`);

    this.server.to(`token:${event.tokenAddress}`).emit('token:graduation-pending', {
      tokenAddress: event.tokenAddress,
      marketCap: event.marketCap,
    });
  }
}
