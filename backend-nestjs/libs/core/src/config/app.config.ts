import { ConfigFactory } from '@nestjs/config';

/**
 * Application Configuration
 *
 * Central configuration for the application
 * Loads from environment variables
 */
export const appConfig: ConfigFactory = () => ({
  app: {
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiUrl: process.env.API_URL || 'http://localhost:3000',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hodlfun',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  blockchain: {
    rpcUrl: process.env.PUSH_RPC_URL || 'https://evm.rpc-testnet-donut-node1.push.org/',
    rpcUrlAlt: process.env.PUSH_RPC_URL_ALT || 'https://evm.rpc-testnet-donut-node2.push.org/',
    chainId: parseInt(process.env.CHAIN_ID || '42101', 10),
    chainName: process.env.CHAIN_NAME || 'Push Chain Testnet',
  },
  smartContracts: {
    coreAddress: process.env.CORE_ADDRESS || '',
    bondingCurveFactoryAddress: process.env.BONDING_CURVE_FACTORY_ADDRESS || '',
    wnatAddress: process.env.WNAT_ADDRESS || '',
  },
  ipfs: {
    pinatJwt: process.env.PINATA_JWT || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_here',
    expirationTime: parseInt(process.env.JWT_EXPIRATION || '86400', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
    prometheusEnabled: process.env.PROMETHEUS_ENABLED === 'true',
  },
});
