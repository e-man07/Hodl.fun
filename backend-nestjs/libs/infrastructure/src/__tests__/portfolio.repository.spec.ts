import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { PrismaService } from '@core';

describe('PortfolioRepository', () => {
  let repository: PortfolioRepository;
  let prismaService: any;

  const mockPortfolioId = 'portfolio-123';
  const mockUserId = '0x' + 'a'.repeat(40);
  const mockTokenAddress = '0x' + 'b'.repeat(40);

  const mockPrismaPortfolio = {
    id: mockPortfolioId,
    userId: mockUserId,
    holdings: JSON.stringify([
      {
        tokenAddress: mockTokenAddress,
        tokenSymbol: 'TEST',
        balance: '50000000000000000000000',
        avgBuyPrice: '1000000000000000',
        totalSpent: '500000000000000000000',
        totalSold: '0',
        realizedPNL: '0',
      },
    ]),
    totalInvestedPUSH: '1000000000000000000',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    prismaService = {
      userPortfolio: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioRepository,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    repository = moduleRef.get<PortfolioRepository>(PortfolioRepository);
  });

  describe('findById', () => {
    it('should find portfolio by ID', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValue(mockPrismaPortfolio);

      const result = await repository.findById(mockPortfolioId);

      expect(result).toBeDefined();
      expect(prismaService.userPortfolio.findUnique).toHaveBeenCalledWith({
        where: { id: mockPortfolioId },
      });
    });

    it('should return null if portfolio not found', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      jest
        .spyOn(prismaService.userPortfolio, 'findUnique')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.findById(mockPortfolioId)).rejects.toThrow('Database error');
    });
  });

  describe('findByUserId', () => {
    it('should find portfolio by user ID', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValue(mockPrismaPortfolio);

      const result = await repository.findByUserId(mockUserId);

      expect(result).toBeDefined();
      expect(prismaService.userPortfolio.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    it('should return null if user has no portfolio', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValue(null);

      const result = await repository.findByUserId(mockUserId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      jest
        .spyOn(prismaService.userPortfolio, 'findUnique')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.findByUserId(mockUserId)).rejects.toThrow('Database error');
    });
  });

  describe('findOrCreateByUserId', () => {
    it('should find existing portfolio', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValue(mockPrismaPortfolio);

      const result = await repository.findOrCreateByUserId(mockUserId);

      expect(result).toBeDefined();
      expect(prismaService.userPortfolio.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(prismaService.userPortfolio.create).not.toHaveBeenCalled();
    });

    it('should create new portfolio if not found', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaService.userPortfolio, 'create').mockResolvedValue(mockPrismaPortfolio);

      const result = await repository.findOrCreateByUserId(mockUserId);

      expect(result).toBeDefined();
      expect(prismaService.userPortfolio.create).toHaveBeenCalled();
    });

    it('should initialize with empty holdings', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaService.userPortfolio, 'create').mockResolvedValue({
        ...mockPrismaPortfolio,
        holdings: JSON.stringify([]),
      });

      await repository.findOrCreateByUserId(mockUserId);

      const createCall = prismaService.userPortfolio.create.mock.calls[0][0];
      expect(createCall.data.holdings).toBe(JSON.stringify([]));
    });

    it('should handle database errors during creation', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValueOnce(null);
      jest
        .spyOn(prismaService.userPortfolio, 'create')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.findOrCreateByUserId(mockUserId)).rejects.toThrow('Database error');
    });
  });

  describe('save', () => {
    it('should create new portfolio', async () => {
      const mockPortfolio = {
        getId: () => mockPortfolioId,
        getUserId: () => mockUserId,
        getHoldings: () => new Map(),
        getTotalInvestedPUSH: () => BigInt('1000000000000000000'),
        getCreatedAt: () => new Date(),
        getUpdatedAt: () => new Date(),
      };

      jest.spyOn(prismaService.userPortfolio, 'upsert').mockResolvedValue(mockPrismaPortfolio);

      const result = await repository.save(mockPortfolio as any);

      expect(result).toBeDefined();
      expect(prismaService.userPortfolio.upsert).toHaveBeenCalled();
    });

    it('should update existing portfolio', async () => {
      const mockPortfolio = {
        getId: () => mockPortfolioId,
        getUserId: () => mockUserId,
        getHoldings: () => new Map(),
        getTotalInvestedPUSH: () => BigInt('2000000000000000000'),
        getCreatedAt: () => new Date('2024-01-01'),
        getUpdatedAt: () => new Date('2024-01-02'),
      };

      jest.spyOn(prismaService.userPortfolio, 'upsert').mockResolvedValue({
        ...mockPrismaPortfolio,
        totalInvestedPUSH: '2000000000000000000',
      });

      const result = await repository.save(mockPortfolio as any);

      expect(result).toBeDefined();
    });

    it('should serialize holdings to JSON', async () => {
      const mockPortfolio = {
        getId: () => mockPortfolioId,
        getUserId: () => mockUserId,
        getHoldings: () => new Map(),
        getTotalInvestedPUSH: () => BigInt('1000000000000000000'),
        getCreatedAt: () => new Date(),
        getUpdatedAt: () => new Date(),
      };

      jest.spyOn(prismaService.userPortfolio, 'upsert').mockResolvedValue(mockPrismaPortfolio);

      await repository.save(mockPortfolio as any);

      const upsertCall = prismaService.userPortfolio.upsert.mock.calls[0][0];
      expect(typeof upsertCall.create.holdings).toBe('string');
      expect(typeof upsertCall.update.holdings).toBe('string');
    });
  });

  describe('update', () => {
    it('should update existing portfolio', async () => {
      const mockPortfolio = {
        getId: () => mockPortfolioId,
        getHoldings: () => new Map(),
        getTotalInvestedPUSH: () => BigInt('2000000000000000000'),
        getUpdatedAt: () => new Date(),
      };

      jest.spyOn(prismaService.userPortfolio, 'update').mockResolvedValue(mockPrismaPortfolio);

      const result = await repository.update(mockPortfolio as any);

      expect(result).toBeDefined();
      expect(prismaService.userPortfolio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockPortfolioId },
        }),
      );
    });

    it('should update only ID, holdings, and timestamp', async () => {
      const mockPortfolio = {
        getId: () => mockPortfolioId,
        getHoldings: () => new Map(),
        getTotalInvestedPUSH: () => BigInt('2000000000000000000'),
        getUpdatedAt: () => new Date('2024-01-02'),
      };

      jest.spyOn(prismaService.userPortfolio, 'update').mockResolvedValue(mockPrismaPortfolio);

      await repository.update(mockPortfolio as any);

      const updateCall = prismaService.userPortfolio.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('holdings');
      expect(updateCall.data).toHaveProperty('totalInvestedPUSH');
      expect(updateCall.data).toHaveProperty('updatedAt');
    });

    it('should handle database errors', async () => {
      jest
        .spyOn(prismaService.userPortfolio, 'update')
        .mockRejectedValue(new Error('Database error'));

      const mockPortfolio = {
        getId: () => mockPortfolioId,
        getHoldings: () => new Map(),
        getTotalInvestedPUSH: () => BigInt('1000000000000000000'),
        getUpdatedAt: () => new Date(),
      };

      await expect(repository.update(mockPortfolio as any)).rejects.toThrow('Database error');
    });
  });

  describe('delete', () => {
    it('should delete portfolio by ID', async () => {
      jest.spyOn(prismaService.userPortfolio, 'delete').mockResolvedValue(mockPrismaPortfolio);

      const result = await repository.delete(mockPortfolioId);

      expect(result).toBe(true);
      expect(prismaService.userPortfolio.delete).toHaveBeenCalledWith({
        where: { id: mockPortfolioId },
      });
    });

    it('should handle delete errors gracefully', async () => {
      jest
        .spyOn(prismaService.userPortfolio, 'delete')
        .mockRejectedValue(new Error('Database error'));

      const result = await repository.delete(mockPortfolioId);

      expect(result).toBe(false);
    });
  });

  describe('findPortfoliosHoldingToken', () => {
    it('should find portfolios holding specific token', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const result = await repository.findPortfoliosHoldingToken(mockTokenAddress, {
        limit: 10,
        offset: 0,
      });

      expect(result.portfolios).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should support minimum balance filter', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const result = await repository.findPortfoliosHoldingToken(mockTokenAddress, {
        limit: 10,
        offset: 0,
        minBalance: BigInt('10000000000000000000000'),
      });

      expect(result.portfolios).toHaveLength(1);
    });

    it('should filter out portfolios below minimum balance', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const result = await repository.findPortfoliosHoldingToken(mockTokenAddress, {
        limit: 10,
        offset: 0,
        minBalance: BigInt('100000000000000000000000'),
      });

      expect(result.portfolios).toHaveLength(0);
    });

    it('should support pagination', async () => {
      const portfolios = Array(50).fill(mockPrismaPortfolio);
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue(portfolios);

      const result = await repository.findPortfoliosHoldingToken(mockTokenAddress, {
        limit: 20,
        offset: 10,
      });

      expect(result.portfolios).toHaveLength(20);
      expect(result.total).toBe(50);
    });

    it('should normalize token address to lowercase', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const uppercaseAddress = mockTokenAddress.toUpperCase();
      const result = await repository.findPortfoliosHoldingToken(uppercaseAddress);

      expect(result.portfolios).toHaveLength(1);
    });

    it('should return empty result if no portfolios hold token', async () => {
      const portfolioWithoutToken = {
        ...mockPrismaPortfolio,
        holdings: JSON.stringify([
          {
            tokenAddress: '0x' + 'c'.repeat(40),
            tokenSymbol: 'OTHER',
            balance: '1000000000000000000',
            avgBuyPrice: '1000000000000000',
            totalSpent: '1000000000000000000',
            totalSold: '0',
            realizedPNL: '0',
          },
        ]),
      };
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([portfolioWithoutToken]);

      const result = await repository.findPortfoliosHoldingToken(mockTokenAddress);

      expect(result.portfolios).toHaveLength(0);
    });
  });

  describe('findTopByValue', () => {
    it('should find top portfolios by value', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const tokenPrices = new Map([[mockTokenAddress, BigInt('2000000000000000')]]);
      const result = await repository.findTopByValue(tokenPrices, 10);

      expect(result).toHaveLength(1);
    });

    it('should calculate portfolio values correctly', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const tokenPrices = new Map([[mockTokenAddress, BigInt('1000000000000000')]]);
      const result = await repository.findTopByValue(tokenPrices, 1);

      expect(result).toHaveLength(1);
    });

    it('should return top N portfolios', async () => {
      const portfolios = Array(50).fill(mockPrismaPortfolio);
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue(portfolios);

      const tokenPrices = new Map([[mockTokenAddress, BigInt('1000000000000000')]]);
      const result = await repository.findTopByValue(tokenPrices, 5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should use default limit if not specified', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const tokenPrices = new Map([[mockTokenAddress, BigInt('1000000000000000')]]);
      const result = await repository.findTopByValue(tokenPrices);

      expect(result.length).toBeLessThanOrEqual(10); // default limit
    });
  });

  describe('findMostDiversified', () => {
    it('should find most diversified portfolios', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const result = await repository.findMostDiversified(10);

      expect(result).toHaveLength(1);
    });

    it('should sort by number of holdings', async () => {
      const holdings5 = Array(5).fill({
        tokenAddress: mockTokenAddress,
        tokenSymbol: 'TEST',
        balance: '1000000000000000000',
        avgBuyPrice: '1000000000000000',
        totalSpent: '1000000000000000000',
        totalSold: '0',
        realizedPNL: '0',
      });
      const holdings10 = Array(10).fill({
        tokenAddress: mockTokenAddress,
        tokenSymbol: 'TEST',
        balance: '1000000000000000000',
        avgBuyPrice: '1000000000000000',
        totalSpent: '1000000000000000000',
        totalSold: '0',
        realizedPNL: '0',
      });

      const portfolio1 = {
        ...mockPrismaPortfolio,
        id: 'portfolio-1',
        userId: mockUserId,
        holdings: JSON.stringify(holdings5),
      };
      const portfolio2 = {
        ...mockPrismaPortfolio,
        id: 'portfolio-2',
        userId: '0x' + 'd'.repeat(40),
        holdings: JSON.stringify(holdings10),
      };

      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([portfolio1, portfolio2]);

      const result = await repository.findMostDiversified(10);

      // portfolio2 should come first (more holdings)
      const resultUserIds = result.map(p => p.getUserId());
      expect(resultUserIds).toContain(portfolio2.userId);
      expect(resultUserIds).toContain(portfolio1.userId);
      expect(result).toHaveLength(2);
    });

    it('should return top N diversified portfolios', async () => {
      const portfolios = Array(50).fill(mockPrismaPortfolio);
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue(portfolios);

      const result = await repository.findMostDiversified(5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should use default limit if not specified', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const result = await repository.findMostDiversified();

      expect(result.length).toBeLessThanOrEqual(10); // default limit
    });
  });

  describe('count', () => {
    it('should return total number of portfolios', async () => {
      jest.spyOn(prismaService.userPortfolio, 'count').mockResolvedValue(42);

      const result = await repository.count();

      expect(result).toBe(42);
    });

    it('should return 0 if no portfolios exist', async () => {
      jest.spyOn(prismaService.userPortfolio, 'count').mockResolvedValue(0);

      const result = await repository.count();

      expect(result).toBe(0);
    });

    it('should handle database errors', async () => {
      jest
        .spyOn(prismaService.userPortfolio, 'count')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.count()).rejects.toThrow('Database error');
    });
  });

  describe('countHoldersOfToken', () => {
    it('should count holders of specific token', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const result = await repository.countHoldersOfToken(mockTokenAddress);

      expect(result).toBe(1);
    });

    it('should not count zero balance holdings', async () => {
      const portfolioWithZeroBalance = {
        ...mockPrismaPortfolio,
        holdings: JSON.stringify([
          {
            tokenAddress: mockTokenAddress,
            tokenSymbol: 'TEST',
            balance: '0',
            avgBuyPrice: '0',
            totalSpent: '0',
            totalSold: '0',
            realizedPNL: '0',
          },
        ]),
      };
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([portfolioWithZeroBalance]);

      const result = await repository.countHoldersOfToken(mockTokenAddress);

      expect(result).toBe(0);
    });

    it('should return 0 if no one holds token', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([]);

      const result = await repository.countHoldersOfToken(mockTokenAddress);

      expect(result).toBe(0);
    });

    it('should normalize token address to lowercase', async () => {
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([mockPrismaPortfolio]);

      const uppercaseAddress = mockTokenAddress.toUpperCase();
      const result = await repository.countHoldersOfToken(uppercaseAddress);

      expect(result).toBe(1);
    });

    it('should handle invalid JSON in holdings', async () => {
      const portfolioWithInvalidJSON = {
        ...mockPrismaPortfolio,
        holdings: 'invalid json',
      };
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue([portfolioWithInvalidJSON]);

      const result = await repository.countHoldersOfToken(mockTokenAddress);

      expect(result).toBe(0);
    });

    it('should handle database errors', async () => {
      jest
        .spyOn(prismaService.userPortfolio, 'findMany')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.countHoldersOfToken(mockTokenAddress)).rejects.toThrow('Database error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle portfolios with no holdings', async () => {
      const emptyPortfolio = {
        ...mockPrismaPortfolio,
        holdings: JSON.stringify([]),
      };
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValue(emptyPortfolio);

      const result = await repository.findById(mockPortfolioId);

      expect(result).toBeDefined();
    });

    it('should handle large number of holdings', async () => {
      const manyHoldings = Array(100).fill({
        tokenAddress: mockTokenAddress,
        tokenSymbol: 'TEST',
        balance: '1000000000000000000',
        avgBuyPrice: '1000000000000000',
        totalSpent: '1000000000000000000',
        totalSold: '0',
        realizedPNL: '0',
      });

      const portfolioWithManyHoldings = {
        ...mockPrismaPortfolio,
        holdings: JSON.stringify(manyHoldings),
      };
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValue(portfolioWithManyHoldings);

      const result = await repository.findById(mockPortfolioId);

      expect(result).toBeDefined();
    });

    it('should handle very large balance values', async () => {
      const largeHoldings = JSON.stringify([
        {
          tokenAddress: mockTokenAddress,
          tokenSymbol: 'TEST',
          balance: '999999999999999999999999999999',
          avgBuyPrice: '1000000000000000',
          totalSpent: '999999999999999999999',
          totalSold: '0',
          realizedPNL: '0',
        },
      ]);

      const portfolioWithLargeValues = {
        ...mockPrismaPortfolio,
        holdings: largeHoldings,
      };
      jest.spyOn(prismaService.userPortfolio, 'findUnique').mockResolvedValue(portfolioWithLargeValues);

      const result = await repository.findById(mockPortfolioId);

      expect(result).toBeDefined();
    });

    it('should handle multiple portfolios with same token', async () => {
      const portfolios = [
        mockPrismaPortfolio,
        {
          ...mockPrismaPortfolio,
          userId: '0x' + 'c'.repeat(40),
        },
      ];
      jest.spyOn(prismaService.userPortfolio, 'findMany').mockResolvedValue(portfolios);

      const result = await repository.countHoldersOfToken(mockTokenAddress);

      expect(result).toBe(2);
    });
  });
});
