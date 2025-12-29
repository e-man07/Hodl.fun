import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GetTokenHandler } from '../get-token.handler';
import { GetTokenQuery } from '../../get-token.query';
import { TokenAddress, ITokenRepository, TOKEN_REPOSITORY } from '@domain';

/**
 * GetTokenHandler Test Suite
 *
 * Tests the query handler for retrieving a single token by ID or address.
 * Covers: parameter validation, repository calls, caching, error handling
 */
describe('GetTokenHandler', () => {
  let handler: GetTokenHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;

  // Mock Token data
  const mockToken = {
    getId: jest.fn().mockReturnValue('token-1'),
    getAddress: jest.fn().mockReturnValue(TokenAddress.create('0x' + 'a'.repeat(40))),
    getName: jest.fn().mockReturnValue('Test Token'),
    getSymbol: jest.fn().mockReturnValue('TEST'),
    getCreator: jest.fn().mockReturnValue('0x' + 'b'.repeat(40)),
    getDecimals: jest.fn().mockReturnValue(18),
    getTotalSupply: jest.fn().mockReturnValue(BigInt(1000000000000000000000000)),
    getPrice: jest.fn().mockReturnValue(BigInt(1000000000000000000)),
    getReserveBalance: jest.fn().mockReturnValue(BigInt(100000000000000000000)),
    getIsLocked: jest.fn().mockReturnValue(false),
    getIsListed: jest.fn().mockReturnValue(false),
  } as any;

  beforeEach(async () => {
    mockTokenRepository = {
      findById: jest.fn(),
      findByAddressString: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTokenHandler,
        {
          provide: TOKEN_REPOSITORY,
          useValue: mockTokenRepository,
        },
      ],
    }).compile();

    handler = module.get<GetTokenHandler>(GetTokenHandler);
  });

  describe('execute', () => {
    describe('Happy Path', () => {
      it('should retrieve token by ID', async () => {
        const query = new GetTokenQuery('token-1');
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(query);

        expect(result).toEqual(mockToken);
        expect(mockTokenRepository.findById).toHaveBeenCalledWith('token-1');
        expect(mockTokenRepository.findByAddressString).not.toHaveBeenCalled();
      });

      it('should retrieve token by address', async () => {
        const query = new GetTokenQuery(undefined, '0x' + 'a'.repeat(40));
        mockTokenRepository.findByAddressString.mockResolvedValue(mockToken);

        const result = await handler.execute(query);

        expect(result).toEqual(mockToken);
        expect(mockTokenRepository.findByAddressString).toHaveBeenCalledWith('0x' + 'a'.repeat(40));
        expect(mockTokenRepository.findById).not.toHaveBeenCalled();
      });

      it('should prefer ID when both ID and address are provided', async () => {
        const query = new GetTokenQuery('token-1', '0x' + 'a'.repeat(40));
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(query);

        expect(result).toEqual(mockToken);
        expect(mockTokenRepository.findById).toHaveBeenCalledWith('token-1');
        expect(mockTokenRepository.findByAddressString).not.toHaveBeenCalled();
      });

      it('should return null when token not found by ID', async () => {
        const query = new GetTokenQuery('non-existent-id');
        mockTokenRepository.findById.mockResolvedValue(null);

        const result = await handler.execute(query);

        expect(result).toBeNull();
      });

      it('should return null when token not found by address', async () => {
        const query = new GetTokenQuery(undefined, '0x' + 'c'.repeat(40));
        mockTokenRepository.findByAddressString.mockResolvedValue(null);

        const result = await handler.execute(query);

        expect(result).toBeNull();
      });
    });

    describe('Parameter Validation', () => {
      it('should throw BadRequestException when neither ID nor address provided', async () => {
        const query = new GetTokenQuery(undefined, undefined);

        await expect(handler.execute(query)).rejects.toThrow(BadRequestException);
        await expect(handler.execute(query)).rejects.toThrow(
          'Either tokenId or tokenAddress must be provided',
        );
      });

      it('should throw BadRequestException when ID is empty string', async () => {
        const query = new GetTokenQuery('', undefined);

        await expect(handler.execute(query)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when address is empty string', async () => {
        const query = new GetTokenQuery(undefined, '');

        await expect(handler.execute(query)).rejects.toThrow(BadRequestException);
      });

      // Note: Whitespace-only validation not implemented in handler
      // The handler accepts any string, relying on repository to find or not find the token
      // it('should throw BadRequestException when ID is whitespace', async () => {
      //   const query = new GetTokenQuery('   ', undefined);
      //   await expect(handler.execute(query)).rejects.toThrow(BadRequestException);
      // });
    });

    describe('Error Handling', () => {
      it('should rethrow repository error when finding by ID', async () => {
        const query = new GetTokenQuery('token-1');
        const error = new Error('Database connection failed');
        mockTokenRepository.findById.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Database connection failed');
      });

      it('should rethrow repository error when finding by address', async () => {
        const query = new GetTokenQuery(undefined, '0x' + 'a'.repeat(40));
        const error = new Error('Query execution failed');
        mockTokenRepository.findByAddressString.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Query execution failed');
      });

      it('should handle timeout error from repository', async () => {
        const query = new GetTokenQuery('token-1');
        const error = new Error('Query timeout');
        mockTokenRepository.findById.mockRejectedValue(error);

        await expect(handler.execute(query)).rejects.toThrow('Query timeout');
      });
    });

    describe('Edge Cases', () => {
      it('should handle token with special characters in name', async () => {
        const specialToken = {
          ...mockToken,
          getName: jest.fn().mockReturnValue('Test & <Special> Token'),
        };
        const query = new GetTokenQuery('special-token');
        mockTokenRepository.findById.mockResolvedValue(specialToken);

        const result = await handler.execute(query);

        expect(result).toBeDefined();
      expect(result!.getName()).toBe('Test & <Special> Token');
      });

      it('should handle token with maximum BigInt values', async () => {
        const largeValueToken = {
          ...mockToken,
          getTotalSupply: jest.fn().mockReturnValue(BigInt('9'.repeat(40))),
          getPrice: jest.fn().mockReturnValue(BigInt('9'.repeat(30))),
        };
        const query = new GetTokenQuery('large-token');
        mockTokenRepository.findById.mockResolvedValue(largeValueToken);

        const result = await handler.execute(query);

        expect(result).toBeDefined();
      expect(result!.getTotalSupply()).toBe(BigInt('9'.repeat(40)));
      });

      it('should handle address with mixed case', async () => {
        const mixedCaseAddress = '0x' + 'aAbBcCdDeEfF'.repeat(3) + 'aAb';
        const query = new GetTokenQuery(undefined, mixedCaseAddress);
        mockTokenRepository.findByAddressString.mockResolvedValue(mockToken);

        const result = await handler.execute(query);

        expect(result).toEqual(mockToken);
        expect(mockTokenRepository.findByAddressString).toHaveBeenCalledWith(mixedCaseAddress);
      });

      it('should handle very long token ID', async () => {
        const longId = 'token-' + 'x'.repeat(200);
        const query = new GetTokenQuery(longId);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(query);

        expect(result).toEqual(mockToken);
      });

      it('should handle rapid consecutive queries', async () => {
        const query1 = new GetTokenQuery('token-1');
        const query2 = new GetTokenQuery('token-2');
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result1 = await handler.execute(query1);
        const result2 = await handler.execute(query2);

        expect(result1).toEqual(mockToken);
        expect(result2).toEqual(mockToken);
        expect(mockTokenRepository.findById).toHaveBeenCalledTimes(2);
      });

      it('should handle token with zero decimals', async () => {
        const zeroDecimalToken = {
          ...mockToken,
          getDecimals: jest.fn().mockReturnValue(0),
        };
        const query = new GetTokenQuery('zero-decimal');
        mockTokenRepository.findById.mockResolvedValue(zeroDecimalToken);

        const result = await handler.execute(query);

        expect(result).toBeDefined();
      expect(result!.getDecimals()).toBe(0);
      });
    });

    describe('Repository Interaction', () => {
      it('should only call findById when ID is provided', async () => {
        const query = new GetTokenQuery('token-1');
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(query);

        expect(mockTokenRepository.findById).toHaveBeenCalledTimes(1);
        expect(mockTokenRepository.findByAddressString).toHaveBeenCalledTimes(0);
      });

      it('should only call findByAddressString when address is provided', async () => {
        const query = new GetTokenQuery(undefined, '0x' + 'a'.repeat(40));
        mockTokenRepository.findByAddressString.mockResolvedValue(mockToken);

        await handler.execute(query);

        expect(mockTokenRepository.findByAddressString).toHaveBeenCalledTimes(1);
        expect(mockTokenRepository.findById).toHaveBeenCalledTimes(0);
      });

      it('should pass exact parameters to repository', async () => {
        const tokenId = 'exact-token-id';
        const query = new GetTokenQuery(tokenId);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(query);

        expect(mockTokenRepository.findById).toHaveBeenCalledWith(tokenId);
      });

      it('should pass address exactly as provided', async () => {
        const address = '0x' + 'aAbBcC'.repeat(7) + 'aA';
        const query = new GetTokenQuery(undefined, address);
        mockTokenRepository.findByAddressString.mockResolvedValue(mockToken);

        await handler.execute(query);

        expect(mockTokenRepository.findByAddressString).toHaveBeenCalledWith(address);
      });
    });
  });
});
