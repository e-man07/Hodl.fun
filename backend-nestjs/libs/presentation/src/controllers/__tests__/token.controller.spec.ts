import { Test, TestingModule } from '@nestjs/testing';
import { TokenController } from '../token.controller';
import { QueryBus, CommandBus } from '@nestjs/cqrs';

describe('TokenController', () => {
  let controller: TokenController;
  let queryBus: any;
  let commandBus: any;

  const mockTokenAddress = '0x' + 'a'.repeat(40);
  const mockCreator = '0x' + 'b'.repeat(40);

  const mockToken = {
    id: { value: 'token-123' },
    address: { value: mockTokenAddress },
    name: 'Test Token',
    symbol: 'TEST',
    creator: { value: mockCreator },
    decimals: 18,
    totalSupply: BigInt('1000000000000000000000000'),
    currentPrice: { toString: () => '2000000000000000000' },
    marketCap: { toString: () => '2000000000000000000000000' },
    athPrice: { toString: () => '2000000000000000000' },
    athMarketCap: { toString: () => '2000000000000000000000000' },
    athPriceTimestamp: new Date('2024-01-01'),
    athMarketCapTimestamp: new Date('2024-01-01'),
    isLocked: false,
    isListed: false,
    uniswapV3Pool: null,
    listingTimestamp: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    holdersCount: 10,
    volume24h: { toString: () => '1000000000000000000' },
    priceChange24h: 5.25,
  };

  beforeEach(async () => {
    queryBus = {
      execute: jest.fn(),
    };

    commandBus = {
      execute: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TokenController],
      providers: [
        {
          provide: QueryBus,
          useValue: queryBus,
        },
        {
          provide: CommandBus,
          useValue: commandBus,
        },
      ],
    }).compile();

    controller = moduleRef.get<TokenController>(TokenController);
  });

  describe('create', () => {
    it('should create token successfully', async () => {
      commandBus.execute.mockResolvedValue(mockToken);

      const createTokenDto = {
        name: 'Test Token',
        symbol: 'TEST',
        description: 'A test token',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const result = await controller.create(createTokenDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Token');
      expect(result.symbol).toBe('TEST');
      expect(commandBus.execute).toHaveBeenCalled();
    });

    it('should return created token response', async () => {
      commandBus.execute.mockResolvedValue(mockToken);

      const createTokenDto = {
        name: 'Test Token',
        symbol: 'TEST',
        description: 'A test token',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const result = await controller.create(createTokenDto);

      expect(result.id).toBe('token-123');
      expect(result.address).toBe(mockTokenAddress);
      expect(result.creator).toBe(mockCreator);
    });

    it('should pass correct data to command bus', async () => {
      commandBus.execute.mockResolvedValue(mockToken);

      const createTokenDto = {
        name: 'Custom Token',
        symbol: 'CUSTOM',
        description: 'A custom token',
        logoUrl: 'https://example.com/custom-logo.png',
        metadataUri: 'ipfs://custom-metadata',
      };

      await controller.create(createTokenDto);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Custom Token',
          symbol: 'CUSTOM',
        }),
      );
    });

    it('should handle command bus errors', async () => {
      commandBus.execute.mockRejectedValue(new Error('Creation failed'));

      const createTokenDto = {
        name: 'Test Token',
        symbol: 'TEST',
        description: 'A test token',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      await expect(controller.create(createTokenDto)).rejects.toThrow('Creation failed');
    });
  });

  describe('getByAddress', () => {
    it('should get token by address', async () => {
      queryBus.execute.mockResolvedValue(mockToken);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result).toBeDefined();
      expect(result.address).toBe(mockTokenAddress);
    });

    it('should pass address to query bus', async () => {
      queryBus.execute.mockResolvedValue(mockToken);

      await controller.getByAddress(mockTokenAddress);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockTokenAddress,
        }),
      );
    });

    it('should throw error if token not found', async () => {
      queryBus.execute.mockResolvedValue(null);

      await expect(controller.getByAddress('0x' + 'c'.repeat(40))).rejects.toThrow(
        'Token not found',
      );
    });

    it('should handle query bus errors', async () => {
      queryBus.execute.mockRejectedValue(new Error('Query failed'));

      await expect(controller.getByAddress(mockTokenAddress)).rejects.toThrow(
        'Query failed',
      );
    });

    it('should handle different address formats', async () => {
      queryBus.execute.mockResolvedValue(mockToken);

      const addresses = [
        '0x' + 'a'.repeat(40),
        '0x' + 'b'.repeat(40),
        '0x' + 'c'.repeat(40),
      ];

      for (const address of addresses) {
        const result = await controller.getByAddress(address);
        expect(result).toBeDefined();
      }

      expect(queryBus.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('Response Format', () => {
    it('should return correctly formatted token response', async () => {
      commandBus.execute.mockResolvedValue(mockToken);

      const createTokenDto = {
        name: 'Test Token',
        symbol: 'TEST',
        description: 'A test token',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const result = await controller.create(createTokenDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('creator');
      expect(result).toHaveProperty('decimals');
      expect(result).toHaveProperty('totalSupply');
      expect(result).toHaveProperty('currentPrice');
      expect(result).toHaveProperty('marketCap');
    });

    it('should convert BigInt values to strings', async () => {
      commandBus.execute.mockResolvedValue(mockToken);

      const createTokenDto = {
        name: 'Test Token',
        symbol: 'TEST',
        description: 'A test token',
        logoUrl: 'https://example.com/logo.png',
        metadataUri: 'ipfs://metadata',
      };

      const result = await controller.create(createTokenDto);

      expect(typeof result.totalSupply).toBe('string');
      expect(typeof result.currentPrice).toBe('string');
      expect(typeof result.marketCap).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle token with null uniswap pool', async () => {
      const tokenWithoutPool = { ...mockToken, uniswapV3Pool: null };
      queryBus.execute.mockResolvedValue(tokenWithoutPool);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result.uniswapV3Pool).toBeNull();
    });

    it('should handle token with listing timestamp', async () => {
      const tokenWithListing = {
        ...mockToken,
        listingTimestamp: new Date('2024-01-15'),
      };
      queryBus.execute.mockResolvedValue(tokenWithListing);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result.listingTimestamp).toBeDefined();
    });

    it('should handle locked tokens', async () => {
      const lockedToken = { ...mockToken, isLocked: true };
      queryBus.execute.mockResolvedValue(lockedToken);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result.isLocked).toBe(true);
    });

    it('should handle listed tokens', async () => {
      const listedToken = { ...mockToken, isListed: true };
      queryBus.execute.mockResolvedValue(listedToken);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result.isListed).toBe(true);
    });

    it('should handle tokens with high holder count', async () => {
      const populToken = { ...mockToken, holdersCount: 100000 };
      queryBus.execute.mockResolvedValue(populToken);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result.holdersCount).toBe(100000);
    });

    it('should handle tokens with large volumes', async () => {
      const highVolumeToken = {
        ...mockToken,
        volume24h: { toString: () => '999999999999999999999999999' },
      };
      queryBus.execute.mockResolvedValue(highVolumeToken);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result.volume24h).toBe('999999999999999999999999999');
    });

    it('should handle tokens with negative price change', async () => {
      const downToken = { ...mockToken, priceChange24h: -10.5 };
      queryBus.execute.mockResolvedValue(downToken);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result.priceChange24h).toBe(-10.5);
    });

    it('should handle tokens with zero price change', async () => {
      const stableToken = { ...mockToken, priceChange24h: 0 };
      queryBus.execute.mockResolvedValue(stableToken);

      const result = await controller.getByAddress(mockTokenAddress);

      expect(result.priceChange24h).toBe(0);
    });

    it('should handle multiple sequential requests', async () => {
      queryBus.execute.mockResolvedValue(mockToken);

      const address1 = '0x' + 'a'.repeat(40);
      const address2 = '0x' + 'b'.repeat(40);
      const address3 = '0x' + 'c'.repeat(40);

      const result1 = await controller.getByAddress(address1);
      const result2 = await controller.getByAddress(address2);
      const result3 = await controller.getByAddress(address3);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
      expect(queryBus.execute).toHaveBeenCalledTimes(3);
    });
  });
});
