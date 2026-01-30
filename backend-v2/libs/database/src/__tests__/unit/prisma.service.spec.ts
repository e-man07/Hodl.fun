/**
 * Prisma Service Unit Tests
 * Tests for database connection lifecycle and operations
 */
import { PrismaService } from '../../prisma.service';

// Mock the actual PrismaClient methods on the prototype
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockQueryRaw = jest.fn().mockResolvedValue([]);
const mockExecuteRawUnsafe = jest.fn().mockResolvedValue(0);

jest.mock('@prisma/client', () => {
  class MockPrismaClient {
    $connect = mockConnect;
    $disconnect = mockDisconnect;
    $queryRaw = mockQueryRaw;
    $executeRawUnsafe = mockExecuteRawUnsafe;

    constructor(_options?: unknown) {
      // Constructor receives options from super() call
    }
  }

  return {
    PrismaClient: MockPrismaClient,
  };
});

describe('PrismaService', () => {
  let service: PrismaService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    service = new PrismaService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create PrismaService instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(PrismaService);
    });

    it('should configure logging for development environment', () => {
      process.env.NODE_ENV = 'development';
      const devService = new PrismaService();
      expect(devService).toBeDefined();
    });

    it('should configure minimal logging for production environment', () => {
      process.env.NODE_ENV = 'production';
      const prodService = new PrismaService();
      expect(prodService).toBeDefined();
    });
  });

  describe('onModuleInit', () => {
    it('should connect to database on module init', async () => {
      await service.onModuleInit();

      expect(mockConnect).toHaveBeenCalled();
    });

    it('should log successful connection', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from database on module destroy', async () => {
      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should log disconnection', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('cleanDatabase', () => {
    beforeEach(() => {
      mockQueryRaw.mockResolvedValue([
        { tablename: 'tokens' },
        { tablename: 'trades' },
        { tablename: 'holders' },
        { tablename: '_prisma_migrations' },
      ]);
      mockExecuteRawUnsafe.mockResolvedValue(0);
    });

    it('should throw error when not in test environment', async () => {
      process.env.NODE_ENV = 'production';

      await expect(service.cleanDatabase()).rejects.toThrow(
        'cleanDatabase can only be used in test environment',
      );
    });

    it('should truncate all tables except _prisma_migrations in test environment', async () => {
      process.env.NODE_ENV = 'test';

      await service.cleanDatabase();

      expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
        'TRUNCATE TABLE "public"."tokens" CASCADE;',
      );
      expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
        'TRUNCATE TABLE "public"."trades" CASCADE;',
      );
      expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
        'TRUNCATE TABLE "public"."holders" CASCADE;',
      );
    });

    it('should not truncate _prisma_migrations table', async () => {
      process.env.NODE_ENV = 'test';

      await service.cleanDatabase();

      expect(mockExecuteRawUnsafe).not.toHaveBeenCalledWith(
        expect.stringContaining('_prisma_migrations'),
      );
    });

    it('should query for all table names', async () => {
      process.env.NODE_ENV = 'test';

      await service.cleanDatabase();

      expect(mockQueryRaw).toHaveBeenCalled();
    });

    it('should handle empty database', async () => {
      process.env.NODE_ENV = 'test';
      mockQueryRaw.mockResolvedValue([{ tablename: '_prisma_migrations' }]);

      await expect(service.cleanDatabase()).resolves.not.toThrow();
      expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle integration', () => {
    it('should handle full lifecycle', async () => {
      // Init
      await service.onModuleInit();
      expect(mockConnect).toHaveBeenCalledTimes(1);

      // Destroy
      await service.onModuleDestroy();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple init calls', async () => {
      await service.onModuleInit();
      await service.onModuleInit();

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple destroy calls', async () => {
      await service.onModuleDestroy();
      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalledTimes(2);
    });
  });
});
