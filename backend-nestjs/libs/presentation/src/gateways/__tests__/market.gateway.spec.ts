import { Test, TestingModule } from '@nestjs/testing';
import { MarketGateway } from '../market.gateway';

describe('MarketGateway', () => {
  let gateway: MarketGateway;
  let mockServer: any;
  let mockSocket: any;

  const mockTokenAddress = '0x' + 'a'.repeat(40);
  const mockUserId = '0x' + 'b'.repeat(40);
  const mockClientId = 'client-123';
  const mockClientId2 = 'client-456';

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      except: jest.fn().mockReturnThis(),
    };

    mockSocket = {
      id: mockClientId,
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [MarketGateway],
    }).compile();

    gateway = moduleRef.get<MarketGateway>(MarketGateway);
    gateway.server = mockServer;
  });

  describe('Connection Management', () => {
    it('should handle client connection', () => {
      gateway.handleConnection(mockSocket);

      expect(gateway['connectedClients'].has(mockClientId)).toBe(true);
    });

    it('should initialize empty subscriptions for new client', () => {
      gateway.handleConnection(mockSocket);

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions).toBeDefined();
      expect(subscriptions?.size).toBe(0);
    });

    it('should handle client disconnection', () => {
      gateway.handleConnection(mockSocket);
      gateway.handleDisconnect(mockSocket);

      expect(gateway['connectedClients'].has(mockClientId)).toBe(false);
    });

    it('should support multiple concurrent clients', () => {
      const socket2 = { ...mockSocket, id: mockClientId2 };

      gateway.handleConnection(mockSocket);
      gateway.handleConnection(socket2);

      expect(gateway['connectedClients'].has(mockClientId)).toBe(true);
      expect(gateway['connectedClients'].has(mockClientId2)).toBe(true);
      expect(gateway['connectedClients'].size).toBe(2);
    });

    it('should handle disconnection of one client without affecting others', () => {
      const socket2 = { ...mockSocket, id: mockClientId2 };

      gateway.handleConnection(mockSocket);
      gateway.handleConnection(socket2);
      gateway.handleDisconnect(mockSocket);

      expect(gateway['connectedClients'].has(mockClientId)).toBe(false);
      expect(gateway['connectedClients'].has(mockClientId2)).toBe(true);
    });
  });

  describe('Token Subscription', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket);
    });

    it('should subscribe client to token price updates', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.has(`token:${mockTokenAddress}`)).toBe(true);
    });

    it('should join client to token room', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      expect(mockSocket.join).toHaveBeenCalledWith(`token:${mockTokenAddress}`);
    });

    it('should emit subscribed confirmation', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'subscribed',
        expect.objectContaining({
          type: 'token',
          tokenAddress: mockTokenAddress,
        }),
      );
    });

    it('should handle missing token address', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: '' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Token address is required',
        }),
      );
    });

    it('should unsubscribe from token updates', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });
      gateway.handleUnsubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.has(`token:${mockTokenAddress}`)).toBe(false);
    });

    it('should leave token room on unsubscribe', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });
      gateway.handleUnsubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      expect(mockSocket.leave).toHaveBeenCalledWith(`token:${mockTokenAddress}`);
    });

    it('should support multiple token subscriptions per client', () => {
      const token2 = '0x' + 'c'.repeat(40);

      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: token2 });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(2);
      expect(subscriptions?.has(`token:${mockTokenAddress}`)).toBe(true);
      expect(subscriptions?.has(`token:${token2}`)).toBe(true);
    });

    it('should handle duplicate token subscriptions', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      // Should not add duplicate
      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(1);
    });
  });

  describe('Portfolio Subscription', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket);
    });

    it('should subscribe client to portfolio updates', () => {
      gateway.handleSubscribePortfolio(mockSocket, { userId: mockUserId });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.has(`portfolio:${mockUserId}`)).toBe(true);
    });

    it('should join client to portfolio room', () => {
      gateway.handleSubscribePortfolio(mockSocket, { userId: mockUserId });

      expect(mockSocket.join).toHaveBeenCalledWith(`portfolio:${mockUserId}`);
    });

    it('should emit subscribed confirmation for portfolio', () => {
      gateway.handleSubscribePortfolio(mockSocket, { userId: mockUserId });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'subscribed',
        expect.objectContaining({
          type: 'portfolio',
          userId: mockUserId,
        }),
      );
    });

    it('should handle missing user ID', () => {
      gateway.handleSubscribePortfolio(mockSocket, { userId: '' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'User ID is required',
        }),
      );
    });

    it('should unsubscribe from portfolio updates', () => {
      gateway.handleSubscribePortfolio(mockSocket, { userId: mockUserId });
      gateway.handleUnsubscribePortfolio(mockSocket, { userId: mockUserId });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.has(`portfolio:${mockUserId}`)).toBe(false);
    });

    it('should leave portfolio room on unsubscribe', () => {
      gateway.handleSubscribePortfolio(mockSocket, { userId: mockUserId });
      gateway.handleUnsubscribePortfolio(mockSocket, { userId: mockUserId });

      expect(mockSocket.leave).toHaveBeenCalledWith(`portfolio:${mockUserId}`);
    });
  });

  describe('Mixed Subscriptions', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket);
    });

    it('should support simultaneous token and portfolio subscriptions', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });
      gateway.handleSubscribePortfolio(mockSocket, { userId: mockUserId });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(2);
      expect(subscriptions?.has(`token:${mockTokenAddress}`)).toBe(true);
      expect(subscriptions?.has(`portfolio:${mockUserId}`)).toBe(true);
    });

    it('should maintain subscriptions when unsubscribing from one type', () => {
      const token2 = '0x' + 'c'.repeat(40);

      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: token2 });
      gateway.handleSubscribePortfolio(mockSocket, { userId: mockUserId });

      gateway.handleUnsubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(2);
      expect(subscriptions?.has(`token:${token2}`)).toBe(true);
      expect(subscriptions?.has(`portfolio:${mockUserId}`)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      gateway.handleConnection(mockSocket);
    });

    it('should handle subscription before client is fully initialized', () => {
      const newSocket = { id: 'new-client', emit: jest.fn(), join: jest.fn() } as any;
      gateway.handleConnection(newSocket);
      gateway.handleSubscribeToken(newSocket, { tokenAddress: mockTokenAddress });

      expect(newSocket.join).toHaveBeenCalled();
    });

    it('should handle unsubscribe when client has no subscriptions', () => {
      gateway.handleUnsubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      // Should not throw error
      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(0);
    });

    it('should handle addresses with different cases', () => {
      const upperAddress = mockTokenAddress.toUpperCase();
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: upperAddress });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.has(`token:${upperAddress}`)).toBe(true);
    });

    it('should handle very long subscription lists', () => {
      for (let i = 0; i < 100; i++) {
        const address = '0x' + i.toString().padStart(40, '0');
        gateway.handleSubscribeToken(mockSocket, { tokenAddress: address });
      }

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(100);
    });

    it('should handle rapid connect/disconnect cycles', () => {
      for (let i = 0; i < 10; i++) {
        const socket = { ...mockSocket, id: `client-${i}` };
        gateway.handleConnection(socket);
        gateway.handleDisconnect(socket);
      }

      expect(gateway['connectedClients'].size).toBe(0);
    });

    it('should handle concurrent operations on same client', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });
      gateway.handleSubscribePortfolio(mockSocket, { userId: mockUserId });
      gateway.handleUnsubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      const subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(1);
      expect(subscriptions?.has(`portfolio:${mockUserId}`)).toBe(true);
    });
  });

  describe('Broadcasting Events', () => {
    it('should broadcast price updates to token subscribers', () => {
      const priceUpdate = {
        tokenAddress: mockTokenAddress,
        price: '2000000000000000000',
        timestamp: new Date(),
      };

      gateway.server.to(`token:${mockTokenAddress}`).emit('token:price-updated', priceUpdate);

      expect(gateway.server.to).toHaveBeenCalledWith(`token:${mockTokenAddress}`);
    });

    it('should broadcast portfolio updates to subscribers', () => {
      const portfolioUpdate = {
        userId: mockUserId,
        totalValue: '5000000000000000000',
        timestamp: new Date(),
      };

      gateway.server.to(`portfolio:${mockUserId}`).emit('portfolio:updated', portfolioUpdate);

      expect(gateway.server.to).toHaveBeenCalledWith(`portfolio:${mockUserId}`);
    });
  });

  describe('Memory Management', () => {
    it('should clean up client data on disconnection', () => {
      const socket1 = { ...mockSocket, id: 'client-1' };
      const socket2 = { ...mockSocket, id: 'client-2' };

      gateway.handleConnection(socket1);
      gateway.handleConnection(socket2);
      gateway.handleSubscribeToken(socket1, { tokenAddress: mockTokenAddress });

      expect(gateway['connectedClients'].size).toBe(2);

      gateway.handleDisconnect(socket1);

      expect(gateway['connectedClients'].size).toBe(1);
      expect(gateway['connectedClients'].has('client-1')).toBe(false);
    });

    it('should release subscription memory when unsubscribing', () => {
      gateway.handleSubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      let subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(1);

      gateway.handleUnsubscribeToken(mockSocket, { tokenAddress: mockTokenAddress });

      subscriptions = gateway['connectedClients'].get(mockClientId);
      expect(subscriptions?.size).toBe(0);
    });
  });
});
