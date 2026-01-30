import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from '../../alerts/alerts.service';
import { PrismaService } from '@hodlfun/database';
import { AlertType } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Mock PrismaService
const mockPrismaService = {
  alert: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  token: {
    findUnique: jest.fn(),
  },
};

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: typeof mockPrismaService;

  const mockAlert = {
    id: 'alert-123',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    alertType: AlertType.PRICE_ABOVE,
    targetPrice: '1000000000000000000', // 1 PUSH in wei
    isTriggered: false,
    triggeredAt: null,
    createdAt: new Date('2026-01-29T10:00:00Z'),
  };

  const mockToken = {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: 'Test Token',
    symbol: 'TEST',
    currentPrice: '500000000000000000', // 0.5 PUSH
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    prisma = mockPrismaService;
  });

  describe('create', () => {
    it('should create a price alert', async () => {
      prisma.token.findUnique.mockResolvedValue(mockToken);
      prisma.alert.create.mockResolvedValue(mockAlert);

      const result = await service.create({
        walletAddress: mockAlert.walletAddress,
        tokenAddress: mockAlert.tokenAddress,
        alertType: AlertType.PRICE_ABOVE,
        targetPrice: mockAlert.targetPrice,
      });

      expect(prisma.token.findUnique).toHaveBeenCalledWith({
        where: { address: mockAlert.tokenAddress.toLowerCase() },
      });
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: {
          walletAddress: mockAlert.walletAddress.toLowerCase(),
          tokenAddress: mockAlert.tokenAddress.toLowerCase(),
          alertType: AlertType.PRICE_ABOVE,
          targetPrice: mockAlert.targetPrice,
        },
      });
      expect(result).toEqual(mockAlert);
    });

    it('should throw if token does not exist', async () => {
      prisma.token.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          walletAddress: mockAlert.walletAddress,
          tokenAddress: '0xnonexistent',
          alertType: AlertType.PRICE_ABOVE,
          targetPrice: mockAlert.targetPrice,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create graduation alert without target price', async () => {
      const graduationAlert = {
        ...mockAlert,
        alertType: AlertType.GRADUATION,
        targetPrice: null,
      };
      prisma.token.findUnique.mockResolvedValue(mockToken);
      prisma.alert.create.mockResolvedValue(graduationAlert);

      const result = await service.create({
        walletAddress: mockAlert.walletAddress,
        tokenAddress: mockAlert.tokenAddress,
        alertType: AlertType.GRADUATION,
      });

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          alertType: AlertType.GRADUATION,
          targetPrice: undefined,
        }),
      });
      expect(result.alertType).toBe(AlertType.GRADUATION);
    });

    it('should require target price for price alerts', async () => {
      prisma.token.findUnique.mockResolvedValue(mockToken);

      await expect(
        service.create({
          walletAddress: mockAlert.walletAddress,
          tokenAddress: mockAlert.tokenAddress,
          alertType: AlertType.PRICE_ABOVE,
          // No targetPrice
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByWallet', () => {
    it('should return alerts for a wallet', async () => {
      const alerts = [mockAlert, { ...mockAlert, id: 'alert-456' }];
      prisma.alert.findMany.mockResolvedValue(alerts);

      const result = await service.findByWallet(mockAlert.walletAddress);

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: { walletAddress: mockAlert.walletAddress.toLowerCase() },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(alerts);
    });

    it('should return empty array if no alerts', async () => {
      prisma.alert.findMany.mockResolvedValue([]);

      const result = await service.findByWallet('0xnoalerts');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return alert by id', async () => {
      prisma.alert.findUnique.mockResolvedValue(mockAlert);

      const result = await service.findById(mockAlert.id);

      expect(prisma.alert.findUnique).toHaveBeenCalledWith({
        where: { id: mockAlert.id },
      });
      expect(result).toEqual(mockAlert);
    });

    it('should return null if alert not found', async () => {
      prisma.alert.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update alert target price', async () => {
      const updatedAlert = {
        ...mockAlert,
        targetPrice: '2000000000000000000',
      };
      prisma.alert.findUnique.mockResolvedValue(mockAlert);
      prisma.alert.update.mockResolvedValue(updatedAlert);

      const result = await service.update(mockAlert.id, mockAlert.walletAddress, {
        targetPrice: '2000000000000000000',
      });

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: mockAlert.id },
        data: { targetPrice: '2000000000000000000' },
      });
      expect(result.targetPrice).toBe('2000000000000000000');
    });

    it('should throw if alert not found', async () => {
      prisma.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', mockAlert.walletAddress, {
          targetPrice: '2000000000000000000',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if wallet does not own alert', async () => {
      prisma.alert.findUnique.mockResolvedValue(mockAlert);

      await expect(
        service.update(mockAlert.id, '0xdifferentwallet', {
          targetPrice: '2000000000000000000',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete alert', async () => {
      prisma.alert.findUnique.mockResolvedValue(mockAlert);
      prisma.alert.delete.mockResolvedValue(mockAlert);

      await service.delete(mockAlert.id, mockAlert.walletAddress);

      expect(prisma.alert.delete).toHaveBeenCalledWith({
        where: { id: mockAlert.id },
      });
    });

    it('should throw if alert not found', async () => {
      prisma.alert.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', mockAlert.walletAddress)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if wallet does not own alert', async () => {
      prisma.alert.findUnique.mockResolvedValue(mockAlert);

      await expect(service.delete(mockAlert.id, '0xdifferentwallet')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active (non-triggered) alerts for a token', async () => {
      const activeAlerts = [mockAlert];
      prisma.alert.findMany.mockResolvedValue(activeAlerts);

      const result = await service.getActiveAlerts(mockAlert.tokenAddress);

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        where: {
          tokenAddress: mockAlert.tokenAddress.toLowerCase(),
          isTriggered: false,
        },
      });
      expect(result).toEqual(activeAlerts);
    });
  });

  describe('markTriggered', () => {
    it('should mark alert as triggered', async () => {
      const triggeredAlert = {
        ...mockAlert,
        isTriggered: true,
        triggeredAt: new Date(),
      };
      prisma.alert.update.mockResolvedValue(triggeredAlert);

      const result = await service.markTriggered(mockAlert.id);

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: mockAlert.id },
        data: {
          isTriggered: true,
          triggeredAt: expect.any(Date),
        },
      });
      expect(result.isTriggered).toBe(true);
      expect(result.triggeredAt).toBeDefined();
    });
  });

  describe('shouldTrigger', () => {
    it('should return true when price is above target for PRICE_ABOVE', () => {
      const result = service.shouldTrigger(
        { ...mockAlert, alertType: AlertType.PRICE_ABOVE, targetPrice: '1000000000000000000' },
        '1500000000000000000', // current price > target
      );

      expect(result).toBe(true);
    });

    it('should return false when price is below target for PRICE_ABOVE', () => {
      const result = service.shouldTrigger(
        { ...mockAlert, alertType: AlertType.PRICE_ABOVE, targetPrice: '1000000000000000000' },
        '500000000000000000', // current price < target
      );

      expect(result).toBe(false);
    });

    it('should return true when price is below target for PRICE_BELOW', () => {
      const result = service.shouldTrigger(
        { ...mockAlert, alertType: AlertType.PRICE_BELOW, targetPrice: '1000000000000000000' },
        '500000000000000000', // current price < target
      );

      expect(result).toBe(true);
    });

    it('should return false when price is above target for PRICE_BELOW', () => {
      const result = service.shouldTrigger(
        { ...mockAlert, alertType: AlertType.PRICE_BELOW, targetPrice: '1000000000000000000' },
        '1500000000000000000', // current price > target
      );

      expect(result).toBe(false);
    });

    it('should return false for GRADUATION type (handled separately)', () => {
      const result = service.shouldTrigger(
        { ...mockAlert, alertType: AlertType.GRADUATION, targetPrice: null },
        '1500000000000000000',
      );

      expect(result).toBe(false);
    });
  });

  describe('AlertType enum', () => {
    it('should have PRICE_ABOVE type', () => {
      expect(AlertType.PRICE_ABOVE).toBe('PRICE_ABOVE');
    });

    it('should have PRICE_BELOW type', () => {
      expect(AlertType.PRICE_BELOW).toBe('PRICE_BELOW');
    });

    it('should have GRADUATION type', () => {
      expect(AlertType.GRADUATION).toBe('GRADUATION');
    });
  });
});
