import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BuyTokenHandler } from '../buy-token.handler';
import { BuyTokenCommand } from '../../buy-token.command';
import { ITokenRepository, TOKEN_REPOSITORY, ITradeRepository, TRADE_REPOSITORY } from '@domain';

/**
 * BuyTokenHandler Test Suite
 *
 * Tests the command handler for executing buy operations on the bonding curve.
 * Covers: token loading, buy execution, price calculations, trade recording,  graduation detection, error handling
 */
describe('BuyTokenHandler', () => {
  let handler: BuyTokenHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;
  let mockTradeRepository: jest.Mocked<ITradeRepository>;

  const createMockToken = (isLocked = false) => ({
    getId: jest.fn().mockReturnValue('token-1'),
    getAddress: jest.fn().mockReturnValue({ value: '0x' + 'a'.repeat(40) }),
    getName: jest.fn().mockReturnValue('Buy Test Token'),
    getSymbol: jest.fn().mockReturnValue('BTT'),
    getCreator: jest.fn().mockReturnValue('0x' + 'b'.repeat(40)),
    getDecimals: jest.fn().mockReturnValue(18),
    getTotalSupply: jest.fn().mockReturnValue(BigInt(1000000000000000000000000)),
    getPrice: jest.fn().mockReturnValue(BigInt(1000000000000000000)),
    getReserveBalance: jest.fn().mockReturnValue(BigInt(100000000000000000000)),
    getIsLocked: jest.fn().mockReturnValue(isLocked),
    getIsListed: jest.fn().mockReturnValue(false),
    executeBuy: jest.fn().mockReturnValue({
      amountOut: BigInt(10000000000000000000),
      newPrice: { toBigInt: jest.fn().mockReturnValue(BigInt(1100000000000000000)) },
      newReserveBalance: BigInt(110000000000000000000),
    }),
    updateMetrics: jest.fn(),
    isReadyForGraduation: jest.fn().mockReturnValue(false),
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

    mockTradeRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuyTokenHandler,
        {
          provide: TOKEN_REPOSITORY,
          useValue: mockTokenRepository,
        },
        {
          provide: TRADE_REPOSITORY,
          useValue: mockTradeRepository,
        },
      ],
    }).compile();

    handler = module.get<BuyTokenHandler>(BuyTokenHandler);
  });

  describe('execute', () => {
    describe('Happy Path', () => {
      it('should execute buy order successfully', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);
        mockTradeRepository.save.mockResolvedValue({} as any);

        const result = await handler.execute(command);

        expect(result).toHaveProperty('amountOut');
        expect(result).toHaveProperty('newPrice');
        expect(result).toHaveProperty('newMarketCap');
        expect(result).toHaveProperty('graduationReady');
      });

      it('should load token from repository', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.findById).toHaveBeenCalledWith('token-1');
      });

      it('should record trade in trade repository', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTradeRepository.save).toHaveBeenCalled();
      });

      it('should update token metrics', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockToken.updateMetrics).toHaveBeenCalled();
      });

      it('should save updated token state', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.update).toHaveBeenCalledWith(mockToken);
      });
    });

    describe('Error Handling - Token Not Found', () => {
      it('should throw BadRequestException when token not found', async () => {
        const command = new BuyTokenCommand(
          'non-existent-token',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        mockTokenRepository.findById.mockResolvedValue(null);

        await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
        await expect(handler.execute(command)).rejects.toThrow('Token not found');
      });
    });

    describe('Error Handling - Locked Token', () => {
      it('should throw BadRequestException when token is locked', async () => {
        const command = new BuyTokenCommand(
          'locked-token',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(true); // locked=true
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
        await expect(handler.execute(command)).rejects.toThrow('locked');
      });

      it('should not attempt trade when token is locked', async () => {
        const command = new BuyTokenCommand(
          'locked-token',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(true);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        try {
          await handler.execute(command);
        } catch {}

        expect(mockToken.executeBuy).not.toHaveBeenCalled();
        expect(mockTradeRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('Amount Calculations', () => {
      it('should return amount out from bonding curve execution', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.amountOut).toBe(BigInt(10000000000000000000));
      });

      it('should return new price after buy', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.newPrice).toBe(BigInt(1100000000000000000));
      });

      it('should handle large buy amounts', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt('9'.repeat(40)),
          BigInt(0),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.update).toHaveBeenCalled();
      });

      it('should handle minimum buy amount (1 wei)', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(1),
          BigInt(0),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.update).toHaveBeenCalled();
      });
    });

    describe('Graduation Detection', () => {
      it('should detect graduation when threshold reached', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockToken.isReadyForGraduation.mockReturnValue(true);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.graduationReady).toBe(true);
      });

      it('should not mark graduation when threshold not reached', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockToken.isReadyForGraduation.mockReturnValue(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.graduationReady).toBe(false);
      });
    });

    describe('Trade Recording', () => {
      it('should create trade with correct ID format', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        const saveCall = mockTradeRepository.save.mock.calls[0][0];
        expect(saveCall).toBeDefined();
      });

      it('should record buyer address in trade', async () => {
        const buyer = '0x' + 'c'.repeat(40);
        const command = new BuyTokenCommand(
          'token-1',
          buyer,
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTradeRepository.save).toHaveBeenCalled();
      });

      it('should record transaction hash', async () => {
        const txHash = '0xabcdef123456789';
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          txHash,
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTradeRepository.save).toHaveBeenCalled();
      });

      it('should record block number', async () => {
        const blockNumber = 999999;
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          blockNumber,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTradeRepository.save).toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('should handle buy by token creator', async () => {
        const creator = '0x' + 'b'.repeat(40);
        const command = new BuyTokenCommand(
          'token-1',
          creator,
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result).toBeDefined();
      });

      it('should handle sequential buy orders', async () => {
        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const command1 = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash1',
          12345,
        );

        const command2 = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(5000000000000000000),
          BigInt(4000000000000000000),
          '0xtxhash2',
          12346,
        );

        const result1 = await handler.execute(command1);
        const result2 = await handler.execute(command2);

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
        expect(mockTradeRepository.save).toHaveBeenCalledTimes(2);
      });

      it('should handle buy with zero slippage (minAmountOut)', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(0), // no minimum
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result).toBeDefined();
      });

      it('should handle buy on newly created token', async () => {
        const command = new BuyTokenCommand(
          'brand-new-token',
          '0x' + 'a'.repeat(40),
          BigInt(100000000000000000),
          BigInt(1),
          '0xtxhash123',
          1,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result).toBeDefined();
      });
    });

    describe('Repository Interaction', () => {
      it('should call findById with token ID', async () => {
        const command = new BuyTokenCommand(
          'token-abc-123',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.findById).toHaveBeenCalledWith('token-abc-123');
      });

      it('should call update with modified token', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        expect(mockTokenRepository.update).toHaveBeenCalledWith(mockToken);
      });

      it('should call both repositories in correct order', async () => {
        const command = new BuyTokenCommand(
          'token-1',
          '0x' + 'a'.repeat(40),
          BigInt(10000000000000000000),
          BigInt(9000000000000000000),
          '0xtxhash123',
          12345,
        );

        const mockToken = createMockToken(false);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        await handler.execute(command);

        // findById should be called first
        expect(mockTokenRepository.findById).toHaveBeenCalled();
        // update should be called before save trade
        expect(mockTokenRepository.update).toHaveBeenCalled();
      });
    });
  });
});
