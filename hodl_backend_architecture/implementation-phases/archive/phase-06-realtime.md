# Phase 6: Real-time Features

## Objective
Implement the WebSocket service with Socket.io for real-time event broadcasting.

## Prerequisites
- Phase 4 completed (Core Backend)
- Phase 5 completed (Indexer with Pub/Sub)

## Duration: 2-3 days

---

## 6.1 WebSocket Service Setup

### Main Entry Point

```typescript
// apps/websocket/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WebSocketModule } from './websocket.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(WebSocketModule);
  const logger = new Logger('WebSocket');

  // Use Redis adapter for multi-pod support
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  const port = process.env.WS_PORT || 3001;
  await app.listen(port);
  logger.log(`WebSocket service running on port ${port}`);
}
bootstrap();
```

```typescript
// apps/websocket/src/websocket.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@libs/database';
import { RedisModule } from '@libs/redis';
import { HealthModule } from './health/health.module';
import { EventsGateway } from './gateways/events.gateway';
import { TradesGateway } from './gateways/trades.gateway';
import { SubscriptionService } from './services/subscription.service';
import { EventListenerService } from './services/event-listener.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    HealthModule,
  ],
  providers: [
    EventsGateway,
    TradesGateway,
    SubscriptionService,
    EventListenerService,
  ],
})
export class WebSocketModule {}
```

---

## 6.2 Redis IO Adapter

