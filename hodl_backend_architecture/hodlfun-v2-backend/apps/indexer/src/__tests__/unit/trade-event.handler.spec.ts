import { TradeEventHandler } from '../../event-processor/handlers/trade-event.handler';
import { ethers } from 'ethers';

describe('TradeEventHandler', () => {
  let handler: TradeEventHandler;
  let mockPrisma: any;
  let mockPubsub: any;
  let mockCache: any;
  let mockMetrics: any;
  let mockRpc: any;
  let mockConfigService: any;

  const TOKEN_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
  const TRADER_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12';
  const TX_HASH = '0x0000000000000000000000000000000000000000000000000000000000000001';

  beforeEach(() => {
    mockPrisma = {
      trade: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      holder: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      token: {
        update: jest.fn(),
      },
    };

    mockPubsub = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockCache = {
      invalidate: jest.fn().mockResolvedValue(undefined),
    };

    mockMetrics = {
      tradesTotal: { inc: jest.fn() },
      tradingVolume: { inc: jest.fn() },
      indexerEventsProcessed: { inc: jest.fn() },
    };

    mockRpc = {};

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'CORE_ADDRESS') return '0xcore';
        return undefined;
      }),
    };

    handler = new TradeEventHandler({
      prisma: mockPrisma,
      pubsub: mockPubsub,
      cache: mockCache,
      metrics: mockMetrics,
      rpc: mockRpc,
      configService: mockConfigService,
    });
  });

  describe('getSupportedEvents', () => {
    it('should return Buy and Sell events', () => {
      const events = handler.getSupportedEvents();
      expect(events).toContain('Buy');
      expect(events).toContain('Sell');
    });
  });

  describe('handle Buy event', () => {
    const createBuyParsed = () =>
      ({
        name: 'Buy',
        args: {
          token: TOKEN_ADDRESS,
          to: TRADER_ADDRESS,
          amountIn: BigInt('1000000000000000000'), // 1 PUSH
          amountOut: BigInt('100000000000000000000'), // 100 tokens
          price: BigInt('10000000000000000'), // 0.01 PUSH per token
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        },
      }) as unknown as ethers.LogDescription;

    const createLog = () =>
      ({
        transactionHash: TX_HASH,
        blockNumber: 12345,
        index: 0,
      }) as unknown as ethers.Log;

    it('should create a trade record for buy event', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await handler.handle(createBuyParsed(), createLog());

      expect(mockPrisma.trade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenAddress: TOKEN_ADDRESS.toLowerCase(),
          type: 'BUY',
          traderAddress: TRADER_ADDRESS.toLowerCase(),
          txHash: TX_HASH,
        }),
      });
    });

    it('should upsert holder balance on buy', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await handler.handle(createBuyParsed(), createLog());

      expect(mockPrisma.holder.upsert).toHaveBeenCalled();
    });

    it('should update token price on buy', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await handler.handle(createBuyParsed(), createLog());

      expect(mockPrisma.token.update).toHaveBeenCalledWith({
        where: { address: TOKEN_ADDRESS.toLowerCase() },
        data: expect.objectContaining({
          currentPrice: expect.any(String),
        }),
      });
    });

    it('should publish trade event on buy', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await handler.handle(createBuyParsed(), createLog());

      expect(mockPubsub.publish).toHaveBeenCalledWith('trade', expect.objectContaining({
        type: 'trade',
        tokenAddress: TOKEN_ADDRESS.toLowerCase(),
      }));
    });

    it('should invalidate caches on buy', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await handler.handle(createBuyParsed(), createLog());

      expect(mockCache.invalidate).toHaveBeenCalledWith(`token:${TOKEN_ADDRESS.toLowerCase()}`);
      expect(mockCache.invalidate).toHaveBeenCalledWith(`price:${TOKEN_ADDRESS.toLowerCase()}`);
    });

    it('should increment metrics on buy', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await handler.handle(createBuyParsed(), createLog());

      expect(mockMetrics.tradesTotal.inc).toHaveBeenCalledWith({ type: 'BUY', status: 'success' });
      expect(mockMetrics.tradingVolume.inc).toHaveBeenCalled();
      expect(mockMetrics.indexerEventsProcessed.inc).toHaveBeenCalledWith({ event_type: 'Buy' });
    });

    it('should skip duplicate trades', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({ id: 1, txHash: TX_HASH });

      await handler.handle(createBuyParsed(), createLog());

      expect(mockPrisma.trade.create).not.toHaveBeenCalled();
      expect(mockPubsub.publish).not.toHaveBeenCalled();
    });
  });

  describe('handle Sell event', () => {
    const createSellParsed = () =>
      ({
        name: 'Sell',
        args: {
          token: TOKEN_ADDRESS,
          from: TRADER_ADDRESS,
          to: TRADER_ADDRESS,
          amountIn: BigInt('100000000000000000000'), // 100 tokens
          amountOut: BigInt('900000000000000000'), // 0.9 PUSH (after fee)
          price: BigInt('10000000000000000'), // 0.01 PUSH per token
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        },
      }) as unknown as ethers.LogDescription;

    const createLog = () =>
      ({
        transactionHash: TX_HASH,
        blockNumber: 12345,
        index: 0,
      }) as unknown as ethers.Log;

    it('should create a trade record for sell event', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue({
        balance: '200000000000000000000', // 200 tokens
      });

      await handler.handle(createSellParsed(), createLog());

      expect(mockPrisma.trade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenAddress: TOKEN_ADDRESS.toLowerCase(),
          type: 'SELL',
          traderAddress: TRADER_ADDRESS.toLowerCase(),
          txHash: TX_HASH,
        }),
      });
    });

    it('should update holder balance on sell', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue({
        balance: '200000000000000000000', // 200 tokens
      });

      await handler.handle(createSellParsed(), createLog());

      expect(mockPrisma.holder.update).toHaveBeenCalled();
    });

    it('should publish trade event on sell', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue({
        balance: '200000000000000000000',
      });

      await handler.handle(createSellParsed(), createLog());

      expect(mockPubsub.publish).toHaveBeenCalledWith('trade', expect.objectContaining({
        type: 'trade',
        tokenAddress: TOKEN_ADDRESS.toLowerCase(),
        trade: expect.objectContaining({
          type: 'SELL',
        }),
      }));
    });

    it('should handle sell when balance would go negative', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue({
        balance: '50000000000000000000', // Only 50 tokens (less than selling 100)
      });

      await handler.handle(createSellParsed(), createLog());

      // Should still create trade but set balance to 0
      expect(mockPrisma.holder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: '0', // Should be clamped to 0
          }),
        }),
      );
    });
  });
});
