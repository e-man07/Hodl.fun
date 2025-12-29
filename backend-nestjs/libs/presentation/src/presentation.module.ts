import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { TokenController, TradeController, PortfolioController } from './controllers';
import { MarketGateway } from './gateways';

/**
 * Presentation Module
 *
 * Contains REST controllers and WebSocket gateways
 * Handles HTTP and WebSocket request/response transformation
 */
@Module({
  imports: [CqrsModule, EventEmitterModule.forRoot()],
  controllers: [TokenController, TradeController, PortfolioController],
  providers: [MarketGateway],
  exports: [MarketGateway],
})
export class PresentationModule {}
