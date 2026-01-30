import { Logger } from '@nestjs/common';
import { ethers } from 'ethers';

/**
 * Base interface for all event handlers.
 * Each handler is responsible for processing a specific category of blockchain events.
 */
export interface EventHandler {
  /**
   * Process a parsed log event
   * @param parsed - The parsed log description from ethers
   * @param log - The original log from the blockchain
   * @param context - Additional context for event processing
   */
  handle(
    parsed: ethers.LogDescription,
    log: ethers.Log,
    context?: EventHandlerContext,
  ): Promise<void>;

  /**
   * Get the event names this handler can process
   */
  getSupportedEvents(): string[];
}

/**
 * Context passed to event handlers for additional data needed during processing
 */
export interface EventHandlerContext {
  /** Token address for bonding curve events */
  tokenAddress?: string;
}

/**
 * Dependencies injected into event handlers
 */
export interface EventHandlerDependencies {
  prisma: unknown;
  pubsub: unknown;
  cache: unknown;
  metrics: unknown;
  rpc: unknown;
  configService: unknown;
}

/**
 * Abstract base class for event handlers providing common functionality
 */
export abstract class BaseEventHandler implements EventHandler {
  protected readonly logger: Logger;

  constructor(
    protected readonly deps: EventHandlerDependencies,
    loggerContext: string,
  ) {
    this.logger = new Logger(loggerContext);
  }

  abstract handle(
    parsed: ethers.LogDescription,
    log: ethers.Log,
    context?: EventHandlerContext,
  ): Promise<void>;

  abstract getSupportedEvents(): string[];
}
