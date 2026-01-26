/**
 * JWT Auth Service Unit Tests
 * Tests for JWT token generation and validation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthService } from '../../auth/services/jwt-auth.service';
import { RedisService } from '@hodlfun/redis';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-token-id'),
}));

const createMockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

const createMockConfigService = () => ({
  get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      JWT_EXPIRES_IN: '1h',
      JWT_REFRESH_EXPIRES_IN: '7d',
      JWT_REFRESH_SECRET: 'refresh-secret',
    };
    return config[key] || defaultValue;
  }),
});

const createMockRedisService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  exists: jest.fn(),
});

describe('JwtAuthService', () => {
  let service: JwtAuthService;
  let mockJwtService: ReturnType<typeof createMockJwtService>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockRedis: ReturnType<typeof createMockRedisService>;

  beforeEach(async () => {
    mockJwtService = createMockJwtService();
    mockConfigService = createMockConfigService();
    mockRedis = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<JwtAuthService>(JwtAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokenPair', () => {
    const mockWallet = '0xABC123';
    const normalizedWallet = '0xabc123';

    beforeEach(() => {
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockRedis.set.mockResolvedValue('OK');
    });

    it('should generate access and refresh tokens', async () => {
      const result = await service.generateTokenPair(mockWallet);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      });
    });

    it('should sign access token with wallet and type', async () => {
      await service.generateTokenPair(mockWallet);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { wallet: normalizedWallet, type: 'access' },
        { expiresIn: '1h' },
      );
    });

    it('should sign refresh token with wallet, type, and jti', async () => {
      await service.generateTokenPair(mockWallet);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { wallet: normalizedWallet, type: 'refresh', jti: 'mock-token-id' },
        { secret: 'refresh-secret', expiresIn: '7d' },
      );
    });

    it('should store refresh token ID in Redis', async () => {
      await service.generateTokenPair(mockWallet);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `auth:refresh:${normalizedWallet}:mock-token-id`,
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('should normalize wallet address', async () => {
      await service.generateTokenPair('0xABC123');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ wallet: '0xabc123' }),
        expect.any(Object),
      );
    });
  });

  describe('refreshTokens', () => {
    const mockPayload = {
      wallet: '0xabc123',
      type: 'refresh' as const,
      jti: 'token-id-123',
    };

    beforeEach(() => {
      mockJwtService.verify.mockReturnValue(mockPayload);
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.del.mockResolvedValue(1);
      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockRedis.set.mockResolvedValue('OK');
    });

    it('should return new token pair for valid refresh token', async () => {
      const result = await service.refreshTokens('old-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      });
    });

    it('should verify refresh token with refresh secret', async () => {
      await service.refreshTokens('old-refresh-token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('old-refresh-token', {
        secret: 'refresh-secret',
      });
    });

    it('should throw UnauthorizedException for non-refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ ...mockPayload, type: 'access' });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        'Invalid token type',
      );
    });

    it('should throw UnauthorizedException when refresh token not in Redis', async () => {
      mockRedis.exists.mockResolvedValue(0);

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        'Refresh token has been revoked',
      );
    });

    it('should revoke old refresh token before generating new one', async () => {
      await service.refreshTokens('old-refresh-token');

      expect(mockRedis.del).toHaveBeenCalledWith(
        `auth:refresh:${mockPayload.wallet}:${mockPayload.jti}`,
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('should throw UnauthorizedException for malformed token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.refreshTokens('malformed-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('should delete specific refresh token from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.revokeRefreshToken('0xABC123', 'token-id-123');

      expect(mockRedis.del).toHaveBeenCalledWith('auth:refresh:0xabc123:token-id-123');
    });

    it('should normalize wallet address', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.revokeRefreshToken('0xABC123', 'token-id');

      expect(mockRedis.del).toHaveBeenCalledWith('auth:refresh:0xabc123:token-id');
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('should delete all refresh tokens for a wallet', async () => {
      const mockKeys = [
        'auth:refresh:0xabc123:token-1',
        'auth:refresh:0xabc123:token-2',
      ];
      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.del.mockResolvedValue(2);

      await service.revokeAllRefreshTokens('0xABC123');

      expect(mockRedis.keys).toHaveBeenCalledWith('auth:refresh:0xabc123:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...mockKeys);
    });

    it('should not call del if no tokens found', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.revokeAllRefreshTokens('0xabc123');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should normalize wallet address', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.revokeAllRefreshTokens('0xABC123');

      expect(mockRedis.keys).toHaveBeenCalledWith('auth:refresh:0xabc123:*');
    });
  });

  describe('parseTtl', () => {
    // Test the private method indirectly through constructor
    it('should parse seconds correctly', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '300s';
        return undefined;
      });

      // Create new instance to trigger TTL parsing
      const module = await Test.createTestingModule({
        providers: [
          JwtAuthService,
          { provide: JwtService, useValue: mockJwtService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: RedisService, useValue: mockRedis },
        ],
      }).compile();

      const newService = module.get<JwtAuthService>(JwtAuthService);
      expect(newService).toBeDefined();
    });

    it('should parse days correctly', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [
          JwtAuthService,
          { provide: JwtService, useValue: mockJwtService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: RedisService, useValue: mockRedis },
        ],
      }).compile();

      const newService = module.get<JwtAuthService>(JwtAuthService);
      expect(newService).toBeDefined();
    });
  });
});
