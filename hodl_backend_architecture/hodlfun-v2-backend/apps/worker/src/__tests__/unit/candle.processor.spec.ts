/**
 * Candle Processor Unit Tests
 * Tests for Bull queue job processing for candle aggregation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CandleProcessor } from '../../candle/candle.processor';
import { CandleService } from '../../candle/candle.service';
import { MetricsService } from '@hodlfun/common';
import { PriceInterval } from '@hodlfun/database';

// Mock CandleService
const createMockCandleService = () => ({
  aggregateAllTokens: jest.fn(),
  aggregateCandles: jest.fn(),
});

// Mock MetricsService
const createMockMetricsService = () => ({
  queueJobsProcessed: { inc: jest.fn() },
  queueJobDuration: { observe: jest.fn() },
});

describe('CandleProcessor', () => {
  let processor: CandleProcessor;
  let mockCandleService: ReturnType<typeof createMockCandleService>;
  let mockMetrics: ReturnType<typeof createMockMetricsService>;

  beforeEach(async () => {
    mockCandleService = createMockCandleService();
    mockMetrics = createMockMetricsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandleProcessor,
        { provide: CandleService, useValue: mockCandleService },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    processor = module.get<CandleProcessor>(CandleProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleAggregateInterval', () => {
    const startTime = '2024-01-01T00:00:00.000Z';
    const endTime = '2024-01-01T00:01:00.000Z';

    it('should call candleService.aggregateAllTokens with correct parameters', async () => {
      const job = {
        data: {
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await processor.handleAggregateInterval(job);

      expect(mockCandleService.aggregateAllTokens).toHaveBeenCalledWith(
        'ONE_MINUTE',
        new Date(startTime),
        new Date(endTime),
      );
    });

    it('should process ONE_HOUR interval', async () => {
      const job = {
        data: {
          interval: 'ONE_HOUR' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await processor.handleAggregateInterval(job);

      expect(mockCandleService.aggregateAllTokens).toHaveBeenCalledWith(
        'ONE_HOUR',
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should process FIVE_MINUTES interval', async () => {
      const job = {
        data: {
          interval: 'FIVE_MINUTES' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await processor.handleAggregateInterval(job);

      expect(mockCandleService.aggregateAllTokens).toHaveBeenCalledWith(
        'FIVE_MINUTES',
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should increment success metric on completion', async () => {
      const job = {
        data: {
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await processor.handleAggregateInterval(job);

      expect(mockMetrics.queueJobsProcessed.inc).toHaveBeenCalledWith({
        queue: 'candle-aggregation',
        status: 'success',
      });
    });

    it('should observe job duration on completion', async () => {
      const job = {
        data: {
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await processor.handleAggregateInterval(job);

      expect(mockMetrics.queueJobDuration.observe).toHaveBeenCalledWith(
        { queue: 'candle-aggregation' },
        expect.any(Number),
      );
    });

    it('should increment failed metric on error', async () => {
      mockCandleService.aggregateAllTokens.mockRejectedValue(new Error('DB Error'));

      const job = {
        data: {
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await expect(processor.handleAggregateInterval(job)).rejects.toThrow('DB Error');

      expect(mockMetrics.queueJobsProcessed.inc).toHaveBeenCalledWith({
        queue: 'candle-aggregation',
        status: 'failed',
      });
    });

    it('should not observe duration on error', async () => {
      mockCandleService.aggregateAllTokens.mockRejectedValue(new Error('DB Error'));

      const job = {
        data: {
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await expect(processor.handleAggregateInterval(job)).rejects.toThrow();

      expect(mockMetrics.queueJobDuration.observe).not.toHaveBeenCalled();
    });

    it('should rethrow errors for Bull retry mechanism', async () => {
      const error = new Error('Service unavailable');
      mockCandleService.aggregateAllTokens.mockRejectedValue(error);

      const job = {
        data: {
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await expect(processor.handleAggregateInterval(job)).rejects.toThrow(error);
    });
  });

  describe('handleAggregateToken', () => {
    const tokenAddress = '0xtoken123';
    const startTime = '2024-01-01T00:00:00.000Z';
    const endTime = '2024-01-01T00:01:00.000Z';

    it('should call candleService.aggregateCandles with correct parameters', async () => {
      const job = {
        data: {
          tokenAddress,
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await processor.handleAggregateToken(job);

      expect(mockCandleService.aggregateCandles).toHaveBeenCalledWith(
        tokenAddress,
        'ONE_MINUTE',
        new Date(startTime),
        new Date(endTime),
      );
    });

    it('should process different intervals correctly', async () => {
      const intervals: PriceInterval[] = [
        'ONE_MINUTE',
        'FIVE_MINUTES',
        'FIFTEEN_MINUTES',
        'ONE_HOUR',
        'FOUR_HOURS',
        'ONE_DAY',
      ];

      for (const interval of intervals) {
        mockCandleService.aggregateCandles.mockClear();

        const job = {
          data: {
            tokenAddress,
            interval,
            startTime,
            endTime,
          },
        } as any;

        await processor.handleAggregateToken(job);

        expect(mockCandleService.aggregateCandles).toHaveBeenCalledWith(
          tokenAddress,
          interval,
          expect.any(Date),
          expect.any(Date),
        );
      }
    });

    it('should handle specific token address', async () => {
      const specificToken = '0xspecifictoken456';
      const job = {
        data: {
          tokenAddress: specificToken,
          interval: 'ONE_HOUR' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await processor.handleAggregateToken(job);

      expect(mockCandleService.aggregateCandles).toHaveBeenCalledWith(
        specificToken,
        'ONE_HOUR',
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should convert ISO date strings to Date objects', async () => {
      const job = {
        data: {
          tokenAddress,
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime: '2024-06-15T12:30:00.000Z',
          endTime: '2024-06-15T12:31:00.000Z',
        },
      } as any;

      await processor.handleAggregateToken(job);

      const [, , start, end] = mockCandleService.aggregateCandles.mock.calls[0];
      expect(start).toEqual(new Date('2024-06-15T12:30:00.000Z'));
      expect(end).toEqual(new Date('2024-06-15T12:31:00.000Z'));
    });

    it('should propagate errors from candle service', async () => {
      mockCandleService.aggregateCandles.mockRejectedValue(new Error('Token not found'));

      const job = {
        data: {
          tokenAddress,
          interval: 'ONE_MINUTE' as PriceInterval,
          startTime,
          endTime,
        },
      } as any;

      await expect(processor.handleAggregateToken(job)).rejects.toThrow('Token not found');
    });
  });
});
