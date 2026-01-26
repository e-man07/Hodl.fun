/**
 * Wallet Auth Service Unit Tests
 * Tests for wallet-based authentication with signature verification
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WalletAuthService } from '../../auth/services/wallet-auth.service';
import { RedisService } from '@hodlfun/redis';
import { ethers } from 'ethers';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    verifyMessage: jest.fn(),
  },
}));

const createMockRedisService = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
});

describe('WalletAuthService', () => {
  let service: WalletAuthService;
  let mockRedis: ReturnType<typeof createMockRedisService>;

  beforeEach(async () => {
    mockRedis = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletAuthService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<WalletAuthService>(WalletAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateNonce', () => {
    const mockWallet = '0xABC123DEF456';
    const normalizedWallet = '0xabc123def456';

    it('should generate nonce and store in Redis', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateNonce(mockWallet);

      expect(result.nonce).toBe('mock-uuid-1234');
      expect(result.message).toContain('Welcome to Hodl.fun!');
      expect(result.message).toContain('Nonce: mock-uuid-1234');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should store nonce with 5 minute TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.generateNonce(mockWallet);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `auth:nonce:${normalizedWallet}`,
        expect.any(String),
        'EX',
        300,
      );
    });

    it('should normalize wallet address to lowercase', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.generateNonce('0xABC123DEF456');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'auth:nonce:0xabc123def456',
        expect.any(String),
        'EX',
        300,
      );
    });

    it('should include timestamp in stored data', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.generateNonce(mockWallet);

      const setCall = mockRedis.set.mock.calls[0];
      const storedData = JSON.parse(setCall[1]);

      expect(storedData.nonce).toBe('mock-uuid-1234');
      expect(storedData.timestamp).toBeDefined();
      expect(typeof storedData.timestamp).toBe('number');
    });

    it('should set expiration date 5 minutes in future', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const before = Date.now();

      const result = await service.generateNonce(mockWallet);

      const after = Date.now();
      const expectedMin = before + 300 * 1000;
      const expectedMax = after + 300 * 1000;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should include message content for signing', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.generateNonce(mockWallet);

      expect(result.message).toContain('Welcome to Hodl.fun!');
      expect(result.message).toContain('Sign this message to verify your wallet');
      expect(result.message).toContain('This will not trigger any blockchain transaction');
    });
  });

  describe('verifySignature', () => {
    const mockWallet = '0xABC123DEF456';
    const normalizedWallet = '0xabc123def456';
    const mockSignature = '0xsignature';
    const mockNonce = 'mock-uuid-1234';
    const mockTimestamp = 1704067200000;

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ nonce: mockNonce, timestamp: mockTimestamp }),
      );
    });

    it('should verify valid signature and return true', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(normalizedWallet);
      mockRedis.del.mockResolvedValue(1);

      const result = await service.verifySignature(mockWallet, mockSignature);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when nonce not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verifySignature(mockWallet, mockSignature)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifySignature(mockWallet, mockSignature)).rejects.toThrow(
        'Nonce expired or not found',
      );
    });

    it('should verify message matches stored nonce', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(normalizedWallet);
      mockRedis.del.mockResolvedValue(1);

      await service.verifySignature(mockWallet, mockSignature);

      expect(ethers.verifyMessage).toHaveBeenCalledWith(
        expect.stringContaining(`Nonce: ${mockNonce}`),
        mockSignature,
      );
    });

    it('should delete nonce after successful verification (one-time use)', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(normalizedWallet);
      mockRedis.del.mockResolvedValue(1);

      await service.verifySignature(mockWallet, mockSignature);

      expect(mockRedis.del).toHaveBeenCalledWith(`auth:nonce:${normalizedWallet}`);
    });

    it('should not delete nonce if verification fails', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue('0xdifferentaddress');

      const result = await service.verifySignature(mockWallet, mockSignature);

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return false for mismatched wallet address', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue('0xdifferentaddress');

      const result = await service.verifySignature(mockWallet, mockSignature);

      expect(result).toBe(false);
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      (ethers.verifyMessage as jest.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.verifySignature(mockWallet, mockSignature)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifySignature(mockWallet, mockSignature)).rejects.toThrow(
        'Invalid signature',
      );
    });

    it('should normalize wallet address comparison', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue('0xABC123DEF456'); // uppercase
      mockRedis.del.mockResolvedValue(1);

      const result = await service.verifySignature('0xabc123def456', mockSignature);

      expect(result).toBe(true);
    });

    it('should look up nonce with normalized address', async () => {
      (ethers.verifyMessage as jest.Mock).mockReturnValue(normalizedWallet);
      mockRedis.del.mockResolvedValue(1);

      await service.verifySignature('0xABC123DEF456', mockSignature);

      expect(mockRedis.get).toHaveBeenCalledWith('auth:nonce:0xabc123def456');
    });
  });
});
