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
    // Primary RPC endpoint
    rpcUrl: process.env.PUSH_RPC_URL || 'https://evm.donut.rpc.push.org/',
    // Alternative RPC endpoint for failover
    rpcUrlAlt:
      process.env.PUSH_RPC_URL_ALT ||
      'https://evm.rpc-testnet-donut-node2.push.org/',
    chainId: parseInt(process.env.CHAIN_ID || '42101', 10),
    chainName: process.env.CHAIN_NAME || 'Push Chain Testnet',
    blockExplorer: process.env.BLOCK_EXPLORER || 'https://donut.push.network/',
  },
  smartContracts: {
    // Core orchestrator - handles token creation and trading
    coreAddress:
      process.env.CORE_CONTRACT_ADDRESS ||
      '0x592F8f0abbB9a3d3c425980Ac0263363C8405b03',
    // BondingCurveFactory - creates bonding curves and tokens
    factoryAddress:
      process.env.FACTORY_CONTRACT_ADDRESS ||
      '0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8',
    // FeeVault - ERC4626 vault for platform fees
    feeVaultAddress:
      process.env.FEE_VAULT_CONTRACT_ADDRESS ||
      '0xbe2fd9b720d1d7fac7208523376d2a3332019928',
    // WPUSH - Wrapped PUSH token
    wpushAddress:
      process.env.WPUSH_CONTRACT_ADDRESS ||
      '0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7',
    // Uniswap V3 Factory - for token graduation
    uniswapV3FactoryAddress:
      process.env.UNISWAP_V3_FACTORY_ADDRESS ||
      '0x67a3CB5cc035a15dd6e26AFA9fA52e25a20348e7',
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
