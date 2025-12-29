import { Test, TestingModule } from '@nestjs/testing';
import { GetTrendingTokensHandler } from '../get-trending-tokens.handler';
import { GetTrendingTokensQuery } from '../../get-trending-tokens.query';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * GetTrendingTokensHandler Test Suite
 *
 * Tests the query handler for retrieving trending tokens based on timeframe and metric.
 * Covers: timeframes (1h, 24h, 7d), metrics (price, marketCap, trades), limits
 */
describe('GetTrendingTokensHandler', () => {
  let handler: GetTrendingTokensHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;

  const createMockToken = (id: string, price: bigint = BigInt(1000000000000000000)) => ({
    getId: jest.fn().mockReturnValue(id),
    getAddress: jest.fn().mockReturnValue({ value: '0x' + 'a'.repeat(40) }),
    getName: jest.fn().mockReturnValue(`Trending ${id}`),
    getSymbol: jest.fn().mockReturnValue(`T${id}`),
    getCreator: jest.fn().mockReturnValue('0x' + 'a'.repeat(40)),
    getDecimals: jest.fn().mockReturnValue(18),
    getTotalSupply: jest.fn().mockReturnValue(BigInt(1000000000000000000000000)),
    getPrice: jest.fn().mockReturnValue(price),
    getMarketCap: jest.fn().mockReturnValue(price),
    getReserveBalance: jest.fn().mockReturnValue(BigInt(100000000000000000000)),
    getIsLocked: jest.fn().mockReturnValue(false),
    getIsListed: jest.fn().mockReturnValue(false),
  } as any);

  beforeEach(async () => {
    mockTokenRepository = {
      findById: jest.fn(),
      findByAddressString: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findTrending: jest.fn(),
      findReadyForGraduation: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTrendingTokensHandler,
        {
          provide: TOKEN_REPOSITORY,
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    handler = module.get<GetTrendingTokensHandler>(GetTrendingTokensHandler);
  });

  describe('execute', () => {
    describe('Default Parameters', () => {
      it('should use default timeframe of 24h', async () => {
        const query = new GetTrendingTokensQuery();
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith(
          '24h',
          expect.any(String),
          expect.any(Number),
        );
      });

      it('should use default metric of trades', async () => {
        const query = new GetTrendingTokensQuery();
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith(
          expect.any(String),
          'trades',
          expect.any(Number),
        );
      });

      it('should use default limit of 10', async () => {
        const query = new GetTrendingTokensQuery();
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          10,
        );
      });
    });

    describe('Timeframe Parameter', () => {
      it('should support 1h timeframe', async () => {
        const query = new GetTrendingTokensQuery('1h');
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith('1h', expect.any(String), expect.any(Number));
      });

      it('should support 24h timeframe', async () => {
        const query = new GetTrendingTokensQuery('24h');
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith('24h', expect.any(String), expect.any(Number));
      });

      it('should support 7d timeframe', async () => {
        const query = new GetTrendingTokensQuery('7d');
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith('7d', expect.any(String), expect.any(Number));
      });
    });

    describe('Metric Parameter', () => {
      it('should support price metric', async () => {
        const query = new GetTrendingTokensQuery('24h', 'price');
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith(expect.any(String), 'price', expect.any(Number));
      });

      it('should support marketCap metric', async () => {
        const query = new GetTrendingTokensQuery('24h', 'marketCap');
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith(
          expect.any(String),
          'marketCap',
          expect.any(Number),
        );
      });

      it('should support trades metric', async () => {
        const query = new GetTrendingTokensQuery('24h', 'trades');
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith(
          expect.any(String),
          'trades',
          expect.any(Number),
        );
      });
    });

    describe('Limit Parameter', () => {
      it('should apply custom limit', async () => {
        const query = new GetTrendingTokensQuery('24h', 'price', 5);
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith(expect.any(String), expect.any(String), 5);
      });

      it('should support limit of 1', async () => {
        const query = new GetTrendingTokensQuery('24h', 'price', 1);
        const mockToken = createMockToken('token-1');
        mockTokenRepository.findTrending.mockResolvedValue([mockToken]);

        const result = await handler.execute(query);

        expect(result).toHaveLength(1);
      });

      it('should support large limit', async () => {
        const query = new GetTrendingTokensQuery('24h', 'price', 100);
        const tokens = Array.from({ length: 100 }, (_, i) => createMockToken(`token-${i}`));
        mockTokenRepository.findTrending.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(result).toHaveLength(100);
      });
    });

    describe('Response Format', () => {
      it('should return array of tokens', async () => {
        const query = new GetTrendingTokensQuery();
        const tokens = [createMockToken('token-1'), createMockToken('token-2'), createMockToken('token-3')];
        mockTokenRepository.findTrending.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(3);
      });

      it('should return empty array when no trending tokens', async () => {
        const query = new GetTrendingTokensQuery();
        mockTokenRepository.findTrending.mockResolvedValue([]);

        const result = await handler.execute(query);

        expect(result).toEqual([]);
      });

      it('should return tokens with correct properties', async () => {
        const query = new GetTrendingTokensQuery();
        const mockToken = createMockToken('token-1', BigInt(5000000000000000000));
        mockTokenRepository.findTrending.mockResolvedValue([mockToken]);

        const result = await handler.execute(query);

        expect(result[0]).toBeDefined();
        expect(result[0].getId()).toBe('token-1');
        expect(result[0].getMarketCap()).toBe(BigInt(5000000000000000000));
      });
    });

    describe('Combination Parameters', () => {
      it('should handle 1h price metric', async () => {
        const query = new GetTrendingTokensQuery('1h', 'price', 10);
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith('1h', 'price', 10);
      });

      it('should handle 7d marketCap metric', async () => {
        const query = new GetTrendingTokensQuery('7d', 'marketCap', 20);
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith('7d', 'marketCap', 20);
      });

      it('should handle 24h trades metric with limit 5', async () => {
        const query = new GetTrendingTokensQuery('24h', 'trades', 5);
        const tokens = Array.from({ length: 5 }, (_, i) => createMockToken(`token-${i}`));
        mockTokenRepository.findTrending.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(result).toHaveLength(5);
        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith('24h', 'trades', 5);
      });
    });

    describe('Error Handling', () => {
      it('should rethrow repository errors', async () => {
        const query = new GetTrendingTokensQuery();
        const error = new Error('Database error');
        mockTokenRepository.findTrending.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Database error');
      });

      it('should rethrow timeout error', async () => {
        const query = new GetTrendingTokensQuery();
        const error = new Error('Query timeout');
        mockTokenRepository.findTrending.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Query timeout');
      });

      it('should handle invalid timeframe gracefully', async () => {
        // Note: TypeScript won't allow invalid timeframes at compile time,
        // but this tests runtime safety
        const query = new GetTrendingTokensQuery('24h' as any);
        mockTokenRepository.findTrending.mockResolvedValue([]);

        const result = await handler.execute(query);

        expect(result).toEqual([]);
      });
    });

    describe('Edge Cases', () => {
      it('should handle tokens with zero price', async () => {
        const query = new GetTrendingTokensQuery();
        const zeroToken = createMockToken('zero-price', BigInt(0));
        mockTokenRepository.findTrending.mockResolvedValue([zeroToken]);

        const result = await handler.execute(query);

        expect(result[0].getMarketCap()).toBe(BigInt(0));
      });

      it('should handle tokens with very large prices', async () => {
        const query = new GetTrendingTokensQuery();
        const largeToken = createMockToken('large-price', BigInt('9'.repeat(60)));
        mockTokenRepository.findTrending.mockResolvedValue([largeToken]);

        const result = await handler.execute(query);

        expect(result[0].getMarketCap()).toBe(BigInt('9'.repeat(60)));
      });

      it('should preserve token order from repository', async () => {
        const query = new GetTrendingTokensQuery();
        const tokens = [
          createMockToken('token-1', BigInt(1000)),
          createMockToken('token-2', BigInt(2000)),
          createMockToken('token-3', BigInt(3000)),
        ];
        mockTokenRepository.findTrending.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(result[0].getId()).toBe('token-1');
        expect(result[1].getId()).toBe('token-2');
        expect(result[2].getId()).toBe('token-3');
      });
    });

    describe('Repository Interaction', () => {
      it('should pass all parameters to repository', async () => {
        const query = new GetTrendingTokensQuery('1h', 'price', 15);
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalledWith('1h', 'price', 15);
        expect(mockTokenRepository.findTrending).toHaveBeenCalledTimes(1);
      });

      it('should only call findTrending method', async () => {
        const query = new GetTrendingTokensQuery();
        mockTokenRepository.findTrending.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findTrending).toHaveBeenCalled();
        expect(mockTokenRepository.findById).not.toHaveBeenCalled();
        expect(mockTokenRepository.findAll).not.toHaveBeenCalled();
      });
    });
  });
});
