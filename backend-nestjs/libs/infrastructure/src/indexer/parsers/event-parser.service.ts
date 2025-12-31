import { Injectable } from '@nestjs/common';
import { Interface, Log } from 'ethers';
import { CORE_EVENT_TOPICS, CORE_EVENT_ABI } from '../events/core-events';
import {
  BONDING_CURVE_EVENT_TOPICS,
  BONDING_CURVE_EVENT_ABI,
} from '../events/bonding-curve-events';
import {
  FACTORY_EVENT_TOPICS,
  FACTORY_EVENT_ABI,
} from '../events/factory-events';
import {
  ParsedEvent,
  CreateCurveEvent,
  BuyEvent,
  SellEvent,
  LockEvent,
  ListingEvent,
  NewATHPriceEvent,
  NewATHMarketCapEvent,
  SyncEvent,
  CreatorFeeDistributedEvent,
  CreatorFeeDeferredFromBuyEvent,
  CreatorFeesAccumulatedEvent,
  CreatorFeesClaimedEvent,
} from '../../contracts/types';

/**
 * EventParserService
 *
 * Parses raw blockchain logs into typed event objects.
 * Supports Core and BondingCurve contract events.
 */
@Injectable()
export class EventParserService {
  private readonly coreInterface: Interface;
  private readonly bondingCurveInterface: Interface;
  private readonly factoryInterface: Interface;
  private readonly topicToEventName: Map<string, string>;

  constructor() {
    this.coreInterface = new Interface(CORE_EVENT_ABI);
    this.bondingCurveInterface = new Interface(BONDING_CURVE_EVENT_ABI);
    this.factoryInterface = new Interface(FACTORY_EVENT_ABI);
    this.topicToEventName = new Map([
      // Core contract events
      [CORE_EVENT_TOPICS.CreateCurve, 'CreateCurve'],
      [CORE_EVENT_TOPICS.Buy, 'Buy'],
      [CORE_EVENT_TOPICS.Sell, 'Sell'],
      // BondingCurve contract events
      [BONDING_CURVE_EVENT_TOPICS.Lock, 'Lock'],
      [BONDING_CURVE_EVENT_TOPICS.Listing, 'Listing'],
      [BONDING_CURVE_EVENT_TOPICS.NewATHPrice, 'NewATHPrice'],
      [BONDING_CURVE_EVENT_TOPICS.NewATHMarketCap, 'NewATHMarketCap'],
      [BONDING_CURVE_EVENT_TOPICS.Sync, 'Sync'],
      [BONDING_CURVE_EVENT_TOPICS.CreatorFeeDistributed, 'CreatorFeeDistributed'],
      [BONDING_CURVE_EVENT_TOPICS.CreatorFeeDeferredFromBuy, 'CreatorFeeDeferredFromBuy'],
      // Factory contract events
      [FACTORY_EVENT_TOPICS.CreatorFeesAccumulated, 'CreatorFeesAccumulated'],
      [FACTORY_EVENT_TOPICS.CreatorFeesClaimed, 'CreatorFeesClaimed'],
    ]);
  }

