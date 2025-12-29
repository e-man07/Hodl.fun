import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ListOnUniswapHandler } from '../list-on-uniswap.handler';
import { ListOnUniswapCommand } from '../../list-on-uniswap.command';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';

describe('ListOnUniswapHandler', () => {
  let handler: ListOnUniswapHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;

  const createMockToken = (isLocked = true) => ({
    getId: jest.fn().mockReturnValue('token-1'),
    getIsLocked: jest.fn().mockReturnValue(isLocked),
    listOnUniswapV3: jest.fn(),
  } as any);

  beforeEach(async () => {
    mockTokenRepository = { findById: jest.fn(), update: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListOnUniswapHandler, { provide: TOKEN_REPOSITORY, useValue: mockTokenRepository }],
    }).compile();

    handler = module.get<ListOnUniswapHandler>(ListOnUniswapHandler);
  });

  describe('execute', () => {
    it('should list token on Uniswap when locked', async () => {
      const poolAddress = '0x' + 'p'.repeat(40);
      const command = new ListOnUniswapCommand('token-1', poolAddress);
      const mockToken = createMockToken(true);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.poolAddress).toBe(poolAddress);
      expect(mockToken.listOnUniswapV3).toHaveBeenCalledWith(poolAddress);
      expect(mockTokenRepository.update).toHaveBeenCalledWith(mockToken);
    });

    it('should throw error when token not found', async () => {
      const command = new ListOnUniswapCommand('non-existent', '0x' + 'p'.repeat(40));
      mockTokenRepository.findById.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when token not locked', async () => {
      const command = new ListOnUniswapCommand('token-1', '0x' + 'p'.repeat(40));
      const mockToken = createMockToken(false);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });

    it('should verify locked status before listing', async () => {
      const command = new ListOnUniswapCommand('token-1', '0x' + 'p'.repeat(40));
      const mockToken = createMockToken(false);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      try {
        await handler.execute(command);
      } catch {}

      expect(mockToken.getIsLocked()).toBe(false);
      expect(mockToken.listOnUniswapV3).not.toHaveBeenCalled();
    });

    it('should pass pool address to token', async () => {
      const poolAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
      const command = new ListOnUniswapCommand('token-1', poolAddress);
      const mockToken = createMockToken(true);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      await handler.execute(command);

      expect(mockToken.listOnUniswapV3).toHaveBeenCalledWith(poolAddress);
    });

    it('should return pool address in response', async () => {
      const poolAddress = '0x' + 'p'.repeat(40);
      const command = new ListOnUniswapCommand('token-1', poolAddress);
      const mockToken = createMockToken(true);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);

      expect(result.poolAddress).toBe(poolAddress);
    });

    it('should handle different pool addresses', async () => {
      const pools = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
      ];

      for (const poolAddress of pools) {
        const command = new ListOnUniswapCommand('token-1', poolAddress);
        const mockToken = createMockToken(true);
        mockTokenRepository.findById.mockResolvedValue(mockToken);

        const result = await handler.execute(command);

        expect(result.poolAddress).toBe(poolAddress);
      }
    });
  });
});
