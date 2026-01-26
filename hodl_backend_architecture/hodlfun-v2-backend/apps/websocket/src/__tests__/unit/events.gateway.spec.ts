/**
 * Events Gateway Unit Tests
 * Tests for WebSocket event handling and broadcasting
 */
import { Test, TestingModule } from '@nestjs/testing';
import { EventsGateway } from '../../gateways/events.gateway';
import { SubscriptionService } from '../../services/subscription.service';
import { MetricsService } from '@hodlfun/common';
import { Socket, Server } from 'socket.io';

// Mock factories
const createMockSubscriptionService = () => ({
  trackSubscription: jest.fn(),
  removeSubscription: jest.fn(),
  cleanupClient: jest.fn(),
});

const createMockMetricsService = () => ({
  activeWebsocketConnections: {
    inc: jest.fn(),
    dec: jest.fn(),
  },
});

const createMockSocket = (id: string = 'test-client-id'): Partial<Socket> => ({
  id,
  join: jest.fn(),
  leave: jest.fn(),
});

const createMockServer = (): Partial<Server> => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
});

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let mockSubscriptionService: ReturnType<typeof createMockSubscriptionService>;
  let mockMetrics: ReturnType<typeof createMockMetricsService>;
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(async () => {
    mockSubscriptionService = createMockSubscriptionService();
    mockMetrics = createMockMetricsService();
    mockServer = createMockServer();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsGateway,
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    gateway.server = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should increment active connections metric', () => {
      const client = createMockSocket() as Socket;
      gateway.handleConnection(client);

      expect(mockMetrics.activeWebsocketConnections.inc).toHaveBeenCalled();
    });

    it('should auto-subscribe client to global room', () => {
      const client = createMockSocket() as Socket;
      gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('global');
    });

    it('should handle multiple connections', () => {
      const client1 = createMockSocket('client-1') as Socket;
      const client2 = createMockSocket('client-2') as Socket;

      gateway.handleConnection(client1);
      gateway.handleConnection(client2);

      expect(mockMetrics.activeWebsocketConnections.inc).toHaveBeenCalledTimes(2);
      expect(client1.join).toHaveBeenCalledWith('global');
      expect(client2.join).toHaveBeenCalledWith('global');
    });
  });

  describe('handleDisconnect', () => {
    it('should decrement active connections metric', () => {
      const client = createMockSocket() as Socket;
      gateway.handleDisconnect(client);

      expect(mockMetrics.activeWebsocketConnections.dec).toHaveBeenCalled();
    });

    it('should cleanup client subscriptions', () => {
      const client = createMockSocket('client-123') as Socket;
      gateway.handleDisconnect(client);

      expect(mockSubscriptionService.cleanupClient).toHaveBeenCalledWith('client-123');
    });
  });

  describe('handleSubscribeToken', () => {
    it('should join token room', () => {
      const client = createMockSocket() as Socket;
      const tokenAddress = '0xToken123';

      gateway.handleSubscribeToken(client, { tokenAddress });

      expect(client.join).toHaveBeenCalledWith('token:0xtoken123');
    });

    it('should normalize token address to lowercase', () => {
      const client = createMockSocket() as Socket;
      const tokenAddress = '0xABCDEF123456';

      gateway.handleSubscribeToken(client, { tokenAddress });

      expect(client.join).toHaveBeenCalledWith('token:0xabcdef123456');
    });

    it('should track subscription', () => {
      const client = createMockSocket('client-abc') as Socket;
      const tokenAddress = '0xtoken';

      gateway.handleSubscribeToken(client, { tokenAddress });

      expect(mockSubscriptionService.trackSubscription).toHaveBeenCalledWith(
        'client-abc',
        'token:0xtoken',
      );
    });

    it('should return subscription confirmation', () => {
      const client = createMockSocket() as Socket;
      const tokenAddress = '0xtoken';

      const result = gateway.handleSubscribeToken(client, { tokenAddress });

      expect(result).toEqual({
        status: 'subscribed',
        room: 'token:0xtoken',
      });
    });
  });

  describe('handleUnsubscribeToken', () => {
    it('should leave token room', () => {
      const client = createMockSocket() as Socket;
      const tokenAddress = '0xToken123';

      gateway.handleUnsubscribeToken(client, { tokenAddress });

      expect(client.leave).toHaveBeenCalledWith('token:0xtoken123');
    });

    it('should normalize token address to lowercase', () => {
      const client = createMockSocket() as Socket;

      gateway.handleUnsubscribeToken(client, { tokenAddress: '0xUPPER' });

      expect(client.leave).toHaveBeenCalledWith('token:0xupper');
    });

    it('should remove subscription tracking', () => {
      const client = createMockSocket('client-xyz') as Socket;

      gateway.handleUnsubscribeToken(client, { tokenAddress: '0xtoken' });

      expect(mockSubscriptionService.removeSubscription).toHaveBeenCalledWith(
        'client-xyz',
        'token:0xtoken',
      );
    });

    it('should return unsubscription confirmation', () => {
      const client = createMockSocket() as Socket;

      const result = gateway.handleUnsubscribeToken(client, { tokenAddress: '0xtoken' });

      expect(result).toEqual({
        status: 'unsubscribed',
        room: 'token:0xtoken',
      });
    });
  });

  describe('handleSubscribeWallet', () => {
    it('should join wallet room', () => {
      const client = createMockSocket() as Socket;
      const walletAddress = '0xWallet123';

      gateway.handleSubscribeWallet(client, { walletAddress });

      expect(client.join).toHaveBeenCalledWith('wallet:0xwallet123');
    });

    it('should normalize wallet address to lowercase', () => {
      const client = createMockSocket() as Socket;

      gateway.handleSubscribeWallet(client, { walletAddress: '0xABCDEF' });

      expect(client.join).toHaveBeenCalledWith('wallet:0xabcdef');
    });

    it('should track subscription', () => {
      const client = createMockSocket('client-wallet') as Socket;

      gateway.handleSubscribeWallet(client, { walletAddress: '0xwallet' });

      expect(mockSubscriptionService.trackSubscription).toHaveBeenCalledWith(
        'client-wallet',
        'wallet:0xwallet',
      );
    });

    it('should return subscription confirmation', () => {
      const client = createMockSocket() as Socket;

      const result = gateway.handleSubscribeWallet(client, { walletAddress: '0xwallet' });

      expect(result).toEqual({
        status: 'subscribed',
        room: 'wallet:0xwallet',
      });
    });
  });

  describe('handleUnsubscribeWallet', () => {
    it('should leave wallet room', () => {
      const client = createMockSocket() as Socket;

      gateway.handleUnsubscribeWallet(client, { walletAddress: '0xWallet123' });

      expect(client.leave).toHaveBeenCalledWith('wallet:0xwallet123');
    });

    it('should remove subscription tracking', () => {
      const client = createMockSocket('client-w') as Socket;

      gateway.handleUnsubscribeWallet(client, { walletAddress: '0xwallet' });

      expect(mockSubscriptionService.removeSubscription).toHaveBeenCalledWith(
        'client-w',
        'wallet:0xwallet',
      );
    });

    it('should return unsubscription confirmation', () => {
      const client = createMockSocket() as Socket;

      const result = gateway.handleUnsubscribeWallet(client, { walletAddress: '0xwallet' });

      expect(result).toEqual({
        status: 'unsubscribed',
        room: 'wallet:0xwallet',
      });
    });
  });

  describe('broadcastToToken', () => {
    it('should emit to correct token room', () => {
      const data = { price: '100' };
      gateway.broadcastToToken('0xToken', 'price_update', data);

      expect(mockServer.to).toHaveBeenCalledWith('token:0xtoken');
      expect(mockServer.emit).toHaveBeenCalledWith('price_update', data);
    });

    it('should normalize token address to lowercase', () => {
      gateway.broadcastToToken('0xUPPERCASE', 'event', {});

      expect(mockServer.to).toHaveBeenCalledWith('token:0xuppercase');
    });
  });

  describe('broadcastToWallet', () => {
    it('should emit to correct wallet room', () => {
      const data = { trade: { type: 'BUY' } };
      gateway.broadcastToWallet('0xWallet', 'my_trade', data);

      expect(mockServer.to).toHaveBeenCalledWith('wallet:0xwallet');
      expect(mockServer.emit).toHaveBeenCalledWith('my_trade', data);
    });

    it('should normalize wallet address to lowercase', () => {
      gateway.broadcastToWallet('0xMIXEDcase', 'event', {});

      expect(mockServer.to).toHaveBeenCalledWith('wallet:0xmixedcase');
    });
  });

  describe('broadcastGlobal', () => {
    it('should emit to global room', () => {
      const data = { token: { name: 'New Token' } };
      gateway.broadcastGlobal('token_created', data);

      expect(mockServer.to).toHaveBeenCalledWith('global');
      expect(mockServer.emit).toHaveBeenCalledWith('token_created', data);
    });

    it('should work with any event type', () => {
      gateway.broadcastGlobal('custom_event', { custom: 'data' });

      expect(mockServer.to).toHaveBeenCalledWith('global');
      expect(mockServer.emit).toHaveBeenCalledWith('custom_event', { custom: 'data' });
    });
  });
});
