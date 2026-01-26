import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@hodlfun/database';
import { RedisModule } from '@hodlfun/redis';
import { MetricsModule } from '@hodlfun/common';
import { HealthModule } from './health/health.module';
import { EventsGateway } from './gateways/events.gateway';
import { TradesGateway } from './gateways/trades.gateway';
import { SubscriptionService } from './services/subscription.service';
import { EventListenerService } from './services/event-listener.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    RedisModule,
    MetricsModule,
    HealthModule,
  ],
  providers: [EventsGateway, TradesGateway, SubscriptionService, EventListenerService],
})
export class WebSocketModule {}
