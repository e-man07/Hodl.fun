/**
 * Health Controller Unit Tests
 * Tests for health check endpoints
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../health/health.controller';
import { PrismaService } from '@hodlfun/database';
import { RedisService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';

const createMockPrismaService = () => ({
  $queryRaw: jest.fn(),
});

const createMockRedisService = () => ({
  ping: jest.fn(),
});

const createMockMetricsService = () => ({
  getMetrics: jest.fn(),
});

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockRedis: ReturnType<typeof createMockRedisService>;
  let mockMetrics: ReturnType<typeof createMockMetricsService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockRedis = createMockRedisService();
    mockMetrics = createMockMetricsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startup', () => {
    it('should return ok status', async () => {
      const result = await controller.startup();

      expect(result.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const before = new Date().toISOString();
      const result = await controller.startup();
      const after = new Date().toISOString();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });
  });

  describe('live', () => {
    it('should return ok status', async () => {
      const result = await controller.live();

      expect(result.status).toBe('ok');
    });

    it('should include timestamp', async () => {
      const result = await controller.live();

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('ready', () => {
    it('should return healthy when all checks pass', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await controller.ready();

      expect(result.status).toBe('healthy');
      expect(result.checks.database).toBe('up');
      expect(result.checks.redis).toBe('up');
    });

    it('should return unhealthy when database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await controller.ready();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database).toBe('down');
      expect(result.checks.redis).toBe('up');
    });

    it('should return unhealthy when redis is down', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.ready();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database).toBe('up');
      expect(result.checks.redis).toBe('down');
    });

    it('should return unhealthy when all services are down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const result = await controller.ready();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database).toBe('down');
      expect(result.checks.redis).toBe('down');
    });

    it('should include timestamp in response', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await controller.ready();

      expect(result.timestamp).toBeDefined();
    });

    it('should check database and redis concurrently', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      await controller.ready();

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockRedis.ping).toHaveBeenCalledTimes(1);
    });
  });

  describe('metrics', () => {
    it('should return metrics data', async () => {
      const mockMetricsData = `
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/tokens"} 100
`;
      mockMetrics.getMetrics.mockResolvedValue(mockMetricsData);

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
      };

      await controller.metrics(mockRes as any);

      expect(mockMetrics.getMetrics).toHaveBeenCalled();
      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'text/plain');
      expect(mockRes.send).toHaveBeenCalledWith(mockMetricsData);
    });

    it('should set correct content type for prometheus', async () => {
      mockMetrics.getMetrics.mockResolvedValue('');

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
      };

      await controller.metrics(mockRes as any);

      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'text/plain');
    });

    it('should handle metrics service errors', async () => {
      mockMetrics.getMetrics.mockRejectedValue(new Error('Metrics error'));

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
      };

      await expect(controller.metrics(mockRes as any)).rejects.toThrow('Metrics error');
    });
  });
});
