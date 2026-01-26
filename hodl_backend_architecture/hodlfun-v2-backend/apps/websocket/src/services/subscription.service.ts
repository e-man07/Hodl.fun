import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@hodlfun/redis';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly subscriptionPrefix = 'ws:subs:';

  constructor(private readonly redis: RedisService) {}

  async trackSubscription(clientId: string, room: string): Promise<void> {
    await this.redis.sadd(`${this.subscriptionPrefix}${clientId}`, room);
  }

  async removeSubscription(clientId: string, room: string): Promise<void> {
    await this.redis.srem(`${this.subscriptionPrefix}${clientId}`, room);
  }

  async getSubscriptions(clientId: string): Promise<string[]> {
    return this.redis.smembers(`${this.subscriptionPrefix}${clientId}`);
  }

  async cleanupClient(clientId: string): Promise<void> {
    await this.redis.del(`${this.subscriptionPrefix}${clientId}`);
    this.logger.debug(`Cleaned up subscriptions for client: ${clientId}`);
  }

  async getActiveConnectionCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.subscriptionPrefix}*`);
    return keys.length;
  }
}
