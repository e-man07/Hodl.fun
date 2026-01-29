import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { DlqService, DlqJob, DlqJobStatus } from '../../dlq.service';
import { RedisService } from '../../redis.service';

describe('DlqService', () => {
  let service: DlqService;
  let redisService: RedisService;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    incr: jest.fn(),
    lpush: jest.fn(),
    lrange: jest.fn(),
    llen: jest.fn(),
    lrem: jest.fn(),
    hset: jest.fn(),
    hget: jest.fn(),
    hgetall: jest.fn(),
    hdel: jest.fn(),
    zadd: jest.fn(),
    zrange: jest.fn(),
    zrangebyscore: jest.fn(),
    zrem: jest.fn(),
    zcard: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<DlqService>(DlqService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe('addToDeadLetterQueue', () => {
    it('should add a failed job to the DLQ', async () => {
      const job: Omit<DlqJob, 'id' | 'addedAt' | 'status'> = {
        queue: 'test-queue',
        jobName: 'test-job',
        payload: { data: 'test' },
        error: 'Test error message',
        attempts: 3,
        lastAttemptAt: new Date(),
      };

      mockRedisService.zadd.mockResolvedValue(1);
      mockRedisService.hset.mockResolvedValue(1);
      mockRedisService.incr.mockResolvedValue(1);

      const result = await service.addToDeadLetterQueue(job);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe(DlqJobStatus.PENDING);
      expect(mockRedisService.hset).toHaveBeenCalled();
      expect(mockRedisService.zadd).toHaveBeenCalled();
    });

    it('should generate unique job IDs', async () => {
      mockRedisService.zadd.mockResolvedValue(1);
      mockRedisService.hset.mockResolvedValue(1);
      mockRedisService.incr.mockResolvedValue(1);

      const job = {
        queue: 'test-queue',
        jobName: 'test-job',
        payload: {},
        error: 'error',
        attempts: 1,
        lastAttemptAt: new Date(),
      };

      const result1 = await service.addToDeadLetterQueue(job);
      mockRedisService.incr.mockResolvedValue(2);
      const result2 = await service.addToDeadLetterQueue(job);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('getDeadLetterJobs', () => {
    it('should return paginated list of DLQ jobs', async () => {
      const mockJobs = [
        {
          id: 'dlq:1',
          queue: 'test-queue',
          jobName: 'job1',
          payload: '{}',
          error: 'error1',
          attempts: '3',
          status: DlqJobStatus.PENDING,
          addedAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
        },
      ];

      mockRedisService.zrange.mockResolvedValue(['dlq:1']);
      mockRedisService.hgetall.mockResolvedValue(mockJobs[0]);
      mockRedisService.zcard.mockResolvedValue(1);

      const result = await service.getDeadLetterJobs({ page: 1, limit: 10 });

      expect(result.jobs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by queue name', async () => {
      mockRedisService.zrange.mockResolvedValue(['dlq:1', 'dlq:2']);
      mockRedisService.hgetall
        .mockResolvedValueOnce({
          id: 'dlq:1',
          queue: 'queue-a',
          jobName: 'job1',
          payload: '{}',
          error: 'error',
          attempts: '3',
          status: DlqJobStatus.PENDING,
          addedAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'dlq:2',
          queue: 'queue-b',
          jobName: 'job2',
          payload: '{}',
          error: 'error',
          attempts: '3',
          status: DlqJobStatus.PENDING,
          addedAt: new Date().toISOString(),
          lastAttemptAt: new Date().toISOString(),
        });
      mockRedisService.zcard.mockResolvedValue(2);

      const result = await service.getDeadLetterJobs({
        page: 1,
        limit: 10,
        queue: 'queue-a',
      });

      expect(result.jobs.every((j) => j.queue === 'queue-a')).toBe(true);
    });
  });

  describe('getDeadLetterJob', () => {
    it('should return a specific job by ID', async () => {
      const mockJob = {
        id: 'dlq:1',
        queue: 'test-queue',
        jobName: 'test-job',
        payload: '{"data":"test"}',
        error: 'error',
        attempts: '3',
        status: DlqJobStatus.PENDING,
        addedAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
      };

      mockRedisService.hgetall.mockResolvedValue(mockJob);

      const result = await service.getDeadLetterJob('dlq:1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('dlq:1');
    });

    it('should return null for non-existent job', async () => {
      mockRedisService.hgetall.mockResolvedValue(null);

      const result = await service.getDeadLetterJob('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('replayJob', () => {
    it('should mark job as replaying and return job data', async () => {
      const mockJob = {
        id: 'dlq:1',
        queue: 'test-queue',
        jobName: 'test-job',
        payload: '{"data":"test"}',
        error: 'error',
        attempts: '3',
        status: DlqJobStatus.PENDING,
        addedAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
      };

      mockRedisService.hgetall.mockResolvedValue(mockJob);
      mockRedisService.hset.mockResolvedValue(1);

      const result = await service.replayJob('dlq:1');

      expect(result).toBeDefined();
      expect(mockRedisService.hset).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: DlqJobStatus.REPLAYING }),
      );
    });

    it('should throw error for non-existent job', async () => {
      mockRedisService.hgetall.mockResolvedValue(null);

      await expect(service.replayJob('non-existent')).rejects.toThrow(
        'Job not found',
      );
    });
  });

  describe('markJobCompleted', () => {
    it('should remove job from DLQ after successful replay', async () => {
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.zrem.mockResolvedValue(1);

      await service.markJobCompleted('dlq:1');

      expect(mockRedisService.del).toHaveBeenCalled();
      expect(mockRedisService.zrem).toHaveBeenCalled();
    });
  });

  describe('markJobFailed', () => {
    it('should update job status to failed with new error', async () => {
      const mockJob = {
        id: 'dlq:1',
        queue: 'test-queue',
        jobName: 'test-job',
        payload: '{}',
        error: 'old error',
        attempts: '3',
        status: DlqJobStatus.REPLAYING,
        addedAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
      };

      mockRedisService.hgetall.mockResolvedValue(mockJob);
      mockRedisService.hset.mockResolvedValue(1);

      await service.markJobFailed('dlq:1', 'new error');

      expect(mockRedisService.hset).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: DlqJobStatus.FAILED,
          error: 'new error',
        }),
      );
    });
  });

  describe('deleteJob', () => {
    it('should delete job from DLQ', async () => {
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.zrem.mockResolvedValue(1);

      await service.deleteJob('dlq:1');

      expect(mockRedisService.del).toHaveBeenCalled();
      expect(mockRedisService.zrem).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should return DLQ metrics', async () => {
      mockRedisService.zcard.mockResolvedValue(5);
      mockRedisService.zrange.mockResolvedValue(['dlq:1', 'dlq:2', 'dlq:3', 'dlq:4', 'dlq:5']);
      mockRedisService.hgetall
        .mockResolvedValueOnce({ status: DlqJobStatus.PENDING, queue: 'q1' })
        .mockResolvedValueOnce({ status: DlqJobStatus.PENDING, queue: 'q1' })
        .mockResolvedValueOnce({ status: DlqJobStatus.FAILED, queue: 'q2' })
        .mockResolvedValueOnce({ status: DlqJobStatus.REPLAYING, queue: 'q1' })
        .mockResolvedValueOnce({ status: DlqJobStatus.PENDING, queue: 'q2' });

      const metrics = await service.getMetrics();

      expect(metrics.totalJobs).toBe(5);
      expect(metrics.byStatus).toBeDefined();
      expect(metrics.byQueue).toBeDefined();
    });
  });

  describe('retry logic', () => {
    it('should calculate exponential backoff delay', () => {
      const delay1 = service.calculateBackoffDelay(1);
      const delay2 = service.calculateBackoffDelay(2);
      const delay3 = service.calculateBackoffDelay(3);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should cap backoff delay at maximum', () => {
      const delay = service.calculateBackoffDelay(10);
      expect(delay).toBeLessThanOrEqual(300000); // 5 minutes max
    });
  });
});
