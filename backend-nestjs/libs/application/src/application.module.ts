import { Module, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { InfrastructureModule } from '@infrastructure';

// Token handlers
import {
  TOKEN_COMMAND_HANDLERS,
} from './token/commands';
import {
  TOKEN_QUERY_HANDLERS,
} from './token/queries';
import {
  TOKEN_EVENT_HANDLERS,
} from './token/event-handlers';

// Portfolio handlers
import {
  PORTFOLIO_COMMAND_HANDLERS,
} from './portfolio/commands';
import {
  PORTFOLIO_QUERY_HANDLERS,
} from './portfolio/queries';
import {
  PORTFOLIO_EVENT_HANDLERS,
} from './portfolio/event-handlers';

// Trade handlers
import {
  TRADE_QUERY_HANDLERS,
} from './trade/queries';

/**
 * Application Module
 *
 * Contains CQRS command/query handlers and application use cases
 * Orchestrates domain logic with external services
 *
 * Handlers:
 * - Token Commands (5): CreateToken, BuyToken, SellToken, LockToken, ListOnUniswap
 * - Token Queries (4): GetToken, GetTokens, GetTrendingTokens, GetGraduationReady
 * - Token Events (6): TokenCreated, MetricsUpdated, Locked, Listed, ATHPrice, ATHMarketCap
 * - Portfolio Commands (1): RecordTrade
 * - Portfolio Queries (1): GetUserPortfolio
 * - Portfolio Events (1): BalanceUpdated
 *
 * Event Flow:
 * Command → Domain Entity → Domain Events → Event Handlers → Side Effects (Cache, WebSocket, etc.)
 */
@Module({
  imports: [
    CqrsModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
    forwardRef(() => InfrastructureModule),
  ],
  providers: [
    // Commands (modify state)
    ...TOKEN_COMMAND_HANDLERS,
    ...PORTFOLIO_COMMAND_HANDLERS,
    // Queries (read state)
    ...TOKEN_QUERY_HANDLERS,
    ...PORTFOLIO_QUERY_HANDLERS,
    ...TRADE_QUERY_HANDLERS,
    // Event Handlers (side effects from events)
    ...TOKEN_EVENT_HANDLERS,
    ...PORTFOLIO_EVENT_HANDLERS,
  ],
  exports: [CqrsModule, EventEmitterModule],
})
export class ApplicationModule {}
