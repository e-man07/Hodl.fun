import { Test, TestingModule } from '@nestjs/testing';
import { TradeRepository } from '../repositories/trade.repository';
import { PrismaService } from '@core';

describe('TradeRepository', () => {
  let repository: TradeRepository;
  let prismaService: any;

  const mockTokenId = 'token-123';
  const mockTradeId = 'trade-hash-123';
  const mockUser = '0x' + 'a'.repeat(40);

  const mockPrismaTrade = {
    hash: mockTradeId,
    tokenAddress: mockTokenId,
    type: 'BUY',
    userAddress: mockUser,
    amountIn: '1000000000000000000', // 1 ETH in wei
    amountOut: '50000000000000000000000', // 50000 tokens
    price: 0.02, // price per token in ETH
    timestamp: new Date('2024-01-01T12:00:00Z'),
    blockNumber: 1000n,
  };

  beforeEach(async () => {
    prismaService = {
      transaction: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TradeRepository,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    repository = moduleRef.get<TradeRepository>(TradeRepository);
  });

  describe('findById', () => {
    it('should find trade by ID (hash)', async () => {
      jest.spyOn(prismaService.transaction, 'findUnique').mockResolvedValue(mockPrismaTrade);

      const result = await repository.findById(mockTradeId);

      expect(result).toBeDefined();
      expect(prismaService.transaction.findUnique).toHaveBeenCalledWith({
        where: { hash: mockTradeId },
      });
    });

    it('should return null if trade not found', async () => {
      jest.spyOn(prismaService.transaction, 'findUnique').mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      jest
        .spyOn(prismaService.transaction, 'findUnique')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.findById(mockTradeId)).rejects.toThrow('Database error');
    });
  });

  describe('findByTokenId', () => {
    it('should find trades by token ID with pagination', async () => {
      const mockTrades = [mockPrismaTrade];
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue(mockTrades);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(1);

      const result = await repository.findByTokenId(mockTokenId, { limit: 10, offset: 0 });

      expect(result.trades).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenAddress: mockTokenId },
        }),
      );
    });

    it('should support custom sorting by timestamp', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(0);

      await repository.findByTokenId(mockTokenId, {
        limit: 20,
        offset: 0,
        orderBy: 'timestamp',
        orderDirection: 'asc',
      });

      const callArgs = prismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ timestamp: 'asc' });
    });

    it('should support sorting by price per token', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(0);

      await repository.findByTokenId(mockTokenId, {
        limit: 20,
        offset: 0,
        orderBy: 'pricePerToken',
        orderDirection: 'desc',
      });

      const callArgs = prismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ price: 'desc' });
    });

    it('should return empty result if no trades for token', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(0);

      const result = await repository.findByTokenId(mockTokenId);

      expect(result.trades).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findByUser', () => {
    it('should find trades by user address', async () => {
      const mockTrades = [mockPrismaTrade];
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue(mockTrades);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(1);

      const result = await repository.findByUser(mockUser, { limit: 20, offset: 0 });

      expect(result.trades).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userAddress: mockUser },
        }),
      );
    });

    it('should support sorting by timestamp', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(0);

      await repository.findByUser(mockUser, {
        limit: 20,
        offset: 0,
        orderBy: 'timestamp',
        orderDirection: 'asc',
      });

      const callArgs = prismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ timestamp: 'asc' });
    });

    it('should support sorting by total value', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(0);

      await repository.findByUser(mockUser, {
        limit: 20,
        offset: 0,
        orderBy: 'totalValue',
        orderDirection: 'desc',
      });

      const callArgs = prismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ price: 'desc' });
    });

    it('should return empty result if user has no trades', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(0);

      const result = await repository.findByUser(mockUser);

      expect(result.trades).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findByUserAndToken', () => {
    it('should find trades for specific user and token', async () => {
      const mockTrades = [mockPrismaTrade];
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue(mockTrades);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(1);

      const result = await repository.findByUserAndToken(mockUser, mockTokenId, {
        limit: 10,
        offset: 0,
      });

      expect(result.trades).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userAddress: mockUser, tokenAddress: mockTokenId },
        }),
      );
    });

    it('should return empty result if user has no trades for token', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(0);

      const result = await repository.findByUserAndToken(mockUser, mockTokenId);

      expect(result.trades).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should support pagination options', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(100);

      await repository.findByUserAndToken(mockUser, mockTokenId, { limit: 50, offset: 25 });

      const callArgs = prismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(50);
      expect(callArgs.skip).toBe(25);
    });
  });

  describe('save', () => {
    it('should save a new trade', async () => {
      const mockTrade = {
        id: mockTradeId,
        tokenId: mockTokenId,
        type: 'buy',
        user: mockUser,
        amountIn: BigInt('1000000000000000000'),
        amountOut: BigInt('50000000000000000000000'),
        pricePerToken: BigInt('20000000000000000'),
        totalValue: BigInt('1000000000000000000'),
        transactionHash: mockTradeId,
        blockNumber: 1000,
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      jest.spyOn(prismaService.transaction, 'create').mockResolvedValue(mockPrismaTrade);

      const result = await repository.save(mockTrade as any);

      expect(result).toBeDefined();
      expect(prismaService.transaction.create).toHaveBeenCalled();
    });

    it('should handle database errors when saving', async () => {
      jest
        .spyOn(prismaService.transaction, 'create')
        .mockRejectedValue(new Error('Database error'));

      const mockTrade = {
        id: mockTradeId,
        tokenId: mockTokenId,
        type: 'buy',
        user: mockUser,
        amountIn: BigInt('1000000000000000000'),
        amountOut: BigInt('50000000000000000000000'),
        pricePerToken: BigInt('20000000000000000'),
        totalValue: BigInt('1000000000000000000'),
        transactionHash: mockTradeId,
        blockNumber: 1000,
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      await expect(repository.save(mockTrade as any)).rejects.toThrow('Database error');
    });
  });

  describe('saveBatch', () => {
    it('should save multiple trades', async () => {
      const mockTrades = [mockPrismaTrade, { ...mockPrismaTrade, hash: 'trade-456', type: 'SELL' }];
      jest.spyOn(prismaService.transaction, 'create')
        .mockResolvedValueOnce(mockTrades[0])
        .mockResolvedValueOnce(mockTrades[1]);

      const trades = [
        {
          id: mockTradeId,
          tokenId: mockTokenId,
          type: 'buy',
          user: mockUser,
          amountIn: BigInt('1000000000000000000'),
          amountOut: BigInt('50000000000000000000000'),
          pricePerToken: BigInt('20000000000000000'),
          totalValue: BigInt('1000000000000000000'),
          transactionHash: mockTradeId,
          blockNumber: 1000,
          timestamp: new Date('2024-01-01T12:00:00Z'),
        },
        {
          id: 'trade-456',
          tokenId: mockTokenId,
          type: 'sell',
          user: mockUser,
          amountIn: BigInt('50000000000000000000000'),
          amountOut: BigInt('1000000000000000000'),
          pricePerToken: BigInt('20000000000000000'),
          totalValue: BigInt('1000000000000000000'),
          transactionHash: 'trade-456',
          blockNumber: 1001,
          timestamp: new Date('2024-01-01T12:00:01Z'),
        },
      ];

      const result = await repository.saveBatch(trades as any);

      expect(result).toHaveLength(2);
      expect(prismaService.transaction.create).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when saving batch', async () => {
      jest
        .spyOn(prismaService.transaction, 'create')
        .mockRejectedValue(new Error('Batch save error'));

      const trades = [
        {
          id: mockTradeId,
          tokenId: mockTokenId,
          type: 'buy',
          user: mockUser,
          amountIn: BigInt('1000000000000000000'),
          amountOut: BigInt('50000000000000000000000'),
          pricePerToken: BigInt('20000000000000000'),
          totalValue: BigInt('1000000000000000000'),
          transactionHash: mockTradeId,
          blockNumber: 1000,
          timestamp: new Date(),
        },
      ];

      await expect(repository.saveBatch(trades as any)).rejects.toThrow();
    });
  });

  describe('findAfterTimestamp', () => {
    it('should find trades after specific timestamp', async () => {
      const mockTrades = [mockPrismaTrade];
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue(mockTrades);

      const timestamp = new Date('2024-01-01T00:00:00Z');
      const result = await repository.findAfterTimestamp(timestamp, 100);

      expect(result).toHaveLength(1);
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: { gte: timestamp },
          }),
        }),
      );
    });

    it('should use default limit if not specified', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);

      const timestamp = new Date('2024-01-01T00:00:00Z');
      await repository.findAfterTimestamp(timestamp);

      const callArgs = prismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(1000); // default limit
    });
  });

  describe('findByBlockRange', () => {
    it('should find trades within block range', async () => {
      const mockTrades = [mockPrismaTrade];
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue(mockTrades);

      const result = await repository.findByBlockRange(1000, 2000, 100);

      expect(result).toHaveLength(1);
      expect(prismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            blockNumber: {
              gte: BigInt(1000),
              lte: BigInt(2000),
            },
          }),
        }),
      );
    });

    it('should use default limit if not specified', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);

      await repository.findByBlockRange(1000, 2000);

      const callArgs = prismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(1000); // default limit
    });

    it('should handle large block ranges', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);

      await repository.findByBlockRange(0, 10000000, 5000);

      const callArgs = prismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.where.blockNumber.gte).toBe(BigInt(0));
      expect(callArgs.where.blockNumber.lte).toBe(BigInt(10000000));
    });
  });

  describe('count', () => {
    it('should return total number of trades', async () => {
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(42);

      const result = await repository.count();

      expect(result).toBe(42);
    });

    it('should return 0 if no trades exist', async () => {
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(0);

      const result = await repository.count();

      expect(result).toBe(0);
    });
  });

  describe('getTokenStats', () => {
    it('should calculate token trading statistics', async () => {
      const buyTrades = [mockPrismaTrade];
      const sellTrade = { ...mockPrismaTrade, type: 'SELL', amountOut: '500000000000000000' };

      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockResolvedValueOnce(buyTrades)
        .mockResolvedValueOnce([sellTrade]);

      const result = await repository.getTokenStats(mockTokenId);

      expect(result.totalTrades).toBe(2);
      expect(result.totalBuyVolume).toBe(BigInt('1000000000000000000'));
      expect(result.totalSellVolume).toBe(BigInt('500000000000000000'));
      expect(result.uniqueTraders).toBe(1);
      expect(result.avgBuyPrice).toBeDefined();
      expect(result.avgSellPrice).toBeDefined();
    });

    it('should handle tokens with no trades', async () => {
      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repository.getTokenStats(mockTokenId);

      expect(result.totalTrades).toBe(0);
      expect(result.totalBuyVolume).toBe(0n);
      expect(result.totalSellVolume).toBe(0n);
      expect(result.uniqueTraders).toBe(0);
      expect(result.avgBuyPrice).toBe(0n);
      expect(result.avgSellPrice).toBe(0n);
    });

    it('should calculate unique traders correctly', async () => {
      const user2 = '0x' + 'c'.repeat(40);
      const buyTrades = [
        mockPrismaTrade,
        { ...mockPrismaTrade, userAddress: user2 },
      ];

      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockResolvedValueOnce(buyTrades)
        .mockResolvedValueOnce([]);

      const result = await repository.getTokenStats(mockTokenId);

      expect(result.uniqueTraders).toBe(2);
    });
  });

  describe('getUserStats', () => {
    it('should calculate user trading statistics', async () => {
      const buyTrades = [mockPrismaTrade];
      const sellTrade = {
        ...mockPrismaTrade,
        type: 'SELL',
        amountIn: '50000000000000000000000',
        amountOut: '1000000000000000000',
      };

      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockResolvedValueOnce(buyTrades)
        .mockResolvedValueOnce([sellTrade]);

      const result = await repository.getUserStats(mockUser);

      expect(result.totalTrades).toBe(2);
      expect(result.totalBuyVolume).toBe(BigInt('1000000000000000000'));
      expect(result.totalSellVolume).toBe(BigInt('1000000000000000000'));
      expect(result.totalTokensBought).toBeDefined();
      expect(result.totalTokensSold).toBeDefined();
      expect(result.realizedPNL).toBeDefined();
    });

    it('should return zero stats for user with no trades', async () => {
      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repository.getUserStats(mockUser);

      expect(result.totalTrades).toBe(0);
      expect(result.totalBuyVolume).toBe(0n);
      expect(result.totalSellVolume).toBe(0n);
      expect(result.realizedPNL).toBe(0n);
    });

    it('should calculate realized PNL correctly', async () => {
      const buyTrades = [{ ...mockPrismaTrade, amountIn: '1000000000000000000' }];
      const sellTrade = {
        ...mockPrismaTrade,
        type: 'SELL',
        amountIn: '500000000000000000000000',
        amountOut: '1500000000000000000',
      };

      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockResolvedValueOnce(buyTrades)
        .mockResolvedValueOnce([sellTrade]);

      const result = await repository.getUserStats(mockUser);

      // realizedPNL = totalSellVolume - totalBuyVolume = 1500 - 1000 = 500
      expect(result.realizedPNL).toBe(BigInt('500000000000000000'));
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in findByTokenId', async () => {
      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.findByTokenId(mockTokenId)).rejects.toThrow('Database error');
    });

    it('should handle database errors in findByUser', async () => {
      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.findByUser(mockUser)).rejects.toThrow('Database error');
    });

    it('should handle database errors in count', async () => {
      jest
        .spyOn(prismaService.transaction, 'count')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.count()).rejects.toThrow('Database error');
    });

    it('should handle errors in getTokenStats', async () => {
      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.getTokenStats(mockTokenId)).rejects.toThrow();
    });

    it('should handle errors in getUserStats', async () => {
      jest
        .spyOn(prismaService.transaction, 'findMany')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.getUserStats(mockUser)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large trade volumes', async () => {
      const largeTrade = {
        ...mockPrismaTrade,
        amountIn: '999999999999999999999999999',
        amountOut: '888888888888888888888888888',
      };
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([largeTrade]);

      const result = await repository.findAfterTimestamp(new Date(), 100);

      expect(result).toHaveLength(1);
    });

    it('should handle empty pagination results', async () => {
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.transaction, 'count').mockResolvedValue(1000);

      const result = await repository.findByTokenId(mockTokenId, {
        limit: 10,
        offset: 9999,
      });

      expect(result.trades).toHaveLength(0);
      expect(result.total).toBe(1000);
    });

    it('should handle multiple trades in same block', async () => {
      const trades = [
        mockPrismaTrade,
        { ...mockPrismaTrade, hash: 'trade-2' },
        { ...mockPrismaTrade, hash: 'trade-3' },
      ];
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue(trades);

      const result = await repository.findByBlockRange(1000, 1000, 100);

      expect(result).toHaveLength(3);
    });

    it('should handle zero amounts in trades', async () => {
      const zeroTrade = {
        ...mockPrismaTrade,
        amountIn: '0',
        amountOut: '0',
      };
      jest.spyOn(prismaService.transaction, 'findMany').mockResolvedValue([zeroTrade]);

      const result = await repository.findAfterTimestamp(new Date(), 100);

      expect(result).toHaveLength(1);
    });
  });
});
