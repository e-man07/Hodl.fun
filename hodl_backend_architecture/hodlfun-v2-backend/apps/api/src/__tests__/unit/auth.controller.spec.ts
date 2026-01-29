/**
 * Auth Controller Unit Tests
 * Tests for authentication endpoints
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../../auth/auth.controller';
import { WalletAuthService } from '../../auth/services/wallet-auth.service';
import { JwtAuthService } from '../../auth/services/jwt-auth.service';

const createMockWalletAuthService = () => ({
  generateNonce: jest.fn(),
  verifySignature: jest.fn(),
});

const createMockJwtAuthService = () => ({
  generateTokenPair: jest.fn(),
  refreshTokens: jest.fn(),
});

describe('AuthController', () => {
  let controller: AuthController;
  let mockWalletAuth: ReturnType<typeof createMockWalletAuthService>;
  let mockJwtAuth: ReturnType<typeof createMockJwtAuthService>;

  beforeEach(async () => {
    mockWalletAuth = createMockWalletAuthService();
    mockJwtAuth = createMockJwtAuthService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: WalletAuthService, useValue: mockWalletAuth },
        { provide: JwtAuthService, useValue: mockJwtAuth },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNonce', () => {
    const mockWallet = '0xabc123def456';
    const mockNonceResponse = {
      nonce: 'uuid-1234',
      message: 'Welcome to Hodl.fun!\n\nSign this message...',
      expiresAt: new Date(),
    };

    it('should call walletAuth.generateNonce with wallet address', async () => {
      mockWalletAuth.generateNonce.mockResolvedValue(mockNonceResponse);

      await controller.getNonce({ wallet: mockWallet });

      expect(mockWalletAuth.generateNonce).toHaveBeenCalledWith(mockWallet);
    });

    it('should return nonce response from service', async () => {
      mockWalletAuth.generateNonce.mockResolvedValue(mockNonceResponse);

      const result = await controller.getNonce({ wallet: mockWallet });

      expect(result).toEqual(mockNonceResponse);
    });

    it('should handle service errors', async () => {
      mockWalletAuth.generateNonce.mockRejectedValue(new Error('Redis error'));

      await expect(controller.getNonce({ wallet: mockWallet })).rejects.toThrow('Redis error');
    });
  });

  describe('verify', () => {
    const mockWallet = '0xabc123def456';
    const mockSignature = '0xsignature';
    const mockTokenPair = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    };

    it('should verify signature and return token pair on success', async () => {
      mockWalletAuth.verifySignature.mockResolvedValue(true);
      mockJwtAuth.generateTokenPair.mockResolvedValue(mockTokenPair);

      const result = await controller.verify({
        wallet: mockWallet,
        signature: mockSignature,
      });

      expect(mockWalletAuth.verifySignature).toHaveBeenCalledWith(mockWallet, mockSignature);
      expect(mockJwtAuth.generateTokenPair).toHaveBeenCalledWith(mockWallet);
      expect(result).toEqual(mockTokenPair);
    });

    it('should throw UnauthorizedException when signature is invalid', async () => {
      mockWalletAuth.verifySignature.mockResolvedValue(false);

      await expect(
        controller.verify({ wallet: mockWallet, signature: mockSignature }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.verify({ wallet: mockWallet, signature: mockSignature }),
      ).rejects.toThrow('Invalid signature');
    });

    it('should not generate tokens when signature is invalid', async () => {
      mockWalletAuth.verifySignature.mockResolvedValue(false);

      try {
        await controller.verify({ wallet: mockWallet, signature: mockSignature });
      } catch {
        // Expected to throw
      }

      expect(mockJwtAuth.generateTokenPair).not.toHaveBeenCalled();
    });

    it('should propagate errors from verifySignature', async () => {
      mockWalletAuth.verifySignature.mockRejectedValue(
        new UnauthorizedException('Nonce expired'),
      );

      await expect(
        controller.verify({ wallet: mockWallet, signature: mockSignature }),
      ).rejects.toThrow('Nonce expired');
    });
  });

  describe('refresh', () => {
    const mockRefreshToken = 'refresh-token';
    const mockNewTokenPair = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    };

    it('should call jwtAuth.refreshTokens with refresh token', async () => {
      mockJwtAuth.refreshTokens.mockResolvedValue(mockNewTokenPair);

      await controller.refresh({ refreshToken: mockRefreshToken });

      expect(mockJwtAuth.refreshTokens).toHaveBeenCalledWith(mockRefreshToken);
    });

    it('should return new token pair on success', async () => {
      mockJwtAuth.refreshTokens.mockResolvedValue(mockNewTokenPair);

      const result = await controller.refresh({ refreshToken: mockRefreshToken });

      expect(result).toEqual(mockNewTokenPair);
    });

    it('should propagate UnauthorizedException for invalid token', async () => {
      mockJwtAuth.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      await expect(controller.refresh({ refreshToken: mockRefreshToken })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should propagate error for revoked token', async () => {
      mockJwtAuth.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Refresh token has been revoked'),
      );

      await expect(controller.refresh({ refreshToken: mockRefreshToken })).rejects.toThrow(
        'Refresh token has been revoked',
      );
    });
  });
});
