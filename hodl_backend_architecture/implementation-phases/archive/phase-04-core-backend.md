# Phase 4: Core Backend

## Objective
Scaffold the NestJS monorepo with shared libraries, Prisma setup, and the API service foundation.

## Prerequisites
- Phase 2 completed (Cloud SQL, Redis)
- Phase 3 completed (GKE, Artifact Registry)

## Duration: 5-7 days

---

## 4.1 Project Scaffolding

### Initialize Monorepo

```bash
# Create project directory
mkdir hodlfun-v2-backend && cd hodlfun-v2-backend

# Initialize pnpm workspace
pnpm init

# Create workspace configuration
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'libs/*'
EOF

# Install base dependencies
pnpm add -D typescript @types/node ts-node nodemon
pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D turbo

# Create base tsconfig
cat > tsconfig.base.json << 'EOF'
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
EOF
```

### Directory Structure

```bash
mkdir -p apps/{api,websocket,indexer,worker}/src
mkdir -p libs/{common,database,redis}/src
mkdir -p prisma
mkdir -p docker
mkdir -p k8s/{base,overlays/{staging,production}}
mkdir -p .github/workflows
```

---

## 4.2 Shared Libraries

### Database Library (Prisma)

```bash
cd libs/database
pnpm init
pnpm add @prisma/client
pnpm add -D prisma
```

```typescript
// libs/database/src/index.ts
export * from './prisma.service';
export * from './prisma.module';
```

```typescript
// libs/database/src/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// libs/database/src/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Redis Library

```bash
cd libs/redis
pnpm init
pnpm add ioredis
pnpm add -D @types/ioredis
```

```typescript
// libs/redis/src/redis.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(private configService: ConfigService) {
    super(configService.get('REDIS_URL'));
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
```

```typescript
// libs/redis/src/redis.module.ts
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { PubSubService } from './pubsub.service';

@Global()
@Module({
  providers: [RedisService, CacheService, PubSubService],
  exports: [RedisService, CacheService, PubSubService],
})
export class RedisModule {}
```

```typescript
// libs/redis/src/cache.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  constructor(private redis: RedisService) {}

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await fetchFn();
    await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    return data;
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### Common Library

```typescript
// libs/common/src/index.ts
export * from './dto';
export * from './interfaces';
export * from './utils';
export * from './decorators';
export * from './filters';
export * from './interceptors';
```

```typescript
// libs/common/src/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

```typescript
// libs/common/src/filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
```

---

## 4.3 API Service

### Main Application Setup

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@libs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('API');

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: configService.get('CORS_ORIGINS', '*').split(','),
    credentials: true,
  });

  const port = configService.get('PORT', 3000);
  await app.listen(port);
  logger.log(`API service running on port ${port}`);
}
bootstrap();
```

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@libs/database';
import { RedisModule } from '@libs/redis';
import { HealthModule } from './health/health.module';
import { TokensModule } from './tokens/tokens.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    HealthModule,
    TokensModule,
    UsersModule,
  ],
})
export class AppModule {}
```

### Health Module

```typescript
// apps/api/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { RedisService } from '@libs/redis';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get('startup')
  async startup() {
    return { status: 'ok' };
  }

  @Get('live')
  async live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const results = {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      redis: checks[1].status === 'fulfilled' ? 'up' : 'down',
    };

    const healthy = Object.values(results).every(v => v === 'up');

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      checks: results,
    };
  }

  private async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis() {
    await this.redis.ping();
  }
}
```

### Tokens Module

```typescript
// apps/api/src/tokens/tokens.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { PaginationDto } from '@libs/common';

@Controller('tokens')
export class TokensController {
  constructor(private tokensService: TokensService) {}

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return this.tokensService.findAll(pagination);
  }

  @Get(':address')
  async findOne(@Param('address') address: string) {
    return this.tokensService.findByAddress(address);
  }

  @Get(':address/trades')
  async getTrades(
    @Param('address') address: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.tokensService.getTrades(address, pagination);
  }

  @Get(':address/holders')
  async getHolders(
    @Param('address') address: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.tokensService.getHolders(address, pagination);
  }

  @Get(':address/price-history')
  async getPriceHistory(
    @Param('address') address: string,
    @Query('interval') interval: string,
  ) {
    return this.tokensService.getPriceHistory(address, interval);
  }
}
```

```typescript
// apps/api/src/tokens/tokens.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@libs/database';
import { CacheService } from '@libs/redis';
import { PaginationDto, PaginatedResponse } from '@libs/common';

@Injectable()
export class TokensService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      this.prisma.token.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.token.count(),
    ]);

    return {
      data: tokens,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByAddress(address: string) {
    return this.cache.getOrSet(
      `token:${address.toLowerCase()}`,
      10,
      async () => {
        const token = await this.prisma.token.findUnique({
          where: { address: address.toLowerCase() },
        });
        if (!token) {
          throw new NotFoundException('Token not found');
        }
        return token;
      },
    );
  }

  async getTrades(address: string, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where: { tokenAddress: address.toLowerCase() },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.trade.count({
        where: { tokenAddress: address.toLowerCase() },
      }),
    ]);

    return {
      data: trades,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getHolders(address: string, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [holders, total] = await Promise.all([
      this.prisma.holder.findMany({
        where: { tokenAddress: address.toLowerCase() },
        skip,
        take: limit,
        orderBy: { balance: 'desc' },
      }),
      this.prisma.holder.count({
        where: { tokenAddress: address.toLowerCase() },
      }),
    ]);

    return {
      data: holders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPriceHistory(address: string, interval: string) {
    return this.prisma.priceHistory.findMany({
      where: {
        tokenAddress: address.toLowerCase(),
        interval: interval as any,
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });
  }
}
```

---

## 4.4 Verification Checklist

- [ ] Project scaffolding complete
- [ ] Prisma schema created and migrations run
- [ ] Database connection working
- [ ] Redis connection working
- [ ] API health endpoints responding
- [ ] Tokens endpoints working (GET /tokens, GET /tokens/:address)
- [ ] Local development running

## Local Development Commands

```bash
# Install dependencies
pnpm install

# Generate Prisma client
cd libs/database && pnpm prisma generate

# Run migrations
cd libs/database && pnpm prisma migrate dev

# Start API in development
pnpm --filter api run start:dev

# Test health endpoint
curl http://localhost:3000/api/v1/health/ready
```

## Next Phase
Proceed to **Phase 5: Indexer** to implement blockchain event processing.
