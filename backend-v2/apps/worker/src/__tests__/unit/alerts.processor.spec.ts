/**
 * Alert Processor Unit Tests
 * Tests for checking and triggering price alerts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AlertsProcessor } from '../../alerts/alerts.processor';
import { PrismaService } from '@hodlfun/database';
import { PubSubService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';
import { AlertType } from '@prisma/client';

// Mock PrismaService
const createMockPrismaService = () => ({
  alert: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  token: {
    findUnique: jest.fn(),
  },
});

// Mock PubSubService
const createMockPubSubService = () => ({
  subscribe: jest.fn(),
  publish: jest.fn(),
});

// Mock MetricsService
const createMockMetricsService = () => ({
  alertsTriggered: { inc: jest.fn() },
  alertsChecked: { inc: jest.fn() },
});

describe('AlertsProcessor', () => {
  let processor: AlertsProcessor;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockPubSub: ReturnType<typeof createMockPubSubService>;
  let mockMetrics: ReturnType<typeof createMockMetricsService>;

  const mockToken = {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: 'Test Token',
    symbol: 'TEST',
    currentPrice: '1500000000000000000', // 1.5 PUSH
  };

  const mockPriceAboveAlert = {
    id: 'alert-1',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    tokenAddress: mockToken.address,
    alertType: AlertType.PRICE_ABOVE,
    targetPrice: '1000000000000000000', // 1 PUSH - should trigger (current > target)
    isTriggered: false,
    triggeredAt: null,
    createdAt: new Date(),
  };

  const mockPriceBelowAlert = {
    id: 'alert-2',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    tokenAddress: mockToken.address,
    alertType: AlertType.PRICE_BELOW,
    targetPrice: '2000000000000000000', // 2 PUSH - should trigger (current < target)
    isTriggered: false,
    triggeredAt: null,
    createdAt: new Date(),
  };

  const mockGraduationAlert = {
    id: 'alert-3',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    tokenAddress: mockToken.address,
    alertType: AlertType.GRADUATION,
    targetPrice: null,
    isTriggered: false,
    triggeredAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockPubSub = createMockPubSubService();
    mockMetrics = createMockMetricsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PubSubService, useValue: mockPubSub },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    processor = module.get<AlertsProcessor>(AlertsProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should subscribe to trade_completed channel', async () => {
      await processor.onModuleInit();

      expect(mockPubSub.subscribe).toHaveBeenCalledWith(
        'trade_completed',
        expect.any(Function),
      );
    });

    it('should subscribe to token_graduated channel', async () => {
      await processor.onModuleInit();

      expect(mockPubSub.subscribe).toHaveBeenCalledWith(
        'token_graduated',
        expect.any(Function),
      );
    });
  });

  describe('checkAlertsForToken', () => {
    it('should fetch active alerts for the token', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        where: {
          tokenAddress: mockToken.address.toLowerCase(),
          isTriggered: false,
        },
      });
    });

    it('should trigger PRICE_ABOVE alert when price exceeds target', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockPriceAboveAlert]);
      mockPrisma.alert.update.mockResolvedValue({
        ...mockPriceAboveAlert,
        isTriggered: true,
        triggeredAt: new Date(),
      });

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: mockPriceAboveAlert.id },
        data: {
          isTriggered: true,
          triggeredAt: expect.any(Date),
        },
      });
    });

    it('should trigger PRICE_BELOW alert when price is below target', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockPriceBelowAlert]);
      mockPrisma.alert.update.mockResolvedValue({
        ...mockPriceBelowAlert,
        isTriggered: true,
        triggeredAt: new Date(),
      });

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: mockPriceBelowAlert.id },
        data: {
          isTriggered: true,
          triggeredAt: expect.any(Date),
        },
      });
    });

    it('should not trigger alert when price condition is not met', async () => {
      // Price is 1.5 PUSH, target is 2 PUSH for PRICE_ABOVE - should not trigger
      const notTriggeredAlert = {
        ...mockPriceAboveAlert,
        targetPrice: '2000000000000000000', // 2 PUSH
      };
      mockPrisma.alert.findMany.mockResolvedValue([notTriggeredAlert]);

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('should not trigger GRADUATION alert (handled separately)', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockGraduationAlert]);

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('should publish alert_triggered event for triggered alerts', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockPriceAboveAlert]);
      mockPrisma.alert.update.mockResolvedValue({
        ...mockPriceAboveAlert,
        isTriggered: true,
        triggeredAt: new Date(),
      });

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `alerts:${mockPriceAboveAlert.walletAddress}`,
        expect.objectContaining({
          type: 'alert_triggered',
          alertId: mockPriceAboveAlert.id,
          tokenAddress: mockToken.address.toLowerCase(),
          alertType: AlertType.PRICE_ABOVE,
          targetPrice: mockPriceAboveAlert.targetPrice,
          currentPrice: mockToken.currentPrice,
        }),
      );
    });

    it('should process multiple alerts for the same token', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockPriceAboveAlert, mockPriceBelowAlert]);
      mockPrisma.alert.update.mockResolvedValue({ isTriggered: true, triggeredAt: new Date() });

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockPrisma.alert.update).toHaveBeenCalledTimes(2);
      expect(mockPubSub.publish).toHaveBeenCalledTimes(2);
    });

    it('should increment metrics for checked alerts', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockPriceAboveAlert, mockPriceBelowAlert]);
      mockPrisma.alert.update.mockResolvedValue({ isTriggered: true, triggeredAt: new Date() });

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockMetrics.alertsChecked.inc).toHaveBeenCalledWith({ token: mockToken.address.toLowerCase() }, 2);
    });

    it('should increment metrics for triggered alerts', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockPriceAboveAlert]);
      mockPrisma.alert.update.mockResolvedValue({
        ...mockPriceAboveAlert,
        isTriggered: true,
        triggeredAt: new Date(),
      });

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      expect(mockMetrics.alertsTriggered.inc).toHaveBeenCalledWith({
        type: AlertType.PRICE_ABOVE,
      });
    });
  });

  describe('checkGraduationAlerts', () => {
    it('should trigger graduation alerts for a token', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockGraduationAlert]);
      mockPrisma.alert.update.mockResolvedValue({
        ...mockGraduationAlert,
        isTriggered: true,
        triggeredAt: new Date(),
      });

      await processor.checkGraduationAlerts(mockToken.address);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        where: {
          tokenAddress: mockToken.address.toLowerCase(),
          alertType: AlertType.GRADUATION,
          isTriggered: false,
        },
      });

      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: mockGraduationAlert.id },
        data: {
          isTriggered: true,
          triggeredAt: expect.any(Date),
        },
      });
    });

    it('should publish graduation alert event', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockGraduationAlert]);
      mockPrisma.alert.update.mockResolvedValue({
        ...mockGraduationAlert,
        isTriggered: true,
        triggeredAt: new Date(),
      });

      await processor.checkGraduationAlerts(mockToken.address);

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        `alerts:${mockGraduationAlert.walletAddress}`,
        expect.objectContaining({
          type: 'alert_triggered',
          alertId: mockGraduationAlert.id,
          tokenAddress: mockToken.address.toLowerCase(),
          alertType: AlertType.GRADUATION,
        }),
      );
    });

    it('should increment graduation alert metrics', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockGraduationAlert]);
      mockPrisma.alert.update.mockResolvedValue({
        ...mockGraduationAlert,
        isTriggered: true,
        triggeredAt: new Date(),
      });

      await processor.checkGraduationAlerts(mockToken.address);

      expect(mockMetrics.alertsTriggered.inc).toHaveBeenCalledWith({
        type: AlertType.GRADUATION,
      });
    });
  });

  describe('shouldTrigger', () => {
    it('should return true for PRICE_ABOVE when current >= target', () => {
      const result = processor.shouldTrigger(
        mockPriceAboveAlert,
        '1500000000000000000', // 1.5 PUSH >= 1 PUSH target
      );
      expect(result).toBe(true);
    });

    it('should return false for PRICE_ABOVE when current < target', () => {
      const result = processor.shouldTrigger(
        { ...mockPriceAboveAlert, targetPrice: '2000000000000000000' },
        '1500000000000000000', // 1.5 PUSH < 2 PUSH target
      );
      expect(result).toBe(false);
    });

    it('should return true for PRICE_BELOW when current <= target', () => {
      const result = processor.shouldTrigger(
        mockPriceBelowAlert,
        '1500000000000000000', // 1.5 PUSH <= 2 PUSH target
      );
      expect(result).toBe(true);
    });

    it('should return false for PRICE_BELOW when current > target', () => {
      const result = processor.shouldTrigger(
        { ...mockPriceBelowAlert, targetPrice: '1000000000000000000' },
        '1500000000000000000', // 1.5 PUSH > 1 PUSH target
      );
      expect(result).toBe(false);
    });

    it('should return false for GRADUATION type', () => {
      const result = processor.shouldTrigger(mockGraduationAlert, '1500000000000000000');
      expect(result).toBe(false);
    });

    it('should return false when targetPrice is null', () => {
      const result = processor.shouldTrigger(
        { ...mockPriceAboveAlert, targetPrice: null },
        '1500000000000000000',
      );
      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully in checkAlertsForToken', async () => {
      mockPrisma.alert.findMany.mockRejectedValue(new Error('DB Error'));

      // Should not throw, just log the error
      await expect(
        processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice),
      ).resolves.not.toThrow();
    });

    it('should continue processing other alerts if one fails to update', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([mockPriceAboveAlert, mockPriceBelowAlert]);
      mockPrisma.alert.update
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce({
          ...mockPriceBelowAlert,
          isTriggered: true,
          triggeredAt: new Date(),
        });

      await processor.checkAlertsForToken(mockToken.address, mockToken.currentPrice);

      // Second alert should still be processed
      expect(mockPrisma.alert.update).toHaveBeenCalledTimes(2);
      expect(mockPubSub.publish).toHaveBeenCalledTimes(1); // Only the successful one
    });
  });
});
