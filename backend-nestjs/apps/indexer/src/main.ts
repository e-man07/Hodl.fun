import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IndexerModule } from './indexer.module';

const logger = new Logger('BlockchainIndexer');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(IndexerModule);

  logger.log(`
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║    🔍 Hodl.fun Blockchain Event Indexer               ║
  ║                                                        ║
  ║  Status:       ✅ Starting                             ║
  ║  Chain ID:     42101 (Push Chain Testnet)             ║
  ║  Poll Interval: 5 seconds                             ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

  // TODO: Start indexer service
  // const indexerService = app.get(IndexerService);
  // await indexerService.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT received, shutting down gracefully...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  logger.error(`Failed to start indexer: ${error.message}`);
  process.exit(1);
});
