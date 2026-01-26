/**
 * Trades Gateway Unit Tests
 * Tests for WebSocket trade subscription and broadcasting
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TradesGateway } from '../../gateways/trades.gateway';
import { PrismaService } from '@hodlfun/database';
import { Socket, Server } from 'socket.io';

// Mock factories
const createMockPrismaService = () => ({
  trade: {
    findMany: jest.fn(),
  },
});

const createMockSocket = (id: string = 'test-client-id'): Partial<Socket> => ({
  id,
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
});

const createMockServer = (): Partial<Server> => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
});

describe('TradesGateway', () => {
  let gateway: TradesGateway;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockServer = createMockServer();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradesGateway,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    gateway = module.get<TradesGateway>(TradesGateway);
    gateway.server = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSubscribeRecent', () => {
    it('should join trades room', async () => {
      const client = createMockSocket() as Socket;
      const tokenAddress = '0xToken123';
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await gateway.handleSubscribeRecent(client, { tokenAddress });

      expect(client.join).toHaveBeenCalledWith('trades:0xtoken123');
    });

    it('should normalize token address to lowercase', async () => {
      const client = createMockSocket() as Socket;
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await gateway.handleSubscribeRecent(client, { tokenAddress: '0xUPPER' });

      expect(client.join).toHaveBeenCalledWith('trades:0xupper');
    });

    it('should fetch recent trades from database', async () => {
      const client = createMockSocket() as Socket;
      const tokenAddress = '0xtoken';
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await gateway.handleSubscribeRecent(client, { tokenAddress });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
        where: { tokenAddress: '0xtoken' },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });

    it('should emit recent trades to client', async () => {
      const client = createMockSocket() as Socket;
      const mockTrades = [
        { id: '1', type: 'BUY', amountIn: '100' },
        { id: '2', type: 'SELL', amountIn: '50' },
      ];
      mockPrisma.trade.findMany.mockResolvedValue(mockTrades);

      await gateway.handleSubscribeRecent(client, { tokenAddress: '0xtoken' });

      expect(client.emit).toHaveBeenCalledWith('recent_trades', { trades: mockTrades });
    });

    it('should emit empty array when no trades', async () => {
      const client = createMockSocket() as Socket;
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await gateway.handleSubscribeRecent(client, { tokenAddress: '0xtoken' });

      expect(client.emit).toHaveBeenCalledWith('recent_trades', { trades: [] });
    });

    it('should return subscription confirmation', async () => {
      const client = createMockSocket() as Socket;
      mockPrisma.trade.findMany.mockResolvedValue([]);

      const result = await gateway.handleSubscribeRecent(client, { tokenAddress: '0xtoken' });

      expect(result).toEqual({
        status: 'subscribed',
        room: 'trades:0xtoken',
      });
    });

    it('should limit trades to 50 most recent', async () => {
      const client = createMockSocket() as Socket;
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await gateway.handleSubscribeRecent(client, { tokenAddress: '0xtoken' });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should order trades by timestamp descending', async () => {
      const client = createMockSocket() as Socket;
      mockPrisma.trade.findMany.mockResolvedValue([]);

      await gateway.handleSubscribeRecent(client, { tokenAddress: '0xtoken' });

      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { timestamp: 'desc' } }),
      );
    });

    it('should handle database errors', async () => {
      const client = createMockSocket() as Socket;
      mockPrisma.trade.findMany.mockRejectedValue(new Error('DB Error'));

      await expect(
        gateway.handleSubscribeRecent(client, { tokenAddress: '0xtoken' }),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('handleUnsubscribeRecent', () => {
    it('should leave trades room', () => {
      const client = createMockSocket() as Socket;
      const tokenAddress = '0xToken123';

      gateway.handleUnsubscribeRecent(client, { tokenAddress });

      expect(client.leave).toHaveBeenCalledWith('trades:0xtoken123');
    });

    it('should normalize token address to lowercase', () => {
      const client = createMockSocket() as Socket;

      gateway.handleUnsubscribeRecent(client, { tokenAddress: '0xUPPER' });

      expect(client.leave).toHaveBeenCalledWith('trades:0xupper');
    });

    it('should return unsubscription confirmation', () => {
      const client = createMockSocket() as Socket;

      const result = gateway.handleUnsubscribeRecent(client, { tokenAddress: '0xtoken' });

      expect(result).toEqual({
        status: 'unsubscribed',
        room: 'trades:0xtoken',
      });
    });
  });

  describe('broadcastTrade', () => {
    it('should emit to correct trades room', () => {
      const trade = { type: 'BUY', amountIn: '1000' };
      gateway.broadcastTrade('0xtoken', trade);

      expect(mockServer.to).toHaveBeenCalledWith('trades:0xtoken');
      expect(mockServer.emit).toHaveBeenCalledWith('new_trade', trade);
    });

    it('should normalize token address to lowercase', () => {
      gateway.broadcastTrade('0xUPPERCASE', {});

      expect(mockServer.to).toHaveBeenCalledWith('trades:0xuppercase');
    });

    it('should emit new_trade event', () => {
      const trade = { id: '1', type: 'SELL' };
      gateway.broadcastTrade('0xtoken', trade);

      expect(mockServer.emit).toHaveBeenCalledWith('new_trade', trade);
    });

    it('should handle complex trade objects', () => {
      const trade = {
        id: '123',
        type: 'BUY',
        tokenAddress: '0xtoken',
        traderAddress: '0xtrader',
        amountIn: '1000000000000000000',
        amountOut: '500000',
        price: '2000000000000000',
        timestamp: new Date().toISOString(),
      };

      gateway.broadcastTrade('0xtoken', trade);

      expect(mockServer.emit).toHaveBeenCalledWith('new_trade', trade);
    });
  });
});
