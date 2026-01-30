import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IndexerModule } from './indexer.module';

async function bootstrap() {
  const app = await NestFactory.create(IndexerModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const logger = new Logger('Indexer');

  const port = process.env.INDEXER_PORT || 3002;
  await app.listen(port);
  logger.log(`Indexer service running on port ${port}`);
}

bootstrap();
