import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

const logger = new Logger('BackgroundWorkers');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);

  logger.log(`
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║    🔧 Hodl.fun Background Job Workers                 ║
  ║                                                        ║
  ║  - Metrics Update Worker                              ║
  ║  - Cache Warming Worker                               ║
  ║  - Holder Update Worker                               ║
  ║  - IPFS Cache Worker                                  ║
  ║  - Scheduled Tasks                                    ║
  ║                                                        ║
  ║  Status:       ✅ Running                              ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

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
  logger.error(`Failed to start worker: ${error.message}`);
  process.exit(1);
});
