import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Injectable } from '@nestjs/common';
import { NewATHPriceEvent } from '@domain';

/**
 * New ATH Price Event Handler
 *
 * Listens for NewATHPriceEvent (published when token reaches new all-time high price)
 *
 * Side effects:
 * - Update token card UI to show ATH
 * - Send milestone notifications to interested users
 * - Update charts with ATH indicator
 * - Record event for analytics
 * - Trigger celebration/highlight in UI
 */
@Injectable()
@EventsHandler(NewATHPriceEvent)
export class NewATHPriceEventHandler implements IEventHandler<NewATHPriceEvent> {
  private readonly logger = new Logger(NewATHPriceEventHandler.name);

  handle(event: NewATHPriceEvent): void {
    this.logger.log(
      `New ATH price reached: ${event.tokenAddress} - ${event.newATHPrice}`,
    );

    // Side effects:
    // - this.tokenService.updateATH(event.tokenId, { price: event.newATHPrice, timestamp: event.timestamp })
    // - this.notificationService.sendMilestoneAlert(event.tokenAddress, `New ATH Price: ${newATHPrice}`)
    // - this.websocketGateway.broadcast('token.ath.price', event)
    // - this.analyticsService.track('token_new_ath_price', {
    //     tokenAddress: event.tokenAddress,
    //     newPrice: event.newATHPrice,
    //     timestamp: event.timestamp
    //   })
  }
}
