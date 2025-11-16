// Configuration management for Hodl.fun Backend

import dotenv from 'dotenv';
import { AppConfig, BlockchainConfig, IPFSConfig, CacheConfig } from '../types';

dotenv.config();

// ============================================
// Application Configuration
// ============================================

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  env: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  apiVersion: process.env.API_VERSION || 'v1',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

// ============================================
// Blockchain Configuration
// ============================================

export const blockchainConfig: BlockchainConfig = {
  primaryRpc: process.env.PRIMARY_RPC_URL || 'https://evm.rpc-testnet-donut-node1.push.org/',
  secondaryRpc: process.env.SECONDARY_RPC_URL,
  tertiaryRpc: process.env.TERTIARY_RPC_URL,
  tokenFactory: process.env.TOKEN_FACTORY_ADDRESS || '0xFB07792D0F71C7e385aC220bEaeF0cbF187233A0',
  marketplace: process.env.MARKETPLACE_ADDRESS || '0x7f2F649125E1Cb4F5cC84DBF581Cd59b6311f46f',
  startBlock: parseInt(process.env.START_BLOCK || '0', 10),
  rpcRateLimit: parseInt(process.env.RPC_RATE_LIMIT || '10', 10),
  confirmations: parseInt(process.env.INDEXER_CONFIRMATIONS || '3', 10),
};

// ============================================
// IPFS Configuration
// ============================================

export const ipfsConfig: IPFSConfig = {
  apiKey: process.env.PINATA_API_KEY || '',
  secretKey: process.env.PINATA_SECRET_KEY || '',
  jwt: process.env.PINATA_JWT || '',
  gatewayUrl: process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/',
  rateLimit: parseInt(process.env.IPFS_RATE_LIMIT || '20', 10),
};

// ============================================
// Cache Configuration
// ============================================

export const cacheConfig: CacheConfig = {
  enabled: process.env.CACHE_ENABLED !== 'false',
  ttl: {
    tokenList: parseInt(process.env.CACHE_TTL_TOKEN_LIST || '300000', 10), // 5 minutes
    tokenDetails: parseInt(process.env.CACHE_TTL_TOKEN_DETAILS || '120000', 10), // 2 minutes
    tokenPrice: parseInt(process.env.CACHE_TTL_TOKEN_PRICE || '15000', 10), // 15 seconds (aggressive update for market stats)
    metadata: parseInt(process.env.CACHE_TTL_METADATA || '3600000', 10), // 1 hour
  },
};

// ============================================
// Redis Configuration
// ============================================

export const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

// ============================================
// Database Configuration
// ============================================

export const databaseConfig = {
  url: process.env.DATABASE_URL,
};

// ============================================
// Indexer Configuration
// ============================================

export const indexerConfig = {
  enabled: process.env.INDEXER_ENABLED !== 'false',
  pollInterval: parseInt(process.env.INDEXER_POLL_INTERVAL || '5000', 10), // 5 seconds
  batchSize: parseInt(process.env.INDEXER_BATCH_SIZE || '50', 10),
  startFromCurrent: process.env.INDEXER_START_FROM_CURRENT === 'true',
};

// ============================================
// Worker Configuration
// ============================================

export const workerConfig = {
  enabled: process.env.WORKER_ENABLED !== 'false',
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
};

// ============================================
// Logging Configuration
// ============================================

export const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  sentryDsn: process.env.SENTRY_DSN,
};

// ============================================
// Validation
// ============================================

export function validateConfig(): void {
  const required = [
    'DATABASE_URL',
    'PRIMARY_RPC_URL',
    'TOKEN_FACTORY_ADDRESS',
    'MARKETPLACE_ADDRESS',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (!ipfsConfig.apiKey || !ipfsConfig.secretKey || !ipfsConfig.jwt) {
    console.warn('⚠️  Warning: IPFS credentials not configured. Upload endpoints will not work.');
  }

  if (!redisConfig.url) {
    console.warn('⚠️  Warning: Redis not configured. Caching will be disabled.');
  } else if (redisConfig.url === 'redis://localhost:6379' && appConfig.env === 'production') {
    console.warn(
      '⚠️  Warning: Using local Redis in production. Consider using a managed Redis service.'
    );
  }
}
