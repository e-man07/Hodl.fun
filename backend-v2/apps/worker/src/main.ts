import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const logger = new Logger('Worker');

  const port = process.env.WORKER_PORT || 3003;
  await app.listen(port);
  logger.log(`Worker service running on port ${port}`);
}

bootstrap();
