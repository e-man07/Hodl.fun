/**
 * Event Listener Service Unit Tests
 * Tests for Redis Pub/Sub event handling and broadcasting
 */
import { Test, TestingModule } from '@nestjs/testing';
import { EventListenerService } from '../../services/event-listener.service';
import { PubSubService } from '@hodlfun/redis';
import { EventsGateway } from '../../gateways/events.gateway';
import { TradesGateway } from '../../gateways/trades.gateway';

// Mock factories
const createMockPubSubService = () => {
  const handlers: Map<string, (message: unknown) => void> = new Map();
  return {
    subscribe: jest.fn().mockImplementation(async (channel: string, handler: (message: unknown) => void) => {
      handlers.set(channel, handler);
    }),
    // Helper method to simulate receiving a message
    _simulateMessage: (channel: string, message: unknown) => {
      const handler = handlers.get(channel);
      if (handler) {
        handler(message);
      }
    },
  };
};

const createMockEventsGateway = () => ({
  broadcastGlobal: jest.fn(),
  broadcastToToken: jest.fn(),
  broadcastToWallet: jest.fn(),
});

const createMockTradesGateway = () => ({
  broadcastTrade: jest.fn(),
});

describe('EventListenerService', () => {
  let service: EventListenerService;
  let mockPubSub: ReturnType<typeof createMockPubSubService>;
  let mockEventsGateway: ReturnType<typeof createMockEventsGateway>;
  let mockTradesGateway: ReturnType<typeof createMockTradesGateway>;

  beforeEach(async () => {
    mockPubSub = createMockPubSubService();
    mockEventsGateway = createMockEventsGateway();
    mockTradesGateway = createMockTradesGateway();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventListenerService,
        { provide: PubSubService, useValue: mockPubSub },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: TradesGateway, useValue: mockTradesGateway },
      ],
    }).compile();

    service = module.get<EventListenerService>(EventListenerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should subscribe to all required channels', async () => {
      await service.onModuleInit();

      expect(mockPubSub.subscribe).toHaveBeenCalledWith('token_created', expect.any(Function));
      expect(mockPubSub.subscribe).toHaveBeenCalledWith('trade', expect.any(Function));
      expect(mockPubSub.subscribe).toHaveBeenCalledWith('price_update', expect.any(Function));
      expect(mockPubSub.subscribe).toHaveBeenCalledWith('graduation', expect.any(Function));
      expect(mockPubSub.subscribe).toHaveBeenCalledWith('listing', expect.any(Function));
    });

    it('should subscribe to exactly 5 channels', async () => {
      await service.onModuleInit();

      expect(mockPubSub.subscribe).toHaveBeenCalledTimes(5);
    });
  });

  describe('token_created handler', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should broadcast token creation to global room', () => {
      const message = {
        type: 'token_created',
        token: {
          address: '0xtoken',
          name: 'Test Token',
          symbol: 'TEST',
          creator: '0xcreator',
        },
      };

      mockPubSub._simulateMessage('token_created', message);

      expect(mockEventsGateway.broadcastGlobal).toHaveBeenCalledWith('token_created', message);
    });

    it('should handle token with all properties', () => {
      const message = {
        type: 'token_created',
        token: {
          address: '0xfulltoken',
          name: 'Full Token',
          symbol: 'FULL',
          creator: '0xfullcreator',
          uri: 'ipfs://example',
        },
      };

      mockPubSub._simulateMessage('token_created', message);

      expect(mockEventsGateway.broadcastGlobal).toHaveBeenCalledWith('token_created', message);
    });
  });

  describe('trade handler', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should broadcast trade to token subscribers', () => {
      const message = {
        type: 'trade',
        tokenAddress: '0xtoken',
        trade: {
          type: 'BUY',
          trader: '0xtrader',
          amountIn: '1000',
          amountOut: '500',
          price: '2',
        },
      };

      mockPubSub._simulateMessage('trade', message);

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledWith(
        '0xtoken',
        'trade',
        message.trade,
      );
    });

    it('should broadcast trade to trades gateway', () => {
      const message = {
        type: 'trade',
        tokenAddress: '0xtoken',
        trade: {
          type: 'SELL',
          trader: '0xtrader',
          amountIn: '500',
          amountOut: '1000',
          price: '2',
        },
      };

      mockPubSub._simulateMessage('trade', message);

      expect(mockTradesGateway.broadcastTrade).toHaveBeenCalledWith('0xtoken', message.trade);
    });

    it('should broadcast trade to trader wallet room', () => {
      const message = {
        type: 'trade',
        tokenAddress: '0xtoken',
        trade: {
          type: 'BUY',
          trader: '0xmytrader',
          amountIn: '1000',
          amountOut: '500',
          price: '2',
        },
      };

      mockPubSub._simulateMessage('trade', message);

      expect(mockEventsGateway.broadcastToWallet).toHaveBeenCalledWith(
        '0xmytrader',
        'my_trade',
        message,
      );
    });

    it('should broadcast to all three destinations', () => {
      const message = {
        type: 'trade',
        tokenAddress: '0xtoken',
        trade: {
          type: 'BUY',
          trader: '0xtrader',
          amountIn: '100',
          amountOut: '50',
          price: '2',
        },
      };

      mockPubSub._simulateMessage('trade', message);

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledTimes(1);
      expect(mockTradesGateway.broadcastTrade).toHaveBeenCalledTimes(1);
      expect(mockEventsGateway.broadcastToWallet).toHaveBeenCalledTimes(1);
    });
  });

  describe('price_update handler', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should broadcast price update to token subscribers', () => {
      const message = {
        tokenAddress: '0xtoken',
        price: '1500000000000000000',
        marketCap: '10000000000000000000000',
      };

      mockPubSub._simulateMessage('price_update', message);

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledWith(
        '0xtoken',
        'price_update',
        {
          price: message.price,
          marketCap: message.marketCap,
        },
      );
    });

    it('should only include price and marketCap in broadcast', () => {
      const message = {
        tokenAddress: '0xtoken',
        price: '1000',
        marketCap: '100000',
        extraField: 'should not be included',
      };

      mockPubSub._simulateMessage('price_update', message);

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledWith(
        '0xtoken',
        'price_update',
        {
          price: '1000',
          marketCap: '100000',
        },
      );
    });
  });

  describe('graduation handler', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should broadcast graduation to token subscribers', () => {
      const message = {
        tokenAddress: '0xgraduated',
        poolAddress: '0xpool',
      };

      mockPubSub._simulateMessage('graduation', message);

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledWith(
        '0xgraduated',
        'graduation',
        message,
      );
    });

    it('should broadcast graduation to global room', () => {
      const message = {
        tokenAddress: '0xgraduated',
      };

      mockPubSub._simulateMessage('graduation', message);

      expect(mockEventsGateway.broadcastGlobal).toHaveBeenCalledWith('token_graduated', message);
    });

    it('should broadcast to both token and global rooms', () => {
      const message = {
        tokenAddress: '0xtoken',
      };

      mockPubSub._simulateMessage('graduation', message);

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledTimes(1);
      expect(mockEventsGateway.broadcastGlobal).toHaveBeenCalledTimes(1);
    });
  });

  describe('listing handler', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should broadcast listing to token subscribers', () => {
      const message = {
        tokenAddress: '0xlisted',
        poolAddress: '0xv3pool',
      };

      mockPubSub._simulateMessage('listing', message);

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledWith(
        '0xlisted',
        'listing',
        message,
      );
    });

    it('should broadcast listing to global room', () => {
      const message = {
        tokenAddress: '0xlisted',
        poolAddress: '0xv3pool',
      };

      mockPubSub._simulateMessage('listing', message);

      expect(mockEventsGateway.broadcastGlobal).toHaveBeenCalledWith('token_listed', message);
    });

    it('should broadcast to both token and global rooms', () => {
      const message = {
        tokenAddress: '0xtoken',
        poolAddress: '0xpool',
      };

      mockPubSub._simulateMessage('listing', message);

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledTimes(1);
      expect(mockEventsGateway.broadcastGlobal).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple events', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should handle multiple events in sequence', () => {
      // Token created
      mockPubSub._simulateMessage('token_created', {
        type: 'token_created',
        token: { address: '0xa', name: 'A', symbol: 'A', creator: '0x1' },
      });

      // Trade
      mockPubSub._simulateMessage('trade', {
        type: 'trade',
        tokenAddress: '0xa',
        trade: { type: 'BUY', trader: '0x1', amountIn: '100', amountOut: '50', price: '2' },
      });

      // Price update
      mockPubSub._simulateMessage('price_update', {
        tokenAddress: '0xa',
        price: '2100000000000000000',
        marketCap: '21000000000000000000000',
      });

      expect(mockEventsGateway.broadcastGlobal).toHaveBeenCalledTimes(1); // token_created
      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledTimes(2); // trade + price_update
      expect(mockTradesGateway.broadcastTrade).toHaveBeenCalledTimes(1); // trade
      expect(mockEventsGateway.broadcastToWallet).toHaveBeenCalledTimes(1); // my_trade
    });

    it('should handle events for different tokens', () => {
      mockPubSub._simulateMessage('trade', {
        type: 'trade',
        tokenAddress: '0xtoken1',
        trade: { type: 'BUY', trader: '0x1', amountIn: '100', amountOut: '50', price: '2' },
      });

      mockPubSub._simulateMessage('trade', {
        type: 'trade',
        tokenAddress: '0xtoken2',
        trade: { type: 'SELL', trader: '0x2', amountIn: '50', amountOut: '100', price: '2' },
      });

      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledWith('0xtoken1', 'trade', expect.any(Object));
      expect(mockEventsGateway.broadcastToToken).toHaveBeenCalledWith('0xtoken2', 'trade', expect.any(Object));
    });
  });
});
