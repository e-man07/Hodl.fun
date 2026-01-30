import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@hodlfun/database';
import { PubSubService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';
import { Alert, AlertType } from '@prisma/client';

interface TradeMessage {
  type: string;
  tokenAddress: string;
  price: string;
}

interface GraduationMessage {
  type: string;
  tokenAddress: string;
}

@Injectable()
export class AlertsProcessor implements OnModuleInit {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pubsub: PubSubService,
    private readonly metrics: MetricsService,
  ) {}

  async onModuleInit() {
    // Subscribe to trade events to check price alerts
    await this.pubsub.subscribe('trade_completed', (message: unknown) => {
      const msg = message as TradeMessage;
      if (msg.type === 'trade_completed' && msg.tokenAddress && msg.price) {
        this.logger.debug(`Received trade for ${msg.tokenAddress} at price ${msg.price}`);
        this.checkAlertsForToken(msg.tokenAddress, msg.price).catch((err) => {
          this.logger.error(`Failed to check alerts: ${(err as Error).message}`);
        });
      }
    });
    this.logger.log('Subscribed to trade_completed channel');

    // Subscribe to graduation events to check graduation alerts
    await this.pubsub.subscribe('token_graduated', (message: unknown) => {
      const msg = message as GraduationMessage;
      if (msg.type === 'token_graduated' && msg.tokenAddress) {
        this.logger.debug(`Received graduation for ${msg.tokenAddress}`);
        this.checkGraduationAlerts(msg.tokenAddress).catch((err) => {
          this.logger.error(`Failed to check graduation alerts: ${(err as Error).message}`);
        });
      }
    });
    this.logger.log('Subscribed to token_graduated channel');
  }

  /**
   * Check all active price alerts for a token after a trade
   */
  async checkAlertsForToken(tokenAddress: string, currentPrice: string): Promise<void> {
    const normalizedAddress = tokenAddress.toLowerCase();

    try {
      // Get all active (non-triggered) alerts for this token
      const alerts = await this.prisma.alert.findMany({
        where: {
          tokenAddress: normalizedAddress,
          isTriggered: false,
        },
      });

      if (alerts.length === 0) {
        return;
      }

      // Track metrics
      this.metrics.alertsChecked.inc({ token: normalizedAddress }, alerts.length);

      // Check each alert
      for (const alert of alerts) {
        try {
          if (this.shouldTrigger(alert, currentPrice)) {
            await this.triggerAlert(alert, currentPrice);
          }
        } catch (error) {
          this.logger.error(
            `Failed to process alert ${alert.id}: ${(error as Error).message}`,
          );
          // Continue processing other alerts
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to check alerts for token ${normalizedAddress}: ${(error as Error).message}`,
      );
      // Don't rethrow - we don't want to crash the subscriber
    }
  }

  /**
   * Check graduation alerts when a token graduates
   */
  async checkGraduationAlerts(tokenAddress: string): Promise<void> {
    const normalizedAddress = tokenAddress.toLowerCase();

    try {
      const alerts = await this.prisma.alert.findMany({
        where: {
          tokenAddress: normalizedAddress,
          alertType: AlertType.GRADUATION,
          isTriggered: false,
        },
      });

      for (const alert of alerts) {
        try {
          await this.triggerAlert(alert, null);
        } catch (error) {
          this.logger.error(
            `Failed to trigger graduation alert ${alert.id}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to check graduation alerts for ${normalizedAddress}: ${(error as Error).message}`,
      );
    }
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

  /**
   * Trigger an alert - mark as triggered and notify user
   */
  private async triggerAlert(alert: Alert, currentPrice: string | null): Promise<void> {
    // Mark alert as triggered
    await this.prisma.alert.update({
      where: { id: alert.id },
      data: {
        isTriggered: true,
        triggeredAt: new Date(),
      },
    });

    // Publish notification to user's alert channel
    await this.pubsub.publish(`alerts:${alert.walletAddress}`, {
      type: 'alert_triggered',
      alertId: alert.id,
      tokenAddress: alert.tokenAddress,
      alertType: alert.alertType,
      targetPrice: alert.targetPrice,
      currentPrice,
      timestamp: Date.now(),
    });

    // Track metrics
    this.metrics.alertsTriggered.inc({ type: alert.alertType });

    this.logger.log(
      `Triggered ${alert.alertType} alert ${alert.id} for wallet ${alert.walletAddress}`,
    );
  }
}
