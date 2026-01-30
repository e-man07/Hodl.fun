/**
 * Test Application Module for E2E Tests
 * This module mirrors AppModule but with test-friendly configurations
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '@hodlfun/database';
import { RedisModule } from '@hodlfun/redis';
import { MetricsModule as CommonMetricsModule } from '@hodlfun/common';
import { HealthModule } from '../../apps/api/src/health/health.module';
import { TokensModule } from '../../apps/api/src/tokens/tokens.module';
import { UsersModule } from '../../apps/api/src/users/users.module';
import { AuthModule } from '../../apps/api/src/auth/auth.module';
import { MetricsModule } from '../../apps/api/src/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Use in-memory config for tests
      ignoreEnvFile: true,
      load: [
        () => ({
          DATABASE_URL:
            process.env.DATABASE_URL ||
            'postgresql://test:test@localhost:5432/hodlfun_test',
          REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
          JWT_SECRET: 'test-jwt-secret-for-e2e-tests',
          JWT_EXPIRES_IN: '1h',
          JWT_REFRESH_SECRET: 'test-refresh-secret-for-e2e-tests',
          JWT_REFRESH_EXPIRES_IN: '7d',
          RATE_LIMIT_TTL_SHORT: 1000,
          RATE_LIMIT_SHORT: 1000,
          RATE_LIMIT_TTL_MEDIUM: 10000,
          RATE_LIMIT_MEDIUM: 1000,
          RATE_LIMIT_TTL_LONG: 60000,
          RATE_LIMIT_LONG: 1000,
        }),
      ],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 1000 },
        { name: 'medium', ttl: 10000, limit: 1000 },
        { name: 'long', ttl: 60000, limit: 1000 },
      ],
    }),
    PrismaModule,
    RedisModule,
    MetricsModule,
    HealthModule,
    TokensModule,
    UsersModule,
    AuthModule,
  ],
  // No APP_GUARD for throttler in tests - rate limiting is disabled
})
export class TestAppModule {}
