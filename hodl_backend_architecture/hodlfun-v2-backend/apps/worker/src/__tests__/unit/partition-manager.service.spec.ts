import { Test, TestingModule } from '@nestjs/testing';
import { PartitionManagerService } from '../../cleanup/partition-manager.service';
import { PrismaService } from '@hodlfun/database';

describe('PartitionManagerService', () => {
  let service: PartitionManagerService;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartitionManagerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PartitionManagerService>(PartitionManagerService);
  });

  describe('onModuleInit', () => {
    it('should check and create partitions on startup', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ exists: true }]);

      await service.onModuleInit();

      // Should check for 3 months (current + 2 future)
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
    });
  });

  describe('ensurePartitionsExist', () => {
    it('should check partitions for current and next 2 months', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ exists: true }]);

      await service.ensurePartitionsExist();

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
    });

    it('should create partition if it does not exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ exists: false }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      await service.ensurePartitionsExist();

      // Should try to create 3 partitions
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    });

    it('should not create partition if it already exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ exists: true }]);

      await service.ensurePartitionsExist();

      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Table not partitioned'));

      // Should not throw
      await expect(service.ensurePartitionsExist()).resolves.toBeUndefined();
    });
  });

  describe('handlePartitionCreation', () => {
    it('should call ensurePartitionsExist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ exists: true }]);

      await service.handlePartitionCreation();

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('getPartitionStats', () => {
    it('should return partition statistics', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { relname: 'price_history_2026_01', n_live_tup: 1000n },
        { relname: 'price_history_2026_02', n_live_tup: 500n },
      ]);

      const stats = await service.getPartitionStats();

      expect(stats.partitionCount).toBe(2);
      expect(stats.partitions).toHaveLength(2);
      expect(stats.partitions[0].name).toBe('price_history_2026_01');
      expect(stats.partitions[0].rowCount).toBe(1000);
    });

    it('should return empty stats if table is not partitioned', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Not partitioned'));

      const stats = await service.getPartitionStats();

      expect(stats.partitionCount).toBe(0);
      expect(stats.partitions).toHaveLength(0);
    });
  });

  describe('partition naming', () => {
    it('should use correct partition name format', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ exists: false }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

      await service.ensurePartitionsExist();

      // Verify partition name format is price_history_YYYY_MM
      const createCalls = mockPrisma.$executeRawUnsafe.mock.calls;
      createCalls.forEach((call) => {
        expect(call[0]).toMatch(/price_history_\d{4}_\d{2}/);
      });
    });
  });
});
