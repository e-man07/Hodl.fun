import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from '../../alerts/alerts.controller';
import { AlertsService } from '../../alerts/alerts.service';
import { AlertType } from '@prisma/client';

// Mock AlertsService
const mockAlertsService = {
  create: jest.fn(),
  findByWallet: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('AlertsController', () => {
  let controller: AlertsController;
  let service: typeof mockAlertsService;

  const mockUser = {
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  };

  const mockAlert = {
    id: 'alert-123',
    walletAddress: mockUser.walletAddress.toLowerCase(),
    tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    alertType: AlertType.PRICE_ABOVE,
    targetPrice: '1000000000000000000',
    isTriggered: false,
    triggeredAt: null,
    createdAt: new Date('2026-01-29T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
    service = mockAlertsService;
  });

  describe('POST /alerts', () => {
    it('should create an alert', async () => {
      service.create.mockResolvedValue(mockAlert);

      const result = await controller.create(mockUser, {
        tokenAddress: mockAlert.tokenAddress,
        alertType: AlertType.PRICE_ABOVE,
        targetPrice: mockAlert.targetPrice,
      });

      expect(service.create).toHaveBeenCalledWith({
        walletAddress: mockUser.walletAddress,
        tokenAddress: mockAlert.tokenAddress,
        alertType: AlertType.PRICE_ABOVE,
        targetPrice: mockAlert.targetPrice,
      });
      expect(result).toEqual(mockAlert);
    });
  });

  describe('GET /alerts', () => {
    it('should return all alerts for user', async () => {
      const alerts = [mockAlert, { ...mockAlert, id: 'alert-456' }];
      service.findByWallet.mockResolvedValue(alerts);

      const result = await controller.findAll(mockUser);

      expect(service.findByWallet).toHaveBeenCalledWith(mockUser.walletAddress);
      expect(result).toEqual(alerts);
    });
  });

  describe('GET /alerts/:id', () => {
    it('should return alert if user owns it', async () => {
      service.findById.mockResolvedValue(mockAlert);

      const result = await controller.findOne(mockAlert.id, mockUser);

      expect(service.findById).toHaveBeenCalledWith(mockAlert.id);
      expect(result).toEqual(mockAlert);
    });

    it('should return null if user does not own the alert', async () => {
      const otherAlert = {
        ...mockAlert,
        walletAddress: '0xdifferentwallet',
      };
      service.findById.mockResolvedValue(otherAlert);

      const result = await controller.findOne(mockAlert.id, mockUser);

      expect(result).toBeNull();
    });

    it('should return null if alert not found', async () => {
      service.findById.mockResolvedValue(null);

      const result = await controller.findOne('nonexistent', mockUser);

      expect(result).toBeNull();
    });
  });

  describe('PUT /alerts/:id', () => {
    it('should update an alert', async () => {
      const updatedAlert = {
        ...mockAlert,
        targetPrice: '2000000000000000000',
      };
      service.update.mockResolvedValue(updatedAlert);

      const result = await controller.update(mockAlert.id, mockUser, {
        targetPrice: '2000000000000000000',
      });

      expect(service.update).toHaveBeenCalledWith(mockAlert.id, mockUser.walletAddress, {
        targetPrice: '2000000000000000000',
      });
      expect(result.targetPrice).toBe('2000000000000000000');
    });
  });

  describe('DELETE /alerts/:id', () => {
    it('should delete an alert', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(mockAlert.id, mockUser);

      expect(service.delete).toHaveBeenCalledWith(mockAlert.id, mockUser.walletAddress);
    });
  });
});
