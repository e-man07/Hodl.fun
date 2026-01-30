import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SubscriptionService } from '../services/subscription.service';
import { MetricsService } from '@hodlfun/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly metrics: MetricsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.metrics.activeWebsocketConnections.inc();

    // Auto-subscribe to global events
    client.join('global');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.metrics.activeWebsocketConnections.dec();
    this.subscriptionService.cleanupClient(client.id);
  }

  @SubscribeMessage('subscribe:token')
  handleSubscribeToken(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tokenAddress: string },
  ) {
    const room = `token:${data.tokenAddress.toLowerCase()}`;
    client.join(room);
    this.subscriptionService.trackSubscription(client.id, room);

    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
    return { status: 'subscribed', room };
  }

  @SubscribeMessage('unsubscribe:token')
  handleUnsubscribeToken(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tokenAddress: string },
  ) {
    const room = `token:${data.tokenAddress.toLowerCase()}`;
    client.leave(room);
    this.subscriptionService.removeSubscription(client.id, room);

    return { status: 'unsubscribed', room };
  }

  @SubscribeMessage('subscribe:wallet')
  handleSubscribeWallet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { walletAddress: string },
  ) {
    const room = `wallet:${data.walletAddress.toLowerCase()}`;
    client.join(room);
    this.subscriptionService.trackSubscription(client.id, room);

    return { status: 'subscribed', room };
  }

  @SubscribeMessage('unsubscribe:wallet')
  handleUnsubscribeWallet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { walletAddress: string },
  ) {
    const room = `wallet:${data.walletAddress.toLowerCase()}`;
    client.leave(room);
    this.subscriptionService.removeSubscription(client.id, room);

    return { status: 'unsubscribed', room };
  }

  // Methods to broadcast events
  broadcastToToken(tokenAddress: string, event: string, data: unknown) {
    const room = `token:${tokenAddress.toLowerCase()}`;
    this.server.to(room).emit(event, data);
  }

  broadcastToWallet(walletAddress: string, event: string, data: unknown) {
    const room = `wallet:${walletAddress.toLowerCase()}`;
    this.server.to(room).emit(event, data);
  }

  broadcastGlobal(event: string, data: unknown) {
    this.server.to('global').emit(event, data);
  }
}
