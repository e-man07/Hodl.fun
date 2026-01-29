import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { Alert, AlertType } from '@prisma/client';

export interface CreateAlertParams {
  walletAddress: string;
  tokenAddress: string;
  alertType: AlertType;
  targetPrice?: string;
}

export interface UpdateAlertParams {
  targetPrice?: string;
  alertType?: AlertType;
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new price alert
   */
  async create(params: CreateAlertParams): Promise<Alert> {
    const normalizedTokenAddress = params.tokenAddress.toLowerCase();
    const normalizedWalletAddress = params.walletAddress.toLowerCase();

    // Verify token exists
    const token = await this.prisma.token.findUnique({
      where: { address: normalizedTokenAddress },
    });

    if (!token) {
      throw new NotFoundException(`Token ${params.tokenAddress} not found`);
    }

    // Validate target price for price alerts
    if (
      (params.alertType === AlertType.PRICE_ABOVE || params.alertType === AlertType.PRICE_BELOW) &&
      !params.targetPrice
    ) {
      throw new BadRequestException('Target price is required for price alerts');
    }

    return this.prisma.alert.create({
      data: {
        walletAddress: normalizedWalletAddress,
        tokenAddress: normalizedTokenAddress,
        alertType: params.alertType,
        targetPrice: params.targetPrice,
      },
    });
  }

  /**
   * Find all alerts for a wallet
   */
  async findByWallet(walletAddress: string): Promise<Alert[]> {
    const normalizedAddress = walletAddress.toLowerCase();
    return this.prisma.alert.findMany({
      where: { walletAddress: normalizedAddress },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find an alert by ID
   */
  async findById(id: string): Promise<Alert | null> {
    return this.prisma.alert.findUnique({
      where: { id },
    });
  }

  /**
   * Update an alert (only owner can update)
   */
  async update(id: string, walletAddress: string, params: UpdateAlertParams): Promise<Alert> {
    const normalizedWalletAddress = walletAddress.toLowerCase();

    const alert = await this.prisma.alert.findUnique({
      where: { id },
    });

    if (!alert || alert.walletAddress !== normalizedWalletAddress) {
      throw new NotFoundException(`Alert ${id} not found`);
    }

    return this.prisma.alert.update({
      where: { id },
      data: params,
    });
  }

  /**
   * Delete an alert (only owner can delete)
   */
  async delete(id: string, walletAddress: string): Promise<void> {
    const normalizedWalletAddress = walletAddress.toLowerCase();

    const alert = await this.prisma.alert.findUnique({
      where: { id },
    });

    if (!alert || alert.walletAddress !== normalizedWalletAddress) {
      throw new NotFoundException(`Alert ${id} not found`);
    }

    await this.prisma.alert.delete({
      where: { id },
    });
  }

  /**
   * Get all active (non-triggered) alerts for a token
   * Used by the worker to check alerts after trades
   */
  async getActiveAlerts(tokenAddress: string): Promise<Alert[]> {
    const normalizedAddress = tokenAddress.toLowerCase();
    return this.prisma.alert.findMany({
      where: {
        tokenAddress: normalizedAddress,
        isTriggered: false,
      },
    });
  }

  /**
   * Mark an alert as triggered
   */
  async markTriggered(id: string): Promise<Alert> {
    return this.prisma.alert.update({
      where: { id },
      data: {
        isTriggered: true,
        triggeredAt: new Date(),
      },
    });
  }

  /**
   * Check if an alert should be triggered based on current price
   */
  shouldTrigger(alert: Alert, currentPrice: string): boolean {
    if (!alert.targetPrice) {
      return false;
    }

    const target = BigInt(alert.targetPrice);
    const current = BigInt(currentPrice);

    switch (alert.alertType) {
      case AlertType.PRICE_ABOVE:
        return current >= target;
      case AlertType.PRICE_BELOW:
        return current <= target;
      case AlertType.GRADUATION:
        // Graduation alerts are triggered by events, not price
        return false;
      default:
        return false;
    }
  }
}
