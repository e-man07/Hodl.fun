import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WebSocketModule } from './websocket.module';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(WebSocketModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const logger = new Logger('WebSocket');

  // Use Redis adapter for multi-pod support
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  const port = process.env.WS_PORT || 3001;
  await app.listen(port);
  logger.log(`WebSocket service running on port ${port}`);
}

bootstrap();
