import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { AppModule } from './app.module';
import {
  LoggingInterceptor,
  ResponseTransformInterceptor,
  HttpExceptionFilter,
  AllExceptionsFilter,
  CustomValidationPipe,
} from '@shared';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Get config
  const port = parseInt(process.env.PORT || '3000', 10);
  const environment = process.env.NODE_ENV || 'development';

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Compression
  app.use(compression());

  // Global validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
    new CustomValidationPipe(),
  );

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseTransformInterceptor(),
  );

  // Global exception filters
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new AllExceptionsFilter(),
  );

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Start server
  await app.listen(port, '0.0.0.0');

  logger.log(`
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║    🚀 Hodl.fun Token Launchpad Backend API Server     ║
  ║                                                        ║
  ║  Environment:  ${environment.padEnd(37)} ║
  ║  Port:         ${port.toString().padEnd(37)} ║
  ║  Status:       ✅ Running                              ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

  return app;
}

bootstrap().catch((error) => {
  logger.error(`Failed to start application: ${error.message}`);
  process.exit(1);
});
