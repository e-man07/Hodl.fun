import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';

import {
  TokenController,
  TradeController,
  PortfolioController,
  TransactionController,
  HealthController,
  AdminController,
  CreatorsController,
  VaultController,
} from './controllers';
import { MarketGateway } from './gateways';
import { QueueName, InfrastructureModule } from '@infrastructure';

/**
 * Presentation Module
 *
 * Contains REST controllers and WebSocket gateways
 * Handles HTTP and WebSocket request/response transformation
 */
@Module({
  imports: [
    CqrsModule,
    EventEmitterModule.forRoot(),
    InfrastructureModule,
    BullModule.registerQueue(
      { name: QueueName.TRADE_INDEXING },
      { name: QueueName.TOKEN_GRADUATION },
      { name: QueueName.PRICE_UPDATE },
    ),
  ],
  controllers: [
    TokenController,
    TradeController,
    PortfolioController,
    TransactionController,
    HealthController,
    AdminController,
    CreatorsController,
    VaultController,
  ],
  providers: [MarketGateway],
  exports: [MarketGateway],
})
export class PresentationModule {}
