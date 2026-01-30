import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '@hodlfun/database';
import { RedisModule } from '@hodlfun/redis';
import { MetricsModule as CommonMetricsModule } from '@hodlfun/common';
import { HealthModule } from './health/health.module';
import { TokensModule } from './tokens/tokens.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './metrics/metrics.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env.local', '../../.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: config.get('RATE_LIMIT_TTL_SHORT', 1000), // 1 second
            limit: config.get('RATE_LIMIT_SHORT', 10), // 10 requests per second
          },
          {
            name: 'medium',
            ttl: config.get('RATE_LIMIT_TTL_MEDIUM', 10000), // 10 seconds
            limit: config.get('RATE_LIMIT_MEDIUM', 50), // 50 requests per 10 seconds
          },
          {
            name: 'long',
            ttl: config.get('RATE_LIMIT_TTL_LONG', 60000), // 1 minute
            limit: config.get('RATE_LIMIT_LONG', 200), // 200 requests per minute
          },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    MetricsModule,
    HealthModule,
    TokensModule,
    UsersModule,
    AuthModule,
    LeaderboardModule,
    AlertsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
