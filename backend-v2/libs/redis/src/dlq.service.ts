import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { randomUUID } from 'crypto';

export enum DlqJobStatus {
  PENDING = 'pending',
  REPLAYING = 'replaying',
  FAILED = 'failed',
}

export interface DlqJob {
  id: string;
  queue: string;
  jobName: string;
  payload: unknown;
  error: string;
  attempts: number;
  status: DlqJobStatus;
  addedAt: Date;
  lastAttemptAt: Date;
  replayedAt?: Date;
}

export interface DlqJobInput {
  queue: string;
  jobName: string;
  payload: unknown;
  error: string;
  attempts: number;
  lastAttemptAt: Date;
}

export interface DlqPaginationOptions {
  page: number;
  limit: number;
  queue?: string;
  status?: DlqJobStatus;
}

export interface DlqPaginatedResult {
  jobs: DlqJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DlqMetrics {
  totalJobs: number;
  byStatus: Record<DlqJobStatus, number>;
  byQueue: Record<string, number>;
}

const DLQ_KEY_PREFIX = 'dlq:job:';
const DLQ_INDEX_KEY = 'dlq:index';
const DLQ_COUNTER_KEY = 'dlq:counter';

// Backoff configuration
const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 300000; // 5 minutes

/**
 * Dead Letter Queue service for managing failed jobs.
 * Stores failed jobs in Redis with support for replay and monitoring.
 */
@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Add a failed job to the dead letter queue.
   */
  async addToDeadLetterQueue(job: DlqJobInput): Promise<DlqJob> {
    const counter = await this.redisService.incr(DLQ_COUNTER_KEY);
    const id = `dlq:${counter}-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    const dlqJob: DlqJob = {
      id,
      queue: job.queue,
      jobName: job.jobName,
      payload: job.payload,
      error: job.error,
      attempts: job.attempts,
      status: DlqJobStatus.PENDING,
      addedAt: now,
      lastAttemptAt: job.lastAttemptAt,
    };

    // Store job data as hash
    await this.redisService.hset(`${DLQ_KEY_PREFIX}${id}`, {
      id,
      queue: dlqJob.queue,
      jobName: dlqJob.jobName,
      payload: JSON.stringify(dlqJob.payload),
      error: dlqJob.error,
      attempts: String(dlqJob.attempts),
      status: dlqJob.status,
      addedAt: dlqJob.addedAt.toISOString(),
      lastAttemptAt: dlqJob.lastAttemptAt.toISOString(),
    });

    // Add to sorted set for ordering by timestamp
    await this.redisService.zadd(DLQ_INDEX_KEY, now.getTime(), id);

    this.logger.warn(`Job added to DLQ: ${id} (queue: ${job.queue}, job: ${job.jobName})`);

    return dlqJob;
  }

  /**
   * Get paginated list of dead letter jobs.
   */
  async getDeadLetterJobs(options: DlqPaginationOptions): Promise<DlqPaginatedResult> {
    const { page, limit, queue, status } = options;
    const start = (page - 1) * limit;

    // Get all job IDs from sorted set (ordered by timestamp desc)
    const allIds = await this.redisService.zrange(DLQ_INDEX_KEY, 0, -1);

    // Fetch all jobs and filter
    const allJobs: DlqJob[] = [];
    for (const id of allIds) {
      const job = await this.getDeadLetterJob(id);
      if (job) {
        // Apply filters
        if (queue && job.queue !== queue) continue;
        if (status && job.status !== status) continue;
        allJobs.push(job);
      }
    }

    // Apply pagination
    const paginatedJobs = allJobs.slice(start, start + limit);
    const total = allJobs.length;

    return {
      jobs: paginatedJobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a specific dead letter job by ID.
   */
  async getDeadLetterJob(id: string): Promise<DlqJob | null> {
    const data = await this.redisService.hgetall(`${DLQ_KEY_PREFIX}${id}`);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return this.parseJobData(data);
  }

  /**
   * Replay a dead letter job.
   * Returns the job data for the caller to re-process.
   */
  async replayJob(id: string): Promise<DlqJob> {
    const job = await this.getDeadLetterJob(id);

    if (!job) {
      throw new Error('Job not found');
    }

    // Update status to replaying
    await this.redisService.hset(`${DLQ_KEY_PREFIX}${id}`, {
      status: DlqJobStatus.REPLAYING,
      replayedAt: new Date().toISOString(),
    });

    this.logger.log(`Replaying DLQ job: ${id}`);

    return {
      ...job,
      status: DlqJobStatus.REPLAYING,
      replayedAt: new Date(),
    };
  }

  /**
   * Mark a replayed job as completed and remove from DLQ.
   */
  async markJobCompleted(id: string): Promise<void> {
    await this.redisService.del(`${DLQ_KEY_PREFIX}${id}`);
    await this.redisService.zrem(DLQ_INDEX_KEY, id);

    this.logger.log(`DLQ job completed and removed: ${id}`);
  }

  /**
   * Mark a replayed job as failed (replay unsuccessful).
   */
  async markJobFailed(id: string, error: string): Promise<void> {
    const job = await this.getDeadLetterJob(id);

    if (!job) {
      return;
    }

    await this.redisService.hset(`${DLQ_KEY_PREFIX}${id}`, {
      status: DlqJobStatus.FAILED,
      error,
      lastAttemptAt: new Date().toISOString(),
      attempts: String(job.attempts + 1),
    });

    this.logger.warn(`DLQ job replay failed: ${id} - ${error}`);
  }

  /**
   * Delete a job from the DLQ.
   */
  async deleteJob(id: string): Promise<void> {
    await this.redisService.del(`${DLQ_KEY_PREFIX}${id}`);
    await this.redisService.zrem(DLQ_INDEX_KEY, id);

    this.logger.log(`DLQ job deleted: ${id}`);
  }

  /**
   * Get DLQ metrics.
   */
  async getMetrics(): Promise<DlqMetrics> {
    const totalJobs = await this.redisService.zcard(DLQ_INDEX_KEY);
    const allIds = await this.redisService.zrange(DLQ_INDEX_KEY, 0, -1);

    const byStatus: Record<DlqJobStatus, number> = {
      [DlqJobStatus.PENDING]: 0,
      [DlqJobStatus.REPLAYING]: 0,
      [DlqJobStatus.FAILED]: 0,
    };
    const byQueue: Record<string, number> = {};

    for (const id of allIds) {
      const data = await this.redisService.hgetall(`${DLQ_KEY_PREFIX}${id}`);
      if (data) {
        const status = data.status as DlqJobStatus;
        const queue = data.queue as string;

        if (status) {
          byStatus[status] = (byStatus[status] || 0) + 1;
        }
        if (queue) {
          byQueue[queue] = (byQueue[queue] || 0) + 1;
        }
      }
    }

    return {
      totalJobs,
      byStatus,
      byQueue,
    };
  }

  /**
   * Calculate exponential backoff delay for retry attempts.
   */
  calculateBackoffDelay(attempt: number): number {
    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    return Math.min(delay, MAX_DELAY_MS);
  }

  /**
   * Parse raw Redis hash data into DlqJob object.
   */
  private parseJobData(data: Record<string, string>): DlqJob {
    return {
      id: data.id,
      queue: data.queue,
      jobName: data.jobName,
      payload: JSON.parse(data.payload || '{}'),
      error: data.error,
      attempts: parseInt(data.attempts, 10),
      status: data.status as DlqJobStatus,
      addedAt: new Date(data.addedAt),
      lastAttemptAt: new Date(data.lastAttemptAt),
      replayedAt: data.replayedAt ? new Date(data.replayedAt) : undefined,
    };
  }
}
