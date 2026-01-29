import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, AuditAction, PRISMA_SERVICE } from '../../audit';

// Mock PrismaService
const mockPrismaService = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
};

describe('AuditService', () => {
  let service: AuditService;
  let prisma: typeof mockPrismaService;

  const mockAuditLog = {
    id: 'audit-123',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    action: AuditAction.AUTH_LOGIN,
    entityType: 'user',
    entityId: 'user-456',
    details: { method: 'wallet' },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2026-01-29T10:00:00Z'),
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PRISMA_SERVICE,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = mockPrismaService;
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.log({
        walletAddress: mockAuditLog.walletAddress,
        action: AuditAction.AUTH_LOGIN,
        entityType: 'user',
        entityId: 'user-456',
        details: { method: 'wallet' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          walletAddress: mockAuditLog.walletAddress,
          action: AuditAction.AUTH_LOGIN,
          entityType: 'user',
          entityId: 'user-456',
          details: { method: 'wallet' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should create audit log with minimal fields', async () => {
      const minimalLog = {
        id: 'audit-minimal',
        walletAddress: null,
        action: AuditAction.SYSTEM_ERROR,
        entityType: null,
        entityId: null,
        details: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      };

      prisma.auditLog.create.mockResolvedValue(minimalLog);

      const result = await service.log({
        action: AuditAction.SYSTEM_ERROR,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: AuditAction.SYSTEM_ERROR,
          walletAddress: undefined,
          entityType: undefined,
          entityId: undefined,
          details: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
      expect(result.action).toBe(AuditAction.SYSTEM_ERROR);
    });

    it('should throw on database errors', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.log({ action: AuditAction.AUTH_LOGIN })).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('logSafe', () => {
    it('should not throw on database errors', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('Database error'));

      // logSafe should never throw
      await expect(service.logSafe({ action: AuditAction.AUTH_LOGIN })).resolves.toBeUndefined();
    });

    it('should return undefined on success', async () => {
      prisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logSafe({ action: AuditAction.AUTH_LOGIN });

      expect(result).toBeUndefined();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('findByWallet', () => {
    it('should return audit logs for a wallet address', async () => {
      const logs = [mockAuditLog, { ...mockAuditLog, id: 'audit-124' }];
      prisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.findByWallet(mockAuditLog.walletAddress!);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { walletAddress: mockAuditLog.walletAddress },
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
      });
      expect(result).toEqual(logs);
    });

    it('should support pagination', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.findByWallet(mockAuditLog.walletAddress!, { limit: 50, offset: 10 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { walletAddress: mockAuditLog.walletAddress },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 10,
      });
    });
  });

  describe('findByAction', () => {
    it('should return audit logs for a specific action', async () => {
      const logs = [mockAuditLog];
      prisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.findByAction(AuditAction.AUTH_LOGIN);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { action: AuditAction.AUTH_LOGIN },
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
      });
      expect(result).toEqual(logs);
    });
  });

  describe('findByEntity', () => {
    it('should return audit logs for a specific entity', async () => {
      const logs = [mockAuditLog];
      prisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.findByEntity('user', 'user-456');

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: 'user', entityId: 'user-456' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        skip: 0,
      });
      expect(result).toEqual(logs);
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const logs = [mockAuditLog];
      prisma.auditLog.findMany.mockResolvedValue(logs);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ limit: 20, offset: 0 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        data: logs,
        total: 1,
        limit: 20,
        offset: 0,
      });
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({
        limit: 20,
        offset: 0,
        startDate,
        endDate,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by action', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({
        limit: 20,
        offset: 0,
        action: AuditAction.AUTH_LOGIN,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { action: AuditAction.AUTH_LOGIN },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by wallet address', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({
        limit: 20,
        offset: 0,
        walletAddress: mockAuditLog.walletAddress!,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { walletAddress: mockAuditLog.walletAddress },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });
  });

  describe('AuditAction enum', () => {
    it('should have auth actions', () => {
      expect(AuditAction.AUTH_LOGIN).toBe('auth:login');
      expect(AuditAction.AUTH_LOGOUT).toBe('auth:logout');
      expect(AuditAction.AUTH_REFRESH).toBe('auth:refresh');
    });

    it('should have token actions', () => {
      expect(AuditAction.TOKEN_CREATE).toBe('token:create');
      expect(AuditAction.TOKEN_TRADE).toBe('token:trade');
    });

    it('should have admin actions', () => {
      expect(AuditAction.ADMIN_CONFIG_UPDATE).toBe('admin:config_update');
      expect(AuditAction.ADMIN_USER_BAN).toBe('admin:user_ban');
    });

    it('should have system actions', () => {
      expect(AuditAction.SYSTEM_ERROR).toBe('system:error');
      expect(AuditAction.RATE_LIMIT_EXCEEDED).toBe('system:rate_limit_exceeded');
    });
  });
});
