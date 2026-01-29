/**
 * Auth Service Integration Tests
 * Tests wallet authentication and JWT token management with Redis
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ethers, HDNodeWallet } from 'ethers';
import { WalletAuthService } from '../../auth/services/wallet-auth.service';
import { JwtAuthService } from '../../auth/services/jwt-auth.service';
import { RedisModule, RedisService } from '@hodlfun/redis';

describe('Auth Integration', () => {
  let walletAuthService: WalletAuthService;
  let jwtAuthService: JwtAuthService;
  let redis: RedisService;
  let testWallet: HDNodeWallet;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
              JWT_SECRET: 'test-jwt-secret-for-integration-tests',
              JWT_EXPIRES_IN: '1h',
              JWT_REFRESH_SECRET: 'test-refresh-secret-for-integration-tests',
              JWT_REFRESH_EXPIRES_IN: '7d',
            }),
          ],
        }),
        RedisModule,
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            secret: configService.get<string>('JWT_SECRET'),
            signOptions: {
              expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
            },
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [WalletAuthService, JwtAuthService],
    }).compile();

    walletAuthService = module.get<WalletAuthService>(WalletAuthService);
    jwtAuthService = module.get<JwtAuthService>(JwtAuthService);
    redis = module.get<RedisService>(RedisService);
    testWallet = ethers.Wallet.createRandom();
  });

  beforeEach(async () => {
    // Clean Redis
    const keys = await redis.keys('auth:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('Full Authentication Flow', () => {
    it('should complete nonce -> sign -> verify -> tokens flow', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      // Step 1: Generate nonce
      const nonceResult = await walletAuthService.generateNonce(walletAddress);
      expect(nonceResult.nonce).toBeDefined();
      expect(nonceResult.message).toContain('Welcome to Hodl.fun!');

      // Step 2: Sign the message
      const signature = await testWallet.signMessage(nonceResult.message);

      // Step 3: Verify signature
      const isValid = await walletAuthService.verifySignature(walletAddress, signature);
      expect(isValid).toBe(true);

      // Step 4: Generate tokens
      const tokens = await jwtAuthService.generateTokenPair(walletAddress);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(3600);
    });

    it('should reject invalid signature', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      // Generate nonce
      await walletAuthService.generateNonce(walletAddress);

      // Try with invalid signature
      await expect(
        walletAuthService.verifySignature(walletAddress, '0xinvalid'),
      ).rejects.toThrow('Invalid signature');
    });

    it('should reject expired nonce', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      // Try to verify without generating nonce first
      await expect(
        walletAuthService.verifySignature(walletAddress, '0xsignature'),
      ).rejects.toThrow('Nonce expired or not found');
    });

    it('should prevent nonce reuse', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      // Generate nonce
      const nonceResult = await walletAuthService.generateNonce(walletAddress);
      const signature = await testWallet.signMessage(nonceResult.message);

      // First verification should succeed
      const isValid = await walletAuthService.verifySignature(walletAddress, signature);
      expect(isValid).toBe(true);

      // Second verification should fail (nonce was deleted)
      await expect(
        walletAuthService.verifySignature(walletAddress, signature),
      ).rejects.toThrow('Nonce expired or not found');
    });
  });

  describe('JWT Token Management', () => {
    it('should generate valid access and refresh tokens', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      const tokens = await jwtAuthService.generateTokenPair(walletAddress);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(3600);

      // Access token should be a valid JWT
      const parts = tokens.accessToken.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should refresh tokens with valid refresh token', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      // Generate initial tokens
      const initialTokens = await jwtAuthService.generateTokenPair(walletAddress);

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Refresh tokens
      const newTokens = await jwtAuthService.refreshTokens(initialTokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      // Refresh tokens will be different because of jti (JWT ID)
      expect(newTokens.refreshToken).not.toBe(initialTokens.refreshToken);
    });

    it('should reject reused refresh token (token rotation)', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      // Generate initial tokens
      const initialTokens = await jwtAuthService.generateTokenPair(walletAddress);

      // First refresh - should succeed
      await jwtAuthService.refreshTokens(initialTokens.refreshToken);

      // Second refresh with same token - should fail
      await expect(
        jwtAuthService.refreshTokens(initialTokens.refreshToken),
      ).rejects.toThrow();
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        jwtAuthService.refreshTokens('invalid-token'),
      ).rejects.toThrow();
    });

    it('should revoke all refresh tokens for a wallet', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      // Generate tokens
      await jwtAuthService.generateTokenPair(walletAddress);

      // Revoke all refresh tokens
      await jwtAuthService.revokeAllRefreshTokens(walletAddress);

      // Check Redis - tokens should be gone
      const keys = await redis.keys(`auth:refresh:${walletAddress}:*`);
      expect(keys.length).toBe(0);
    });
  });

  describe('Nonce Storage', () => {
    it('should store nonce in Redis with TTL', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      await walletAuthService.generateNonce(walletAddress);

      // Check Redis directly
      const stored = await redis.get(`auth:nonce:${walletAddress}`);
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed.nonce).toBeDefined();
      expect(parsed.timestamp).toBeDefined();

      // Check TTL is set (should be around 300 seconds)
      const ttl = await redis.ttl(`auth:nonce:${walletAddress}`);
      expect(ttl).toBeGreaterThan(290);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('should overwrite existing nonce on regeneration', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      // Generate first nonce
      const first = await walletAuthService.generateNonce(walletAddress);

      // Generate second nonce
      const second = await walletAuthService.generateNonce(walletAddress);

      expect(first.nonce).not.toBe(second.nonce);

      // Check only one nonce in Redis
      const stored = await redis.get(`auth:nonce:${walletAddress}`);
      const parsed = JSON.parse(stored!);
      expect(parsed.nonce).toBe(second.nonce);
    });
  });

  describe('Refresh Token Storage', () => {
    it('should store refresh token in Redis', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      const tokens = await jwtAuthService.generateTokenPair(walletAddress);

      // Check Redis for refresh token
      const keys = await redis.keys(`auth:refresh:${walletAddress}:*`);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should clean up refresh token on revocation', async () => {
      const walletAddress = testWallet.address.toLowerCase();

      await jwtAuthService.generateTokenPair(walletAddress);

      // Revoke all tokens for the wallet
      await jwtAuthService.revokeAllRefreshTokens(walletAddress);

      // Check Redis - token should be gone
      const keys = await redis.keys(`auth:refresh:${walletAddress}:*`);
      expect(keys.length).toBe(0);
    });
  });
});
