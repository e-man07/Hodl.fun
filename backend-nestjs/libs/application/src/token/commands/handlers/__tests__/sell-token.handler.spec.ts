import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SellTokenHandler } from '../sell-token.handler';
import { SellTokenCommand } from '../../sell-token.command';
import { ITokenRepository, TOKEN_REPOSITORY, ITradeRepository, TRADE_REPOSITORY } from '@domain';

describe('SellTokenHandler', () => {
  let handler: SellTokenHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;
  let mockTradeRepository: jest.Mocked<ITradeRepository>;

  const createMockToken = (isLocked = false) => ({
    getId: jest.fn().mockReturnValue('token-1'),
    getIsLocked: jest.fn().mockReturnValue(isLocked),
    executeSell: jest.fn().mockReturnValue({
      amountOut: BigInt(8000000000000000000),
      newPrice: { toBigInt: jest.fn().mockReturnValue(BigInt(900000000000000000)) },
      newReserveBalance: BigInt(92000000000000000000),
    }),
    getTotalSupply: jest.fn().mockReturnValue(BigInt(1000000000000000000000000)),
    getDecimals: jest.fn().mockReturnValue(18),
    updateMetrics: jest.fn(),
  } as any);

  beforeEach(async () => {
    mockTokenRepository = { update: jest.fn(), findById: jest.fn() } as any;
    mockTradeRepository = { save: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellTokenHandler,
        { provide: TOKEN_REPOSITORY, useValue: mockTokenRepository },
        { provide: TRADE_REPOSITORY, useValue: mockTradeRepository },
      ],
    }).compile();

    handler = module.get<SellTokenHandler>(SellTokenHandler);
  });

  describe('execute', () => {
    it('should execute sell order successfully', async () => {
      const command = new SellTokenCommand('token-1', '0x' + 'a'.repeat(40), BigInt(100000000000000000000), BigInt(90000000000000000000), '0xtx1', 12345);
      const mockToken = createMockToken(false);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);

      expect(result).toHaveProperty('amountOut');
      expect(result).toHaveProperty('newPrice');
      expect(result).toHaveProperty('newMarketCap');
    });

    it('should throw error when token not found', async () => {
      const command = new SellTokenCommand('non-existent', '0x' + 'a'.repeat(40), BigInt(100), BigInt(90), '0xtx1', 1);
      mockTokenRepository.findById.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when token is locked', async () => {
      const command = new SellTokenCommand('token-1', '0x' + 'a'.repeat(40), BigInt(100), BigInt(90), '0xtx1', 1);
      const mockToken = createMockToken(true);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });

    it('should update token and record trade', async () => {
      const command = new SellTokenCommand('token-1', '0x' + 'a'.repeat(40), BigInt(100), BigInt(90), '0xtx1', 1);
      const mockToken = createMockToken(false);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      await handler.execute(command);

      expect(mockTokenRepository.update).toHaveBeenCalledWith(mockToken);
      expect(mockTradeRepository.save).toHaveBeenCalled();
    });

    it('should handle large sell amounts', async () => {
      const command = new SellTokenCommand('token-1', '0x' + 'a'.repeat(40), BigInt('9'.repeat(40)), BigInt('8'.repeat(40)), '0xtx1', 1);
      const mockToken = createMockToken(false);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);
      expect(result).toBeDefined();
    });

    it('should return calculated new market cap', async () => {
      const command = new SellTokenCommand('token-1', '0x' + 'a'.repeat(40), BigInt(100), BigInt(90), '0xtx1', 1);
      const mockToken = createMockToken(false);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);
      expect(result.newMarketCap).toBeDefined();
      expect(typeof result.newMarketCap).toBe('bigint');
    });
  });
});
