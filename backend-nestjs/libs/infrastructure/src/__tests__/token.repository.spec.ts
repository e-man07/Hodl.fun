import { Test, TestingModule } from '@nestjs/testing';
import { TokenRepository } from '../repositories/token.repository';
import { PrismaService } from '@core';
import { TokenAddress } from '@domain';

describe('TokenRepository', () => {
  let repository: TokenRepository;
  let prismaService: any;

  const mockTokenId = 'token-123';
  const mockTokenAddress = '0x' + 'a'.repeat(40);
  const mockCreator = '0x' + 'b'.repeat(40);

  const mockPrismaToken = {
    id: mockTokenId,
    address: mockTokenAddress,
    name: 'Test Token',
    symbol: 'TEST',
    creator: mockCreator,
    decimals: 18,
    totalSupply: '1000000000000000000000000',
    currentPrice: '1000000000000000000',
    marketCap: '1000000000000000000000000',
    athPrice: '1000000000000000000',
    athMarketCap: '1000000000000000000000000',
    athPriceTimestamp: new Date('2024-01-01'),
    athMarketCapTimestamp: new Date('2024-01-01'),
    isLocked: false,
    isListed: false,
    uniswapV3Pool: null,
    listingTimestamp: null,
    holdersCount: 0,
    volume24h: '0',
    priceChange24h: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    graduationThreshold: '100000000000000000000',
    realNativeReserve: '1000000000000000000',
    realTokenReserve: '500000000000000000000000',
    virtualNativeReserve: '10000000000000000000',
    virtualTokenReserve: '5000000000000000000000000',
  };

  beforeEach(async () => {
    prismaService = {
      token: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TokenRepository,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    repository = moduleRef.get<TokenRepository>(TokenRepository);
  });

  describe('findById', () => {
    it('should find token by ID', async () => {
      jest.spyOn(prismaService.token, 'findUnique').mockResolvedValue(mockPrismaToken);

      const result = await repository.findById(mockTokenId);

      expect(result).toBeDefined();
      expect(prismaService.token.findUnique).toHaveBeenCalledWith({
        where: { id: mockTokenId },
      });
    });

    it('should return null if token not found', async () => {
      jest.spyOn(prismaService.token, 'findUnique').mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      jest
        .spyOn(prismaService.token, 'findUnique')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.findById(mockTokenId)).rejects.toThrow('Database error');
    });
  });

  describe('findByAddress', () => {
    it('should find token by TokenAddress value object', async () => {
      jest.spyOn(prismaService.token, 'findUnique').mockResolvedValue(mockPrismaToken);

      const tokenAddress = TokenAddress.create(mockTokenAddress);
      const result = await repository.findByAddress(tokenAddress);

      expect(result).toBeDefined();
      expect(prismaService.token.findUnique).toHaveBeenCalledWith({
        where: { address: mockTokenAddress.toLowerCase() },
      });
    });

    it('should normalize address to lowercase', async () => {
      jest.spyOn(prismaService.token, 'findUnique').mockResolvedValue(mockPrismaToken);

      const uppercaseAddress = mockTokenAddress.toUpperCase();
      const tokenAddress = TokenAddress.create(uppercaseAddress);
      await repository.findByAddress(tokenAddress);

      expect(prismaService.token.findUnique).toHaveBeenCalledWith({
        where: { address: mockTokenAddress.toLowerCase() },
      });
    });

    it('should return null if token not found by address', async () => {
      jest.spyOn(prismaService.token, 'findUnique').mockResolvedValue(null);

      const tokenAddress = TokenAddress.create(mockTokenAddress);
      const result = await repository.findByAddress(tokenAddress);

      expect(result).toBeNull();
    });
  });

  describe('findByAddressString', () => {
    it('should find token by address string', async () => {
      jest.spyOn(prismaService.token, 'findUnique').mockResolvedValue(mockPrismaToken);

      const result = await repository.findByAddressString(mockTokenAddress);

      expect(result).toBeDefined();
      expect(prismaService.token.findUnique).toHaveBeenCalledWith({
        where: { address: mockTokenAddress.toLowerCase() },
      });
    });

    it('should handle uppercase address strings', async () => {
      jest.spyOn(prismaService.token, 'findUnique').mockResolvedValue(mockPrismaToken);

      const uppercaseAddress = mockTokenAddress.toUpperCase();
      await repository.findByAddressString(uppercaseAddress);

      expect(prismaService.token.findUnique).toHaveBeenCalledWith({
        where: { address: mockTokenAddress.toLowerCase() },
      });
    });
  });

  describe('findAll', () => {
    it('should retrieve all tokens with pagination', async () => {
      const mockTokens = [mockPrismaToken];
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue(mockTokens);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(1);

      const result = await repository.findAll({}, { limit: 10, offset: 0 });

      expect(result.tokens).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaService.token.findMany).toHaveBeenCalled();
    });

    it('should support custom pagination', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(100);

      await repository.findAll({}, { limit: 20, offset: 40 });

      const callArgs = prismaService.token.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(20);
      expect(callArgs.skip).toBe(40);
    });

    it('should support custom sorting', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(1);

      await repository.findAll({}, { limit: 10, offset: 0, orderBy: 'currentPrice', orderDirection: 'asc' });

      const callArgs = prismaService.token.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ currentPrice: 'asc' });
    });

    it('should support filtering by creator', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([mockPrismaToken]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(1);

      const result = await repository.findAll({ creator: mockCreator }, { limit: 10, offset: 0 });

      expect(result.tokens).toHaveLength(1);
      expect(prismaService.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ creator: mockCreator }),
        }),
      );
    });

    it('should support filtering by lock status', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(0);

      await repository.findAll({ isLocked: false }, { limit: 10, offset: 0 });

      expect(prismaService.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isLocked: false }),
        }),
      );
    });
  });

  describe('findByCreator', () => {
    it('should find tokens created by specific user', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([mockPrismaToken]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(1);

      const result = await repository.findByCreator(mockCreator);

      expect(result.tokens).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaService.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { creator: mockCreator },
        }),
      );
    });

    it('should return empty result if creator has no tokens', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(0);

      const result = await repository.findByCreator('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');

      expect(result.tokens).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should support pagination options', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(0);

      await repository.findByCreator(mockCreator, { limit: 20, offset: 10 });

      const callArgs = prismaService.token.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(20);
      expect(callArgs.skip).toBe(10);
    });
  });

  describe('count', () => {
    it('should return total number of tokens', async () => {
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(42);

      const result = await repository.count();

      expect(result).toBe(42);
    });

    it('should return 0 if no tokens exist', async () => {
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(0);

      const result = await repository.count();

      expect(result).toBe(0);
    });
  });

  describe('save', () => {
    it('should create new token', async () => {
      const mockToken = {
        getId: () => mockTokenId,
        getAddress: () => TokenAddress.create(mockTokenAddress),
        getName: () => 'Test Token',
        getSymbol: () => 'TEST',
        getCreator: () => mockCreator,
        getDecimals: () => 18,
        getTotalSupply: () => BigInt('1000000000000000000000000'),
        getCurrentPrice: () => ({ toBigInt: () => BigInt('1000000000000000000') }),
        getMarketCap: () => ({ toBigInt: () => BigInt('1000000000000000000000000') }),
        getATHPrice: () => ({ toBigInt: () => BigInt('1000000000000000000') }),
        getATHMarketCap: () => ({ toBigInt: () => BigInt('1000000000000000000000000') }),
        getATHPriceTimestamp: () => new Date(),
        getATHMarketCapTimestamp: () => new Date(),
        getIsLocked: () => false,
        getIsListed: () => false,
        getUniswapV3Pool: () => null,
        getListingTimestamp: () => null,
        getCreatedAt: () => new Date(),
        getUpdatedAt: () => new Date(),
        getGraduationThreshold: () => ({ toBigInt: () => BigInt('100000000000000000000') }),
        getReserveBalance: () => ({
          realNativeReserve: BigInt('1000000000000000000'),
          realTokenReserve: BigInt('500000000000000000000000'),
          virtualNativeReserve: BigInt('10000000000000000000'),
          virtualTokenReserve: BigInt('5000000000000000000000000'),
        }),
      };

      jest.spyOn(prismaService.token, 'create').mockResolvedValue(mockPrismaToken);

      const result = await repository.save(mockToken as any);

      expect(prismaService.token.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update existing token', async () => {
      const mockToken = {
        getId: () => mockTokenId,
        getAddress: () => TokenAddress.create(mockTokenAddress),
        getName: () => 'Updated Token',
        getSymbol: () => 'TEST',
        getCreator: () => mockCreator,
        getDecimals: () => 18,
        getCurrentPrice: () => ({ toBigInt: () => BigInt('2000000000000000000') }),
        getMarketCap: () => ({ toBigInt: () => BigInt('2000000000000000000000000') }),
        getATHPrice: () => ({ toBigInt: () => BigInt('2000000000000000000') }),
        getATHMarketCap: () => ({ toBigInt: () => BigInt('2000000000000000000000000') }),
        getATHPriceTimestamp: () => new Date(),
        getATHMarketCapTimestamp: () => new Date(),
        getIsLocked: () => true,
        getIsListed: () => false,
        getUniswapV3Pool: () => null,
        getListingTimestamp: () => null,
        getUpdatedAt: () => new Date(),
        getGraduationThreshold: () => ({ toBigInt: () => BigInt('100000000000000000000') }),
        getReserveBalance: () => ({
          realNativeReserve: BigInt('2000000000000000000'),
          realTokenReserve: BigInt('600000000000000000000000'),
          virtualNativeReserve: BigInt('20000000000000000000'),
          virtualTokenReserve: BigInt('6000000000000000000000000'),
        }),
      };

      jest.spyOn(prismaService.token, 'update').mockResolvedValue(mockPrismaToken);

      const result = await repository.update(mockToken as any);

      expect(prismaService.token.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTokenId },
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete token by ID', async () => {
      jest.spyOn(prismaService.token, 'delete').mockResolvedValue(mockPrismaToken);

      const result = await repository.delete(mockTokenId);

      expect(result).toBe(true);
      expect(prismaService.token.delete).toHaveBeenCalledWith({
        where: { id: mockTokenId },
      });
    });

    it('should handle delete errors gracefully', async () => {
      jest
        .spyOn(prismaService.token, 'delete')
        .mockRejectedValue(new Error('Database error'));

      const result = await repository.delete(mockTokenId);

      expect(result).toBe(false);
    });
  });

  describe('findReadyForGraduation', () => {
    it('should find tokens ready to graduate to Uniswap', async () => {
      const readyToken = { ...mockPrismaToken, isLocked: false, marketCap: '101000000000000000000' };
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([readyToken]);

      const result = await repository.findReadyForGraduation();

      expect(result).toHaveLength(1);
      expect(prismaService.token.findMany).toHaveBeenCalled();
    });

    it('should support pagination for graduation ready tokens', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);

      await repository.findReadyForGraduation(10);

      const callArgs = prismaService.token.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(10);
    });
  });

  describe('findLockedNotListed', () => {
    it('should find locked but not listed tokens', async () => {
      const lockedToken = { ...mockPrismaToken, isLocked: true, isListed: false };
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([lockedToken]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(1);

      const result = await repository.findLockedNotListed();

      expect(result.tokens).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaService.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isLocked: true,
            isListed: false,
          },
        }),
      );
    });

    it('should support pagination for locked not listed tokens', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(0);

      await repository.findLockedNotListed({ limit: 50, offset: 10 });

      const callArgs = prismaService.token.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(50);
      expect(callArgs.skip).toBe(10);
    });
  });

  describe('findListed', () => {
    it('should find listed tokens on Uniswap V3', async () => {
      const listedToken = { ...mockPrismaToken, isListed: true };
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([listedToken]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(1);

      const result = await repository.findListed();

      expect(result.tokens).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prismaService.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isListed: true },
        }),
      );
    });

    it('should support pagination for listed tokens', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(0);

      await repository.findListed({ limit: 30, offset: 5 });

      const callArgs = prismaService.token.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(30);
      expect(callArgs.skip).toBe(5);
    });
  });

  describe('findByAddresses', () => {
    it('should find tokens by multiple addresses', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([mockPrismaToken]);

      const addresses = [mockTokenAddress, '0x' + 'c'.repeat(40)];
      const result = await repository.findByAddresses(addresses);

      expect(result).toBeDefined();
      expect(prismaService.token.findMany).toHaveBeenCalled();
    });

    it('should return map of addresses to tokens', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([mockPrismaToken]);

      const addresses = [mockTokenAddress];
      const result = await repository.findByAddresses(addresses);

      expect(result instanceof Map).toBe(true);
    });
  });

  describe('findTrending', () => {
    it('should find trending tokens by price', async () => {
      const trendingToken = { ...mockPrismaToken, priceChange24h: 50 };
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([trendingToken]);

      const result = await repository.findTrending('1h', 'price', 10);

      expect(result).toHaveLength(1);
      expect(prismaService.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isLocked: false },
          orderBy: { currentPrice: 'desc' },
          take: 10,
        }),
      );
    });

    it('should find trending tokens by market cap', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([mockPrismaToken]);

      const result = await repository.findTrending('24h', 'marketCap', 10);

      expect(result).toHaveLength(1);
      expect(prismaService.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { marketCap: 'desc' },
        }),
      );
    });

    it('should find trending tokens by trade activity', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([mockPrismaToken]);

      const result = await repository.findTrending('7d', 'trades', 20);

      expect(result).toHaveLength(1);
      expect(prismaService.token.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        }),
      );
    });

    it('should use default limit if not specified', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);

      await repository.findTrending('1h', 'price');

      const callArgs = prismaService.token.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(10); // default limit
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in findAll', async () => {
      jest
        .spyOn(prismaService.token, 'findMany')
        .mockRejectedValue(new Error('Database error'));

      await expect(repository.findAll({}, { limit: 10, offset: 0 })).rejects.toThrow('Database error');
    });

    it('should handle database errors in findByCreator', async () => {
      jest
        .spyOn(prismaService.token, 'findMany')
        .mockRejectedValue(new Error('Database error'));

      await expect(
        repository.findByCreator(mockCreator),
      ).rejects.toThrow('Database error');
    });

    it('should handle connection timeouts', async () => {
      jest
        .spyOn(prismaService.token, 'count')
        .mockRejectedValue(new Error('Connection timeout'));

      await expect(repository.count()).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result sets', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(0);

      const result = await repository.findAll({}, { limit: 10, offset: 0 });

      expect(result.tokens).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle large pagination offsets', async () => {
      jest.spyOn(prismaService.token, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.token, 'count').mockResolvedValue(10000);

      await repository.findAll({}, { limit: 50, offset: 9950 });

      const callArgs = prismaService.token.findMany.mock.calls[0][0];
      expect(callArgs.take).toBe(50);
      expect(callArgs.skip).toBe(9950);
    });

    it('should handle mixed case addresses', async () => {
      jest.spyOn(prismaService.token, 'findUnique').mockResolvedValue(mockPrismaToken);

      const mixedCaseAddress = mockTokenAddress.substring(0, 10).toUpperCase() +
        mockTokenAddress.substring(10);

      await repository.findByAddressString(mixedCaseAddress);

      expect(prismaService.token.findUnique).toHaveBeenCalledWith({
        where: { address: mockTokenAddress.toLowerCase() },
      });
    });
  });
});
