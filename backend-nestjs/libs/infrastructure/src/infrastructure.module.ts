import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { REPOSITORY_PROVIDERS } from './repositories';
import {
  BlockchainService,
  IpfsService,
  CacheService,
  PriceFeedService,
} from './services';
import { getQueueConfigs } from './queues/config/queue-config';
import {
  MetadataEnrichmentProcessor,
  TokenGraduationProcessor,
  PriceUpdateProcessor,
  PortfolioSyncProcessor,
  TradeIndexingProcessor,
} from './queues';
import { QueueService } from './queues/queue.service';

/**
 * Infrastructure Module
 *
 * Contains adapter implementations:
 * - Repository implementations (Prisma) - adapters for domain ports
 * - External service adapters (Blockchain, IPFS, Price Feed)
 * - Cache layer (Redis)
 * - Job queue (Bull) with multiple processors
 * - Event listeners
 *
 * This layer implements all the "ports" defined in the domain layer.
 * It's the bottom of the hexagonal architecture.
 *
 * Service Adapters:
 * - BlockchainService: Web3 RPC interactions with Push Chain
 * - IpfsService: Pinata IPFS for token metadata storage
 * - CacheService: Redis for distributed caching
 * - PriceFeedService: External price feeds (CoinGecko)
 *
 * Job Processors:
 * - MetadataEnrichmentProcessor: Fetch and update token metadata
 * - TokenGraduationProcessor: Handle token graduation to Uniswap V3
 * - PriceUpdateProcessor: Update prices from external feeds
 * - PortfolioSyncProcessor: Sync user portfolios with latest prices
 * - TradeIndexingProcessor: Index blockchain trades into database
 */
@Module({
  imports: [ConfigModule, getQueueConfigs()],
  providers: [
    // Repositories
    ...REPOSITORY_PROVIDERS,
    // Service Adapters
    BlockchainService,
    IpfsService,
    CacheService,
    PriceFeedService,
    // Job Processors
    MetadataEnrichmentProcessor,
    TokenGraduationProcessor,
    PriceUpdateProcessor,
    PortfolioSyncProcessor,
    TradeIndexingProcessor,
    // Queue Management
    QueueService,
  ],
  exports: [
    // Repositories
    ...REPOSITORY_PROVIDERS,
    // Service Adapters
    BlockchainService,
    IpfsService,
    CacheService,
    PriceFeedService,
    // Queue Management
    QueueService,
  ],
})
export class InfrastructureModule {}