```typescript
// apps/websocket/src/adapters/redis-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const configService = this.createIOServer(-1).getService(ConfigService);
    const redisUrl = configService.get('REDIS_URL');

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

---

## 6.3 Events Gateway

```typescript
// apps/websocket/src/gateways/events.gateway.ts
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

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private subscriptionService: SubscriptionService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Auto-subscribe to global events
    client.join('global');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
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

  // Methods to broadcast events
  broadcastToToken(tokenAddress: string, event: string, data: any) {
    const room = `token:${tokenAddress.toLowerCase()}`;
    this.server.to(room).emit(event, data);
  }

  broadcastToWallet(walletAddress: string, event: string, data: any) {
    const room = `wallet:${walletAddress.toLowerCase()}`;
    this.server.to(room).emit(event, data);
  }

  broadcastGlobal(event: string, data: any) {
    this.server.to('global').emit(event, data);
  }
}
```

---

## 6.4 Trades Gateway

```typescript
// apps/websocket/src/gateways/trades.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@libs/database';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/trades',
})
export class TradesGateway {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  @SubscribeMessage('subscribe:recent')
  async handleSubscribeRecent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tokenAddress: string },
  ) {
    const room = `trades:${data.tokenAddress.toLowerCase()}`;
    client.join(room);

    // Send recent trades immediately
    const recentTrades = await this.prisma.trade.findMany({
      where: { tokenAddress: data.tokenAddress.toLowerCase() },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    client.emit('recent_trades', { trades: recentTrades });

    return { status: 'subscribed', room };
  }

  broadcastTrade(tokenAddress: string, trade: any) {
    const room = `trades:${tokenAddress.toLowerCase()}`;
    this.server.to(room).emit('new_trade', trade);
  }
}
```

---

## 6.5 Event Listener Service

```typescript
// apps/websocket/src/services/event-listener.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PubSubService } from '@libs/redis';
import { EventsGateway } from '../gateways/events.gateway';
import { TradesGateway } from '../gateways/trades.gateway';

@Injectable()
export class EventListenerService implements OnModuleInit {
  private readonly logger = new Logger(EventListenerService.name);

  constructor(
    private pubsub: PubSubService,
    private eventsGateway: EventsGateway,
    private tradesGateway: TradesGateway,
  ) {}

  async onModuleInit() {
    await this.subscribeToEvents();
  }

  private async subscribeToEvents() {
    // Subscribe to token creation events
    await this.pubsub.subscribe('token_created', (message) => {
      this.logger.debug('Received token_created event');
      this.eventsGateway.broadcastGlobal('token_created', message);
    });

    // Subscribe to trade events
    await this.pubsub.subscribe('trade', (message) => {
      this.logger.debug(`Received trade event for ${message.tokenAddress}`);

      // Broadcast to token subscribers
      this.eventsGateway.broadcastToToken(
        message.tokenAddress,
        'trade',
        message.trade,
      );

      // Broadcast to trades room
      this.tradesGateway.broadcastTrade(message.tokenAddress, message.trade);

      // Broadcast to trader's wallet room
      this.eventsGateway.broadcastToWallet(
        message.trade.trader,
        'my_trade',
        message,
      );
    });

    // Subscribe to price update events
    await this.pubsub.subscribe('price_update', (message) => {
      this.eventsGateway.broadcastToToken(
        message.tokenAddress,
        'price_update',
        {
          price: message.price,
          marketCap: message.marketCap,
        },
      );
    });

    // Subscribe to graduation events
    await this.pubsub.subscribe('graduation', (message) => {
      this.eventsGateway.broadcastToToken(
        message.tokenAddress,
        'graduation',
        message,
      );
      this.eventsGateway.broadcastGlobal('token_graduated', message);
    });

    // Subscribe to listing events
    await this.pubsub.subscribe('listing', (message) => {
      this.eventsGateway.broadcastToToken(
        message.tokenAddress,
        'listing',
        message,
      );
      this.eventsGateway.broadcastGlobal('token_listed', message);
    });

    this.logger.log('Subscribed to all Redis Pub/Sub channels');
  }
}
```

---

## 6.6 Subscription Service

```typescript
// apps/websocket/src/services/subscription.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '@libs/redis';

@Injectable()
export class SubscriptionService {
  private readonly subscriptionPrefix = 'ws:subs:';

  constructor(private redis: RedisService) {}

  async trackSubscription(clientId: string, room: string): Promise<void> {
    await this.redis.sadd(`${this.subscriptionPrefix}${clientId}`, room);
  }

  async removeSubscription(clientId: string, room: string): Promise<void> {
    await this.redis.srem(`${this.subscriptionPrefix}${clientId}`, room);
  }

  async getSubscriptions(clientId: string): Promise<string[]> {
    return this.redis.smembers(`${this.subscriptionPrefix}${clientId}`);
  }

  async cleanupClient(clientId: string): Promise<void> {
    await this.redis.del(`${this.subscriptionPrefix}${clientId}`);
  }

  async getActiveConnectionCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.subscriptionPrefix}*`);
    return keys.length;
  }
}
```

---

## 6.7 Pub/Sub Service (Redis Library)

```typescript
// libs/redis/src/pubsub.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class PubSubService {
  private readonly logger = new Logger(PubSubService.name);
  private publisher: Redis;
  private subscriber: Redis;
  private handlers = new Map<string, (message: any) => void>();

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get('REDIS_URL');
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

    this.subscriber.on('message', (channel, message) => {
      const handler = this.handlers.get(channel);
      if (handler) {
        try {
          const parsed = JSON.parse(message);
          handler(parsed);
        } catch (error) {
          this.logger.error(`Error processing message on ${channel}: ${error.message}`);
        }
      }
    });
  }

  async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    this.handlers.set(channel, handler);
    await this.subscriber.subscribe(channel);
    this.logger.log(`Subscribed to channel: ${channel}`);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }
}
```

---

## 6.8 Client Example

```typescript
// Frontend WebSocket connection example
import { io } from 'socket.io-client';

const socket = io('wss://api.hodlfun.io/events', {
  transports: ['websocket'],
});

// Subscribe to a specific token
socket.emit('subscribe:token', { tokenAddress: '0x123...' });

// Listen for trades
socket.on('trade', (trade) => {
  console.log('New trade:', trade);
});

// Listen for price updates
socket.on('price_update', (data) => {
  console.log('Price update:', data);
});

// Listen for global new tokens
socket.on('token_created', (token) => {
  console.log('New token created:', token);
});

// Unsubscribe
socket.emit('unsubscribe:token', { tokenAddress: '0x123...' });
```

---

## 6.9 Verification Checklist

- [ ] WebSocket service starts without errors
- [ ] Redis adapter configured for multi-pod
- [ ] Clients can connect and subscribe
- [ ] Events from indexer broadcast to subscribers
- [ ] Subscription tracking working
- [ ] Client cleanup on disconnect
- [ ] Cross-pod messaging working (test with 2+ pods)

## Testing Commands

```bash
# Start WebSocket service
pnpm --filter websocket run start:dev

# Test connection with wscat
npm install -g wscat
wscat -c 'ws://localhost:3001/events'

# Send subscription message
> {"event":"subscribe:token","data":{"tokenAddress":"0x..."}}
```

## Next Phase
Proceed to **Phase 7: Worker** to implement background job processing.
