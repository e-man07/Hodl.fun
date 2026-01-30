import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '@hodlfun/database';
import { CacheService } from '@hodlfun/redis';
import { AuthType } from '@prisma/client';

// Mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  userPortfolio: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  holder: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  trade: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  token: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

// Mock CacheService
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  getOrSet: jest.fn(),
  delete: jest.fn(),
};

describe('UsersService - Extended User Model', () => {
  let service: UsersService;
  let prisma: typeof mockPrismaService;
  let cache: typeof mockCacheService;

  const mockWalletUser = {
    id: 'user-123',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    pushDid: null,
    email: null,
    authType: AuthType.WALLET,
    isAdmin: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-29T00:00:00Z'),
    lastLoginAt: new Date('2026-01-29T10:00:00Z'),
    totalInvested: '1000000000000000000',
    totalReturned: '500000000000000000',
    totalTrades: 5,
  };

  const mockSocialUser = {
    id: 'user-456',
    walletAddress: null,
    pushDid: 'did:push:abc123',
    email: 'user@example.com',
    authType: AuthType.SOCIAL,
    isAdmin: false,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    updatedAt: new Date('2026-01-29T00:00:00Z'),
    lastLoginAt: new Date('2026-01-29T12:00:00Z'),
    totalInvested: '0',
    totalReturned: '0',
    totalTrades: 0,
  };

  const mockAdminUser = {
    ...mockWalletUser,
    id: 'admin-789',
    isAdmin: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = mockPrismaService;
    cache = mockCacheService;
  });

  describe('findByWallet', () => {
    it('should find user by wallet address', async () => {
      prisma.user.findUnique.mockResolvedValue(mockWalletUser);

      const result = await service.findByWallet(mockWalletUser.walletAddress!);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { walletAddress: mockWalletUser.walletAddress!.toLowerCase() },
      });
      expect(result).toEqual(mockWalletUser);
    });

    it('should return null for non-existent wallet', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByWallet('0xnonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByPushDid', () => {
    it('should find user by Push DID', async () => {
      prisma.user.findUnique.mockResolvedValue(mockSocialUser);

      const result = await service.findByPushDid(mockSocialUser.pushDid!);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { pushDid: mockSocialUser.pushDid },
      });
      expect(result).toEqual(mockSocialUser);
    });

    it('should return null for non-existent Push DID', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByPushDid('did:push:nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createWalletUser', () => {
    it('should create a new wallet user', async () => {
      prisma.user.create.mockResolvedValue(mockWalletUser);

      const result = await service.createWalletUser(mockWalletUser.walletAddress!);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          walletAddress: mockWalletUser.walletAddress!.toLowerCase(),
          authType: AuthType.WALLET,
        },
      });
      expect(result).toEqual(mockWalletUser);
    });
  });

  describe('createSocialUser', () => {
    it('should create a new social user with Push DID', async () => {
      prisma.user.create.mockResolvedValue(mockSocialUser);

      const result = await service.createSocialUser({
        pushDid: mockSocialUser.pushDid!,
        email: mockSocialUser.email!,
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          pushDid: mockSocialUser.pushDid,
          email: mockSocialUser.email,
          authType: AuthType.SOCIAL,
        },
      });
      expect(result).toEqual(mockSocialUser);
    });

    it('should create social user without email', async () => {
      const noEmailUser = { ...mockSocialUser, email: null };
      prisma.user.create.mockResolvedValue(noEmailUser);

      const result = await service.createSocialUser({
        pushDid: mockSocialUser.pushDid!,
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          pushDid: mockSocialUser.pushDid,
          email: undefined,
          authType: AuthType.SOCIAL,
        },
      });
      expect(result.email).toBeNull();
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const now = new Date();
      prisma.user.update.mockResolvedValue({ ...mockWalletUser, lastLoginAt: now });

      await service.updateLastLogin(mockWalletUser.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockWalletUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('linkWalletToSocialUser', () => {
    it('should link wallet address to social user', async () => {
      const linkedUser = {
        ...mockSocialUser,
        walletAddress: mockWalletUser.walletAddress,
      };
      prisma.user.update.mockResolvedValue(linkedUser);

      const result = await service.linkWalletToSocialUser(
        mockSocialUser.id,
        mockWalletUser.walletAddress!,
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockSocialUser.id },
        data: { walletAddress: mockWalletUser.walletAddress!.toLowerCase() },
      });
      expect(result.walletAddress).toBe(mockWalletUser.walletAddress);
    });
  });

  describe('setAdminStatus', () => {
    it('should grant admin status to user', async () => {
      prisma.user.update.mockResolvedValue(mockAdminUser);

      const result = await service.setAdminStatus(mockWalletUser.id, true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockWalletUser.id },
        data: { isAdmin: true },
      });
      expect(result.isAdmin).toBe(true);
    });

    it('should revoke admin status from user', async () => {
      prisma.user.update.mockResolvedValue({ ...mockAdminUser, isAdmin: false });

      const result = await service.setAdminStatus(mockAdminUser.id, false);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockAdminUser.id },
        data: { isAdmin: false },
      });
      expect(result.isAdmin).toBe(false);
    });
  });

  describe('findAdmins', () => {
    it('should return all admin users', async () => {
      prisma.user.findMany.mockResolvedValue([mockAdminUser]);

      const result = await service.findAdmins();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { isAdmin: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].isAdmin).toBe(true);
    });
  });

  describe('getOrCreateWalletUser', () => {
    it('should return existing user if found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockWalletUser);

      const result = await service.getOrCreateWalletUser(mockWalletUser.walletAddress!);

      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockWalletUser);
    });

    it('should create new user if not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockWalletUser);

      const result = await service.getOrCreateWalletUser(mockWalletUser.walletAddress!);

      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result).toEqual(mockWalletUser);
    });
  });

  describe('updateEmail', () => {
    it('should update user email', async () => {
      const newEmail = 'newemail@example.com';
      prisma.user.update.mockResolvedValue({ ...mockWalletUser, email: newEmail });

      const result = await service.updateEmail(mockWalletUser.id, newEmail);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockWalletUser.id },
        data: { email: newEmail },
      });
      expect(result.email).toBe(newEmail);
    });
  });

  describe('AuthType enum', () => {
    it('should have WALLET type', () => {
      expect(AuthType.WALLET).toBe('WALLET');
    });

    it('should have SOCIAL type', () => {
      expect(AuthType.SOCIAL).toBe('SOCIAL');
    });
  });
});