  /**
   * Parse a raw log into a typed event
   * @param log Raw blockchain log
   * @returns Parsed event or null if unknown
   */
  parseLog(log: Log): ParsedEvent | null {
    const topic0 = log.topics[0];
    const eventName = this.topicToEventName.get(topic0);

    if (!eventName) {
      return null;
    }

    try {
      switch (eventName) {
        case 'CreateCurve':
          return this.parseCreateCurve(log);
        case 'Buy':
          return this.parseBuy(log);
        case 'Sell':
          return this.parseSell(log);
        case 'Lock':
          return this.parseLock(log);
        case 'Listing':
          return this.parseListing(log);
        case 'NewATHPrice':
          return this.parseNewATHPrice(log);
        case 'NewATHMarketCap':
          return this.parseNewATHMarketCap(log);
        case 'Sync':
          return this.parseSync(log);
        case 'CreatorFeeDistributed':
          return this.parseCreatorFeeDistributed(log);
        case 'CreatorFeeDeferredFromBuy':
          return this.parseCreatorFeeDeferredFromBuy(log);
        case 'CreatorFeesAccumulated':
          return this.parseCreatorFeesAccumulated(log);
        case 'CreatorFeesClaimed':
          return this.parseCreatorFeesClaimed(log);
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Check if a topic hash corresponds to a known event
   * @param topic Event topic hash
   * @returns True if known event
   */
  isKnownEvent(topic: string): boolean {
    return this.topicToEventName.has(topic);
  }

  /**
   * Get event name from topic hash
   * @param topic Event topic hash
   * @returns Event name or null
   */
  getEventName(topic: string): string | null {
    return this.topicToEventName.get(topic) || null;
  }

  private parseCreateCurve(log: Log): ParsedEvent {
    const decoded = this.coreInterface.decodeEventLog(
      'CreateCurve',
      log.data,
      log.topics,
    );

    const data: CreateCurveEvent = {
      creator: decoded.creator,
      curve: decoded.curve,
      token: decoded.token,
      tokenURI: decoded.tokenURI,
      name: decoded.name,
      symbol: decoded.symbol,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'CreateCurve', data };
  }

  private parseBuy(log: Log): ParsedEvent {
    const decoded = this.coreInterface.decodeEventLog(
      'Buy',
      log.data,
      log.topics,
    );

    const data: BuyEvent = {
      token: decoded.token,
      to: decoded.to,
      amountIn: decoded.amountIn,
      amountOut: decoded.amountOut,
      price: decoded.price,
      timestamp: decoded.timestamp,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'Buy', data };
  }

  private parseSell(log: Log): ParsedEvent {
    const decoded = this.coreInterface.decodeEventLog(
      'Sell',
      log.data,
      log.topics,
    );

    const data: SellEvent = {
      token: decoded.token,
      from: decoded.from,
      to: decoded.to,
      amountIn: decoded.amountIn,
      amountOut: decoded.amountOut,
      price: decoded.price,
      timestamp: decoded.timestamp,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'Sell', data };
  }

  private parseLock(log: Log): ParsedEvent {
    const decoded = this.bondingCurveInterface.decodeEventLog(
      'Lock',
      log.data,
      log.topics,
    );

    const data: LockEvent = {
      token: decoded.token,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'Lock', data };
  }

  private parseListing(log: Log): ParsedEvent {
    const decoded = this.bondingCurveInterface.decodeEventLog(
      'Listing',
      log.data,
      log.topics,
    );

    const data: ListingEvent = {
      curve: decoded.curve,
      token: decoded.token,
      pool: decoded.pool,
      amount0: decoded.amount0,
      amount1: decoded.amount1,
      liquidity: decoded.liquidity,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'Listing', data };
  }

  private parseNewATHPrice(log: Log): ParsedEvent {
    const decoded = this.bondingCurveInterface.decodeEventLog(
      'NewATHPrice',
      log.data,
      log.topics,
    );

    const data: NewATHPriceEvent = {
      token: decoded.token,
      newPrice: decoded.newPrice,
      timestamp: decoded.timestamp,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'NewATHPrice', data };
  }

  private parseNewATHMarketCap(log: Log): ParsedEvent {
    const decoded = this.bondingCurveInterface.decodeEventLog(
      'NewATHMarketCap',
      log.data,
      log.topics,
    );

    const data: NewATHMarketCapEvent = {
      token: decoded.token,
      newMarketCap: decoded.newMarketCap,
      timestamp: decoded.timestamp,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'NewATHMarketCap', data };
  }

  private parseSync(log: Log): ParsedEvent {
    const decoded = this.bondingCurveInterface.decodeEventLog(
      'Sync',
      log.data,
      log.topics,
    );

    const data: SyncEvent = {
      token: decoded.token,
      realNative: decoded.realNative,
      realToken: decoded.realToken,
      virtualNative: decoded.virtualNative,
      virtualToken: decoded.virtualToken,
      price: decoded.price,
      timestamp: decoded.timestamp,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'Sync', data };
  }

  private parseCreatorFeeDistributed(log: Log): ParsedEvent {
    const decoded = this.bondingCurveInterface.decodeEventLog(
      'CreatorFeeDistributed',
      log.data,
      log.topics,
    );

    const data: CreatorFeeDistributedEvent = {
      creator: decoded.creator,
      token: decoded.token,
      amount: decoded.amount,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'CreatorFeeDistributed', data };
  }

  private parseCreatorFeeDeferredFromBuy(log: Log): ParsedEvent {
    const decoded = this.bondingCurveInterface.decodeEventLog(
      'CreatorFeeDeferredFromBuy',
      log.data,
      log.topics,
    );

    const data: CreatorFeeDeferredFromBuyEvent = {
      token: decoded.token,
      feeTokenAmount: decoded.feeTokenAmount,
      price: decoded.price,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'CreatorFeeDeferredFromBuy', data };
  }

  private parseCreatorFeesAccumulated(log: Log): ParsedEvent {
    const decoded = this.factoryInterface.decodeEventLog(
      'CreatorFeesAccumulated',
      log.data,
      log.topics,
    );

    const data: CreatorFeesAccumulatedEvent = {
      creator: decoded.creator,
      amount: decoded.amount,
      totalAccumulated: decoded.totalAccumulated,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'CreatorFeesAccumulated', data };
  }

  private parseCreatorFeesClaimed(log: Log): ParsedEvent {
    const decoded = this.factoryInterface.decodeEventLog(
      'CreatorFeesClaimed',
      log.data,
      log.topics,
    );

    const data: CreatorFeesClaimedEvent = {
      creator: decoded.creator,
      amount: decoded.amount,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.index,
    };

    return { type: 'CreatorFeesClaimed', data };
  }

  /**
   * Get all known event topics
   * @returns Array of topic hashes
   */
  getAllKnownTopics(): string[] {
    return Array.from(this.topicToEventName.keys());
  }

  /**
   * Get Core contract event topics
   */
  getCoreEventTopics(): string[] {
    return [
      CORE_EVENT_TOPICS.CreateCurve,
      CORE_EVENT_TOPICS.Buy,
      CORE_EVENT_TOPICS.Sell,
    ];
  }

  /**
   * Get BondingCurve contract event topics
   */
  getBondingCurveEventTopics(): string[] {
    return [
      BONDING_CURVE_EVENT_TOPICS.Lock,
      BONDING_CURVE_EVENT_TOPICS.Listing,
      BONDING_CURVE_EVENT_TOPICS.NewATHPrice,
      BONDING_CURVE_EVENT_TOPICS.NewATHMarketCap,
      BONDING_CURVE_EVENT_TOPICS.Sync,
      BONDING_CURVE_EVENT_TOPICS.CreatorFeeDistributed,
      BONDING_CURVE_EVENT_TOPICS.CreatorFeeDeferredFromBuy,
    ];
  }

  /**
   * Get Factory contract event topics
   */
  getFactoryEventTopics(): string[] {
    return [
      FACTORY_EVENT_TOPICS.CreatorFeesAccumulated,
      FACTORY_EVENT_TOPICS.CreatorFeesClaimed,
    ];
  }
}
