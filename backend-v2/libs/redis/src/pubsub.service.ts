import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type MessageHandler = (message: unknown) => void;

@Injectable()
export class PubSubService implements OnModuleDestroy {
  private readonly logger = new Logger(PubSubService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, MessageHandler>();

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

    this.subscriber.on('message', (channel, message) => {
      const handler = this.handlers.get(channel);
      if (handler) {
        try {
          const parsed = JSON.parse(message);
          handler(parsed);
        } catch (error) {
          this.logger.error(`Error processing message on channel ${channel}: ${error}`);
        }
      }
    });

    this.subscriber.on('error', (error) => {
      this.logger.error(`PubSub subscriber error: ${error.message}`);
    });

    this.publisher.on('error', (error) => {
      this.logger.error(`PubSub publisher error: ${error.message}`);
    });
  }

  async publish(channel: string, message: unknown): Promise<void> {
    const serialized = JSON.stringify(message);
    await this.publisher.publish(channel, serialized);
    this.logger.debug(`Published message to channel: ${channel}`);
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    this.handlers.set(channel, handler);
    await this.subscriber.subscribe(channel);
    this.logger.log(`Subscribed to channel: ${channel}`);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
    this.logger.log(`Unsubscribed from channel: ${channel}`);
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
    this.logger.log('PubSub connections closed');
  }
}
