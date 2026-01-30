import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PubSubService } from '@hodlfun/redis';
import { EventsGateway } from '../gateways/events.gateway';
import { TradesGateway } from '../gateways/trades.gateway';

interface TokenCreatedMessage {
  type: string;
  token: {
    address: string;
    name: string;
    symbol: string;
    creator: string;
  };
}

interface TradeMessage {
  type: string;
  tokenAddress: string;
  trade: {
    type: string;
    trader: string;
    amountIn: string;
    amountOut: string;
    price: string;
  };
}

interface PriceUpdateMessage {
  tokenAddress: string;
  price: string;
  marketCap: string;
}

interface GraduationMessage {
  tokenAddress: string;
  poolAddress?: string;
}

@Injectable()
export class EventListenerService implements OnModuleInit {
  private readonly logger = new Logger(EventListenerService.name);

  constructor(
    private readonly pubsub: PubSubService,
    private readonly eventsGateway: EventsGateway,
    private readonly tradesGateway: TradesGateway,
  ) {}

  async onModuleInit() {
    await this.subscribeToEvents();
  }

  private async subscribeToEvents() {
    // Subscribe to token creation events
    await this.pubsub.subscribe('token_created', (message: unknown) => {
      this.logger.debug('Received token_created event');
      const tokenMessage = message as TokenCreatedMessage;
      this.eventsGateway.broadcastGlobal('token_created', tokenMessage);
    });

    // Subscribe to trade events
    await this.pubsub.subscribe('trade', (message: unknown) => {
      const tradeMessage = message as TradeMessage;
      this.logger.debug(`Received trade event for ${tradeMessage.tokenAddress}`);

      // Broadcast to token subscribers
      this.eventsGateway.broadcastToToken(tradeMessage.tokenAddress, 'trade', tradeMessage.trade);

      // Broadcast to trades room
      this.tradesGateway.broadcastTrade(tradeMessage.tokenAddress, tradeMessage.trade);

      // Broadcast to trader's wallet room
      this.eventsGateway.broadcastToWallet(tradeMessage.trade.trader, 'my_trade', tradeMessage);
    });

    // Subscribe to price update events
    await this.pubsub.subscribe('price_update', (message: unknown) => {
      const priceMessage = message as PriceUpdateMessage;
      this.eventsGateway.broadcastToToken(priceMessage.tokenAddress, 'price_update', {
        price: priceMessage.price,
        marketCap: priceMessage.marketCap,
      });
    });

    // Subscribe to graduation events
    await this.pubsub.subscribe('graduation', (message: unknown) => {
      const gradMessage = message as GraduationMessage;
      this.eventsGateway.broadcastToToken(gradMessage.tokenAddress, 'graduation', gradMessage);
      this.eventsGateway.broadcastGlobal('token_graduated', gradMessage);
    });

    // Subscribe to listing events
    await this.pubsub.subscribe('listing', (message: unknown) => {
      const listingMessage = message as GraduationMessage;
      this.eventsGateway.broadcastToToken(listingMessage.tokenAddress, 'listing', listingMessage);
      this.eventsGateway.broadcastGlobal('token_listed', listingMessage);
    });

    this.logger.log('Subscribed to all Redis Pub/Sub channels');
  }
}
