import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IndexerModule } from './indexer.module';
import { IndexerService } from '@infrastructure';

const logger = new Logger('BlockchainIndexer');

let stopIndexing: (() => void) | null = null;

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(IndexerModule);

  const indexerService = app.get(IndexerService);
  const status = await indexerService.getIndexerStatus();

  logger.log(`
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║    🔍 Hodl.fun Blockchain Event Indexer               ║
  ║                                                        ║
  ║  Status:       ✅ Running                              ║
  ║  Chain ID:     42101 (Push Chain Testnet)             ║
  ║  Poll Interval: 5 seconds                             ║
  ║  Last Block:   ${String(status.lastProcessedBlock).padEnd(10)}                        ║
  ║  Current Block: ${String(status.currentBlock).padEnd(10)}                       ║
  ║  Blocks Behind: ${String(status.blocksBehind).padEnd(10)}                       ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

  // Start continuous indexing with 5 second poll interval
  stopIndexing = indexerService.startContinuousIndexing(5000);
  logger.log('Indexer started successfully - polling for new events');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    if (stopIndexing) stopIndexing();
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully...');
    if (stopIndexing) stopIndexing();
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  logger.error(`Failed to start indexer: ${error.message}`);
  process.exit(1);
});
