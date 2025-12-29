import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Injectable } from '@nestjs/common';
import { TokenLockedEvent } from '@domain';

/**
 * Token Locked Event Handler
 *
 * Listens for TokenLockedEvent (published when token reaches graduation threshold)
 *
 * Side effects:
 * - Disable bonding curve trading in UI
 * - Trigger graduation process
 * - Notify creator that token is ready for Uniswap
 * - Update token status in read model
 *
 * This is a critical milestone event in token lifecycle
 */
@Injectable()
@EventsHandler(TokenLockedEvent)
export class TokenLockedEventHandler implements IEventHandler<TokenLockedEvent> {
  private readonly logger = new Logger(TokenLockedEventHandler.name);

  handle(event: TokenLockedEvent): void {
    this.logger.log(
      `Token locked (graduation ready): ${event.tokenAddress}`,
    );

    // Side effects:
    // - this.tokenService.updateStatus(event.tokenId, 'locked')
    // - this.graduationService.initiateGraduation(event.tokenId)
    // - this.notificationService.notifyCreator(event.tokenAddress, 'Token ready for Uniswap')
    // - this.websocketGateway.broadcast('token.locked', event)
    // - this.analyticsService.track('token_locked_graduation', { tokenAddress: event.tokenAddress })
  }
}
