import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Injectable } from '@nestjs/common';
import { NewATHMarketCapEvent } from '@domain';

/**
 * New ATH Market Cap Event Handler
 *
 * Listens for NewATHMarketCapEvent (published when token reaches new all-time high market cap)
 *
 * Side effects:
 * - Update rankings/leaderboards
 * - Check if graduation threshold (100 PUSH) is reached
 * - Send milestone notifications
 * - Update UI indicators
 * - Record for analytics
 */
@Injectable()
@EventsHandler(NewATHMarketCapEvent)
export class NewATHMarketCapEventHandler
  implements IEventHandler<NewATHMarketCapEvent>
{
  private readonly logger = new Logger(NewATHMarketCapEventHandler.name);

  handle(event: NewATHMarketCapEvent): void {
    this.logger.log(
      `New ATH market cap reached: ${event.tokenAddress} - ${event.newATHMarketCap}`,
    );

    // Side effects:
    // - this.tokenService.updateATH(event.tokenId, { marketCap: event.newATHMarketCap, timestamp: event.timestamp })
    // - this.leaderboardService.updateRanking(event.tokenAddress, event.newATHMarketCap)
    // - this.notificationService.sendMilestoneAlert(event.tokenAddress, `New ATH Market Cap: ${newATHMarketCap}`)
    // - if (newATHMarketCap >= GRADUATION_THRESHOLD) this.graduationService.checkGraduation(event.tokenId)
    // - this.websocketGateway.broadcast('token.ath.market_cap', event)
    // - this.analyticsService.track('token_new_ath_market_cap', {
    //     tokenAddress: event.tokenAddress,
    //     newMarketCap: event.newATHMarketCap,
    //     timestamp: event.timestamp
    //   })
  }
}
