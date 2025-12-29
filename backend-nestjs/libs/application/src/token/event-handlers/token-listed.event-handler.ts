import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger, Injectable } from '@nestjs/common';
import { TokenListedEvent } from '@domain';

/**
 * Token Listed Event Handler
 *
 * Listens for TokenListedEvent (published when token graduates to Uniswap V3)
 *
 * Side effects:
 * - Archive token from bonding curve marketplace
 * - Update UI to show Uniswap pool link
 * - Notify users that token now trades on Uniswap
 * - Update leaderboards (graduate from early-stage to listed)
 * - Record graduation completion for analytics
 *
 * This is the final step in token lifecycle
 */
@Injectable()
@EventsHandler(TokenListedEvent)
export class TokenListedEventHandler implements IEventHandler<TokenListedEvent> {
  private readonly logger = new Logger(TokenListedEventHandler.name);

  handle(event: TokenListedEvent): void {
    this.logger.log(
      `Token listed on Uniswap V3: ${event.tokenAddress} → ${event.uniswapV3PoolAddress}`,
    );

    // Side effects:
    // - this.tokenService.archive(event.tokenId)
    // - this.uniswapService.recordPoolAddress(event.tokenAddress, event.uniswapV3PoolAddress)
    // - this.notificationService.notifyUsers(event.tokenAddress, `Token now trading on Uniswap: ${poolAddress}`)
    // - this.leaderboardService.moveToListed(event.tokenAddress)
    // - this.websocketGateway.broadcast('token.listed', event)
    // - this.analyticsService.track('token_graduated_uniswap', {
    //     tokenAddress: event.tokenAddress,
    //     poolAddress: event.uniswapV3PoolAddress,
    //     listedAt: event.listedAt
    //   })
  }
}
