import { Test, TestingModule } from '@nestjs/testing';
import { GetTokensHandler } from '../get-tokens.handler';
import { GetTokensQuery } from '../../get-tokens.query';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * GetTokensHandler Test Suite
 *
 * Tests the query handler for retrieving paginated token lists with filters.
 * Covers: pagination, filtering, sorting, error handling
 */
describe('GetTokensHandler', () => {
  let handler: GetTokensHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;

  const createMockToken = (id: string, creator: string, isLocked = false, isListed = false) => ({
    getId: jest.fn().mockReturnValue(id),
    getAddress: jest.fn().mockReturnValue({ value: '0x' + 'a'.repeat(40) }),
    getName: jest.fn().mockReturnValue(`Token ${id}`),
    getSymbol: jest.fn().mockReturnValue(`T${id}`),
    getCreator: jest.fn().mockReturnValue(creator),
    getDecimals: jest.fn().mockReturnValue(18),
    getTotalSupply: jest.fn().mockReturnValue(BigInt(1000000000000000000000000)),
    getPrice: jest.fn().mockReturnValue(BigInt(1000000000000000000)),
    getReserveBalance: jest.fn().mockReturnValue(BigInt(100000000000000000000)),
    getIsLocked: jest.fn().mockReturnValue(isLocked),
    getIsListed: jest.fn().mockReturnValue(isListed),
  } as any);

  beforeEach(async () => {
    mockTokenRepository = {
      findById: jest.fn(),
      findByAddressString: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findTrending: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTokensHandler,
        {
          provide: TOKEN_REPOSITORY,
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    handler = module.get<GetTokensHandler>(GetTokensHandler);
  });

  describe('execute', () => {
    describe('Default Parameters', () => {
      it('should use default limit of 20 when not provided', async () => {
        const query = new GetTokensQuery();
        const mockTokens = Array.from({ length: 20 }, (_, i) => createMockToken(`token-${i}`, '0x' + 'a'.repeat(40)));
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: mockTokens,
          total: 100,
        });

        const result = await handler.execute(query);

        expect(result.limit).toBe(20);
        expect(result.offset).toBe(0);
        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          {
            creator: undefined,
            isLocked: undefined,
            isListed: undefined,
          },
          {
            limit: 20,
            offset: 0,
            orderBy: 'createdAt',
            orderDirection: 'desc',
          },
        );
      });

      it('should use default offset of 0 when not provided', async () => {
        const query = new GetTokensQuery(undefined, 10);
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 0,
        });

        const result = await handler.execute(query);

        expect(result.offset).toBe(0);
      });

      it('should use default orderBy of createdAt', async () => {
        const query = new GetTokensQuery();
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 0,
        });

        await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            orderBy: 'createdAt',
          }),
        );
      });

      it('should use default orderDirection of desc', async () => {
        const query = new GetTokensQuery();
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 0,
        });

        await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            orderDirection: 'desc',
          }),
        );
      });
    });

    describe('Pagination', () => {
      it('should apply custom limit', async () => {
        const query = new GetTokensQuery(undefined, 50);
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 200,
        });

        const result = await handler.execute(query);

        expect(result.limit).toBe(50);
        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ limit: 50 }),
        );
      });

      it('should apply custom offset', async () => {
        const query = new GetTokensQuery(undefined, 20, 100);
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 300,
        });

        const result = await handler.execute(query);

        expect(result.offset).toBe(100);
        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ offset: 100 }),
        );
      });

      it('should return total count from repository', async () => {
        const query = new GetTokensQuery();
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 12345,
        });

        const result = await handler.execute(query);

        expect(result.total).toBe(12345);
      });

      it('should handle page beyond results', async () => {
        const query = new GetTokensQuery(undefined, 20, 1000);
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 100,
        });

        const result = await handler.execute(query);

        expect(result.tokens).toEqual([]);
        expect(result.total).toBe(100);
      });
    });

    describe('Filtering', () => {
      it('should filter by creator', async () => {
        const creator = '0x' + 'a'.repeat(40);
        const query = new GetTokensQuery({ creator });
        const mockToken = createMockToken('token-1', creator);
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [mockToken],
          total: 1,
        });

        const result = await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ creator }),
          expect.any(Object),
        );
        expect(result.tokens).toHaveLength(1);
      });

      it('should filter by isLocked status', async () => {
        const query = new GetTokensQuery({ isLocked: true });
        const mockToken = createMockToken('token-1', '0x' + 'a'.repeat(40), true);
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [mockToken],
          total: 5,
        });

        await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ isLocked: true }),
          expect.any(Object),
        );
      });

      it('should filter by isListed status', async () => {
        const query = new GetTokensQuery({ isListed: true });
        const mockToken = createMockToken('token-1', '0x' + 'a'.repeat(40), false, true);
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [mockToken],
          total: 3,
        });

        await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.objectContaining({ isListed: true }),
          expect.any(Object),
        );
      });

      it('should combine multiple filters', async () => {
        const creator = '0x' + 'a'.repeat(40);
        const query = new GetTokensQuery({ creator, isLocked: false, isListed: true });
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 0,
        });

        await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          {
            creator,
            isLocked: false,
            isListed: true,
          },
          expect.any(Object),
        );
      });
    });

    describe('Sorting', () => {
      it('should sort by createdAt descending', async () => {
        const query = new GetTokensQuery(undefined, undefined, undefined, 'createdAt', 'desc');
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 0,
        });

        await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ orderBy: 'createdAt', orderDirection: 'desc' }),
        );
      });

      it('should sort by marketCap ascending', async () => {
        const query = new GetTokensQuery(undefined, undefined, undefined, 'marketCap', 'asc');
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 0,
        });

        await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ orderBy: 'marketCap', orderDirection: 'asc' }),
        );
      });

      it('should sort by currentPrice', async () => {
        const query = new GetTokensQuery(undefined, undefined, undefined, 'currentPrice', 'desc');
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 0,
        });

        await handler.execute(query);

        expect(mockTokenRepository.findAll).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ orderBy: 'currentPrice' }),
        );
      });
    });

    describe('Error Handling', () => {
      it('should rethrow repository errors', async () => {
        const query = new GetTokensQuery();
        const error = new Error('Database error');
        mockTokenRepository.findAll.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Database error');
      });

      it('should rethrow on timeout', async () => {
        const query = new GetTokensQuery();
        const error = new Error('Query timeout');
        mockTokenRepository.findAll.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Query timeout');
      });
    });

    describe('Response Format', () => {
      it('should return correct response structure', async () => {
        const query = new GetTokensQuery(undefined, 25, 50);
        const mockToken = createMockToken('token-1', '0x' + 'a'.repeat(40));
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [mockToken],
          total: 500,
        });

        const result = await handler.execute(query);

        expect(result).toHaveProperty('tokens');
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('limit');
        expect(result).toHaveProperty('offset');
        expect(result.limit).toBe(25);
        expect(result.offset).toBe(50);
      });

      it('should return empty tokens array when no results', async () => {
        const query = new GetTokensQuery();
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 0,
        });

        const result = await handler.execute(query);

        expect(result.tokens).toEqual([]);
        expect(result.total).toBe(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle limit of 1', async () => {
        const query = new GetTokensQuery(undefined, 1);
        const mockToken = createMockToken('token-1', '0x' + 'a'.repeat(40));
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [mockToken],
          total: 1000,
        });

        const result = await handler.execute(query);

        expect(result.limit).toBe(1);
        expect(result.tokens).toHaveLength(1);
      });

      it('should handle very large offset', async () => {
        const query = new GetTokensQuery(undefined, 20, 999999);
        mockTokenRepository.findAll.mockResolvedValue({
          tokens: [],
          total: 100,
        });

        const result = await handler.execute(query);

        expect(result.offset).toBe(999999);
      });

      it('should handle all parameters together', async () => {
        const creator = '0x' + 'b'.repeat(40);
        const query = new GetTokensQuery(
          { creator, isLocked: false, isListed: true },
          50,
          100,
          'marketCap',
          'asc',
        );
        const tokens = Array.from({ length: 50 }, (_, i) =>
          createMockToken(`token-${i}`, creator, false, true),
        );
        mockTokenRepository.findAll.mockResolvedValue({
          tokens,
          total: 250,
        });

        const result = await handler.execute(query);

        expect(result.tokens).toHaveLength(50);
        expect(result.total).toBe(250);
        expect(result.limit).toBe(50);
        expect(result.offset).toBe(100);
      });
    });
  });
});
