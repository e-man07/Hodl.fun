/**
 * Candle Processor Unit Tests
 * Tests for candle aggregation processing
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

  describe('aggregateInterval', () => {
    const startTime = new Date('2024-01-01T00:00:00.000Z');
    const endTime = new Date('2024-01-01T00:01:00.000Z');

    it('should call candleService.aggregateAllTokens with correct parameters', async () => {
      await processor.aggregateInterval(PriceInterval.ONE_MINUTE, startTime, endTime);

      expect(mockCandleService.aggregateAllTokens).toHaveBeenCalledWith(
        PriceInterval.ONE_MINUTE,
        startTime,
        endTime,
      );
    });

    it('should process ONE_HOUR interval', async () => {
      await processor.aggregateInterval(PriceInterval.ONE_HOUR, startTime, endTime);

      expect(mockCandleService.aggregateAllTokens).toHaveBeenCalledWith(
        PriceInterval.ONE_HOUR,
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should process FIVE_MINUTES interval', async () => {
      await processor.aggregateInterval(PriceInterval.FIVE_MINUTES, startTime, endTime);

      expect(mockCandleService.aggregateAllTokens).toHaveBeenCalledWith(
        PriceInterval.FIVE_MINUTES,
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should increment success metric on completion', async () => {
      await processor.aggregateInterval(PriceInterval.ONE_MINUTE, startTime, endTime);

      expect(mockMetrics.queueJobsProcessed.inc).toHaveBeenCalledWith({
        queue: 'candle-aggregation',
        status: 'success',
      });
    });

    it('should observe job duration on completion', async () => {
      await processor.aggregateInterval(PriceInterval.ONE_MINUTE, startTime, endTime);

      expect(mockMetrics.queueJobDuration.observe).toHaveBeenCalledWith(
        { queue: 'candle-aggregation' },
        expect.any(Number),
      );
    });

    it('should increment failed metric on error', async () => {
      mockCandleService.aggregateAllTokens.mockRejectedValue(new Error('DB Error'));

      await expect(
        processor.aggregateInterval(PriceInterval.ONE_MINUTE, startTime, endTime),
      ).rejects.toThrow('DB Error');

      expect(mockMetrics.queueJobsProcessed.inc).toHaveBeenCalledWith({
        queue: 'candle-aggregation',
        status: 'failed',
      });
    });

    it('should not observe duration on error', async () => {
      mockCandleService.aggregateAllTokens.mockRejectedValue(new Error('DB Error'));

      await expect(
        processor.aggregateInterval(PriceInterval.ONE_MINUTE, startTime, endTime),
      ).rejects.toThrow();

      expect(mockMetrics.queueJobDuration.observe).not.toHaveBeenCalled();
    });

    it('should rethrow errors for retry mechanism', async () => {
      const error = new Error('Service unavailable');
      mockCandleService.aggregateAllTokens.mockRejectedValue(error);

      await expect(
        processor.aggregateInterval(PriceInterval.ONE_MINUTE, startTime, endTime),
      ).rejects.toThrow(error);
    });
  });

  describe('aggregateToken', () => {
    const tokenAddress = '0xtoken123';
    const startTime = new Date('2024-01-01T00:00:00.000Z');
    const endTime = new Date('2024-01-01T00:01:00.000Z');

    it('should call candleService.aggregateCandles with correct parameters', async () => {
      await processor.aggregateToken(tokenAddress, PriceInterval.ONE_MINUTE, startTime, endTime);

      expect(mockCandleService.aggregateCandles).toHaveBeenCalledWith(
        tokenAddress,
        PriceInterval.ONE_MINUTE,
        startTime,
        endTime,
      );
    });

    it('should process different intervals correctly', async () => {
      const intervals: PriceInterval[] = [
        PriceInterval.ONE_MINUTE,
        PriceInterval.FIVE_MINUTES,
        PriceInterval.FIFTEEN_MINUTES,
        PriceInterval.ONE_HOUR,
        PriceInterval.FOUR_HOURS,
        PriceInterval.ONE_DAY,
      ];

      for (const interval of intervals) {
        mockCandleService.aggregateCandles.mockClear();

        await processor.aggregateToken(tokenAddress, interval, startTime, endTime);

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

      await processor.aggregateToken(specificToken, PriceInterval.ONE_HOUR, startTime, endTime);

      expect(mockCandleService.aggregateCandles).toHaveBeenCalledWith(
        specificToken,
        PriceInterval.ONE_HOUR,
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should propagate errors from candle service', async () => {
      mockCandleService.aggregateCandles.mockRejectedValue(new Error('Token not found'));

      await expect(
        processor.aggregateToken(tokenAddress, PriceInterval.ONE_MINUTE, startTime, endTime),
      ).rejects.toThrow('Token not found');
    });
  });
});
