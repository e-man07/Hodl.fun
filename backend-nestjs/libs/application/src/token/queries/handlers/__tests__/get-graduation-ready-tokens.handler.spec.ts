import { Test, TestingModule } from '@nestjs/testing';
import { GetGraduationReadyTokensHandler } from '../get-graduation-ready-tokens.handler';
import { GetGraduationReadyTokensQuery } from '../../get-graduation-ready-tokens.query';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * GetGraduationReadyTokensHandler Test Suite
 *
 * Tests the query handler for retrieving tokens ready for graduation.
 * Graduation criteria: market cap >= 100 PUSH, not locked, ready for Uniswap V3
 * Covers: graduation threshold, locked status, limits, error handling
 */
describe('GetGraduationReadyTokensHandler', () => {
  let handler: GetGraduationReadyTokensHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;

  const createMockToken = (
    id: string,
    marketCap: bigint = BigInt(100000000000000000000),
    isLocked = false,
  ) => ({
    getId: jest.fn().mockReturnValue(id),
    getAddress: jest.fn().mockReturnValue({ value: '0x' + 'a'.repeat(40) }),
    getName: jest.fn().mockReturnValue(`Graduation Token ${id}`),
    getSymbol: jest.fn().mockReturnValue(`GRAD${id}`),
    getCreator: jest.fn().mockReturnValue('0x' + 'a'.repeat(40)),
    getDecimals: jest.fn().mockReturnValue(18),
    getTotalSupply: jest.fn().mockReturnValue(BigInt(1000000000000000000000000)),
    getPrice: jest.fn().mockReturnValue(BigInt(100000000000000000)),
    getMarketCap: jest.fn().mockReturnValue(marketCap),
    getReserveBalance: jest.fn().mockReturnValue(BigInt(100000000000000000000)),
    getIsLocked: jest.fn().mockReturnValue(isLocked),
    getIsListed: jest.fn().mockReturnValue(false),
    isReadyForGraduation: jest.fn().mockReturnValue(!isLocked && marketCap >= BigInt(100000000000000000000)),
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
        GetGraduationReadyTokensHandler,
        {
          provide: TOKEN_REPOSITORY,
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    handler = module.get<GetGraduationReadyTokensHandler>(GetGraduationReadyTokensHandler);
  });

  describe('execute', () => {
    describe('Default Limit', () => {
      it('should use default limit of 10 when not provided', async () => {
        const query = new GetGraduationReadyTokensQuery();
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findReadyForGraduation).toHaveBeenCalledWith(10);
      });

      it('should return array with default limit items', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const tokens = Array.from({ length: 10 }, (_, i) => createMockToken(`token-${i}`));
        mockTokenRepository.findReadyForGraduation.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(result).toHaveLength(10);
      });
    });

    describe('Custom Limit', () => {
      it('should apply custom limit of 5', async () => {
        const query = new GetGraduationReadyTokensQuery(5);
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findReadyForGraduation).toHaveBeenCalledWith(5);
      });

      it('should apply custom limit of 20', async () => {
        const query = new GetGraduationReadyTokensQuery(20);
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findReadyForGraduation).toHaveBeenCalledWith(20);
      });

      it('should support limit of 1', async () => {
        const query = new GetGraduationReadyTokensQuery(1);
        const token = createMockToken('token-1');
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([token]);

        const result = await handler.execute(query);

        expect(result).toHaveLength(1);
      });

      it('should support large limit', async () => {
        const query = new GetGraduationReadyTokensQuery(100);
        const tokens = Array.from({ length: 100 }, (_, i) => createMockToken(`token-${i}`));
        mockTokenRepository.findReadyForGraduation.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(result).toHaveLength(100);
      });
    });

    describe('Graduation Criteria Verification', () => {
      it('should return tokens at exactly graduation threshold (100 PUSH)', async () => {
        const query = new GetGraduationReadyTokensQuery();
        // 100 * 10^18 (100 PUSH with 18 decimals)
        const graduationToken = createMockToken(
          'token-at-threshold',
          BigInt(100) * BigInt(10 ** 18),
          false,
        );
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([graduationToken]);

        const result = await handler.execute(query);

        expect(result).toHaveLength(1);
        expect(result[0].getMarketCap()).toBe(BigInt(100) * BigInt(10 ** 18));
      });

      it('should exclude locked tokens', async () => {
        const query = new GetGraduationReadyTokensQuery();
        // const _lockedToken = createMockToken({...});
        // Repository should not return locked tokens
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        const result = await handler.execute(query);

        expect(result).toEqual([]);
      });

      it('should return tokens above graduation threshold', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const highCapToken = createMockToken(
          'token-high-cap',
          BigInt(500) * BigInt(10 ** 18),
          false,
        );
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([highCapToken]);

        const result = await handler.execute(query);

        expect(result).toHaveLength(1);
        const marketCap = result[0].getMarketCap();
      const marketCapValue = (typeof marketCap === 'string' ? BigInt(marketCap) : (marketCap as any)) || BigInt(0);
      expect((marketCapValue as bigint) > BigInt(100) * BigInt(10 ** 18)).toBe(true);
      });

      it('should not return tokens below graduation threshold', async () => {
        const query = new GetGraduationReadyTokensQuery();
        // Repository implementation handles filtering, so we just verify it was called correctly
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        const result = await handler.execute(query);

        expect(result).toEqual([]);
      });
    });

    describe('Response Format', () => {
      it('should return array of Token objects', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const tokens = [createMockToken('token-1'), createMockToken('token-2')];
        mockTokenRepository.findReadyForGraduation.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        expect(result[0].getId()).toBe('token-1');
        expect(result[1].getId()).toBe('token-2');
      });

      it('should return empty array when no tokens ready for graduation', async () => {
        const query = new GetGraduationReadyTokensQuery();
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        const result = await handler.execute(query);

        expect(result).toEqual([]);
      });

      it('should preserve token properties in response', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const token = createMockToken('test-token', BigInt(200) * BigInt(10 ** 18), false);
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([token]);

        const result = await handler.execute(query);

        expect(result[0].getName()).toBe('Graduation Token test-token');
        expect(result[0].getSymbol()).toBe('GRADtest-token');
        expect(result[0].getIsLocked()).toBe(false);
      });
    });

    describe('Token Ordering', () => {
      it('should preserve repository ordering', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const tokens = [
          createMockToken('token-1', BigInt(200) * BigInt(10 ** 18)),
          createMockToken('token-2', BigInt(150) * BigInt(10 ** 18)),
          createMockToken('token-3', BigInt(300) * BigInt(10 ** 18)),
        ];
        mockTokenRepository.findReadyForGraduation.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(result[0].getId()).toBe('token-1');
        expect(result[1].getId()).toBe('token-2');
        expect(result[2].getId()).toBe('token-3');
      });

      it('should handle single token', async () => {
        const query = new GetGraduationReadyTokensQuery(1);
        const token = createMockToken('single-token', BigInt(150) * BigInt(10 ** 18));
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([token]);

        const result = await handler.execute(query);

        expect(result).toHaveLength(1);
        expect(result[0].getId()).toBe('single-token');
      });
    });

    describe('Error Handling', () => {
      it('should rethrow repository errors', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const error = new Error('Database connection failed');
        mockTokenRepository.findReadyForGraduation.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Database connection failed');
      });

      it('should rethrow query execution errors', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const error = new Error('Query failed');
        mockTokenRepository.findReadyForGraduation.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Query failed');
      });

      it('should rethrow timeout errors', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const error = new Error('Query timeout');
        mockTokenRepository.findReadyForGraduation.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Query timeout');
      });

      it('should handle connection errors gracefully', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const error = new Error('Connection refused');
        mockTokenRepository.findReadyForGraduation.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Connection refused');
      });
    });

    describe('Edge Cases', () => {
      it('should handle token at exactly graduation threshold', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const thresholdToken = createMockToken(
          'threshold-token',
          BigInt(100) * BigInt(10 ** 18),
          false,
        );
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([thresholdToken]);

        const result = await handler.execute(query);

        expect(result[0].getMarketCap()).toBe(BigInt(100) * BigInt(10 ** 18));
      });

      it('should handle token just above graduation threshold', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const aboveThresholdToken = createMockToken(
          'above-threshold',
          BigInt(100) * BigInt(10 ** 18) + BigInt(1),
          false,
        );
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([aboveThresholdToken]);

        const result = await handler.execute(query);

        expect(result[0].getMarketCap()).toBe(BigInt(100) * BigInt(10 ** 18) + BigInt(1));
      });

      it('should handle very high market cap tokens', async () => {
        const query = new GetGraduationReadyTokensQuery();
        const veryHighCapToken = createMockToken(
          'very-high-cap',
          BigInt('9'.repeat(40)),
          false,
        );
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([veryHighCapToken]);

        const result = await handler.execute(query);

        expect(result[0].getMarketCap()).toBe(BigInt('9'.repeat(40)));
      });

      it('should handle mixed locked and unlocked tokens correctly', async () => {
        const query = new GetGraduationReadyTokensQuery();
        // Repository should only return unlocked tokens ready for graduation
        const readyTokens = [
          createMockToken('ready-1', BigInt(150) * BigInt(10 ** 18), false),
          createMockToken('ready-2', BigInt(200) * BigInt(10 ** 18), false),
        ];
        mockTokenRepository.findReadyForGraduation.mockResolvedValue(readyTokens);

        const result = await handler.execute(query);

        expect(result).toHaveLength(2);
        expect(result.every((t) => !t.getIsLocked())).toBe(true);
      });

      it('should handle limit larger than available tokens', async () => {
        const query = new GetGraduationReadyTokensQuery(100);
        const tokens = Array.from({ length: 5 }, (_, i) =>
          createMockToken(`token-${i}`, BigInt(150) * BigInt(10 ** 18)),
        );
        mockTokenRepository.findReadyForGraduation.mockResolvedValue(tokens);

        const result = await handler.execute(query);

        expect(result).toHaveLength(5);
      });
    });

    describe('Repository Interaction', () => {
      it('should call findReadyForGraduation with correct limit', async () => {
        const query = new GetGraduationReadyTokensQuery(7);
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findReadyForGraduation).toHaveBeenCalledWith(7);
        expect(mockTokenRepository.findReadyForGraduation).toHaveBeenCalledTimes(1);
      });

      it('should only call findReadyForGraduation method', async () => {
        const query = new GetGraduationReadyTokensQuery();
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findReadyForGraduation).toHaveBeenCalled();
        expect(mockTokenRepository.findById).not.toHaveBeenCalled();
        expect(mockTokenRepository.findAll).not.toHaveBeenCalled();
        expect(mockTokenRepository.findTrending).not.toHaveBeenCalled();
      });

      it('should pass exact limit parameter', async () => {
        const query = new GetGraduationReadyTokensQuery(42);
        mockTokenRepository.findReadyForGraduation.mockResolvedValue([]);

        await handler.execute(query);

        expect(mockTokenRepository.findReadyForGraduation).toHaveBeenCalledWith(42);
      });
    });
  });
});
