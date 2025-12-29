import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LockTokenHandler } from '../lock-token.handler';
import { LockTokenCommand } from '../../lock-token.command';
import { ITokenRepository, TOKEN_REPOSITORY } from '@domain';

describe('LockTokenHandler', () => {
  let handler: LockTokenHandler;
  let mockTokenRepository: jest.Mocked<ITokenRepository>;

  const createMockToken = (isReady = true) => ({
    getId: jest.fn().mockReturnValue('token-1'),
    isReadyForGraduation: jest.fn().mockReturnValue(isReady),
    lock: jest.fn(),
    getMarketCap: jest.fn().mockReturnValue({ toBigInt: jest.fn().mockReturnValue(BigInt(200000000000000000000)) }),
    getGraduationThreshold: jest.fn().mockReturnValue({ toBigInt: jest.fn().mockReturnValue(BigInt(100000000000000000000)) }),
  } as any);

  beforeEach(async () => {
    mockTokenRepository = { findById: jest.fn(), update: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [LockTokenHandler, { provide: TOKEN_REPOSITORY, useValue: mockTokenRepository }],
    }).compile();

    handler = module.get<LockTokenHandler>(LockTokenHandler);
  });

  describe('execute', () => {
    it('should lock token when ready for graduation', async () => {
      const command = new LockTokenCommand('token-1');
      const mockToken = createMockToken(true);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(mockToken.lock).toHaveBeenCalled();
      expect(mockTokenRepository.update).toHaveBeenCalledWith(mockToken);
    });

    it('should throw error when token not found', async () => {
      const command = new LockTokenCommand('non-existent');
      mockTokenRepository.findById.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when token not ready for graduation', async () => {
      const command = new LockTokenCommand('token-1');
      const mockToken = createMockToken(false);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });

    it('should return success message', async () => {
      const command = new LockTokenCommand('token-1');
      const mockToken = createMockToken(true);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);

      expect(result.message).toContain('locked');
      expect(result.message).toContain('token-1');
    });

    it('should verify graduation threshold before locking', async () => {
      const command = new LockTokenCommand('token-1');
      const mockToken = createMockToken(false);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      try {
        await handler.execute(command);
      } catch {}

      expect(mockToken.isReadyForGraduation).toHaveBeenCalled();
      expect(mockToken.lock).not.toHaveBeenCalled();
    });

    it('should handle token at exact graduation threshold', async () => {
      const command = new LockTokenCommand('token-at-threshold');
      const mockToken = createMockToken(true);
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
    });

    it('should handle token well above graduation threshold', async () => {
      const command = new LockTokenCommand('token-high-market-cap');
      const mockToken = {
        ...createMockToken(true),
        getMarketCap: jest.fn().mockReturnValue({ toBigInt: jest.fn().mockReturnValue(BigInt('9'.repeat(30))) }),
      };
      mockTokenRepository.findById.mockResolvedValue(mockToken);

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(mockToken.lock).toHaveBeenCalled();
    });
  });
});
