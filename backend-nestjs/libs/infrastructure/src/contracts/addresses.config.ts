import { ConfigService } from '@nestjs/config';

/**
 * Contract addresses for the Hodl.fun smart contracts
 */
export interface ContractAddresses {
  /** Core orchestrator contract - handles token creation and trading */
  core: string;
  /** BondingCurveFactory - creates bonding curves and tokens */
  factory: string;
  /** FeeVault - ERC4626 vault for platform fees */
  feeVault: string;
  /** WPUSH - Wrapped PUSH token (ERC20) */
  wpush: string;
  /** Uniswap V3 Factory - for token graduation */
  uniswapV3Factory: string;
}

/**
 * Chain configuration with contract addresses
 */
export interface ChainConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  rpcUrlAlt?: string;
  blockExplorer?: string;
  addresses: ContractAddresses;
}

/**
 * Configuration key for contract addresses in ConfigService
 */
export const CONTRACT_ADDRESSES_KEY = 'contractAddresses';

/**
 * Push Chain Testnet configuration (Chain ID: 42101)
 * Deployed contracts from smart-contract2
 */
export const PUSH_CHAIN_TESTNET_CONFIG: ChainConfig = {
  chainId: 42101,
  chainName: 'Push Chain Testnet',
  rpcUrl: 'https://evm.donut.rpc.push.org/',
  rpcUrlAlt: 'https://evm.rpc-testnet-donut-node2.push.org/',
  blockExplorer: 'https://donut.push.network/',
  addresses: {
    core: '0x592F8f0abbB9a3d3c425980Ac0263363C8405b03',
    factory: '0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8',
    feeVault: '0xbe2fd9b720d1d7fac7208523376d2a3332019928',
    wpush: '0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7',
    uniswapV3Factory: '0x67a3CB5cc035a15dd6e26AFA9fA52e25a20348e7',
  },
};

/**
 * Get contract addresses from ConfigService
 * @param configService NestJS ConfigService instance
 * @returns Contract addresses
 */
export function getContractAddresses(configService: ConfigService): ContractAddresses {
  const config = configService.get<ChainConfig>(CONTRACT_ADDRESSES_KEY);
  if (!config) {
    return PUSH_CHAIN_TESTNET_CONFIG.addresses;
  }
  return config.addresses;
}

/**
 * Get contract addresses from environment variables with defaults
 * Used for direct environment variable configuration
 * @returns Contract addresses
 */
export function getContractAddressesFromEnv(): ContractAddresses {
  return {
    core:
      process.env.CORE_CONTRACT_ADDRESS || PUSH_CHAIN_TESTNET_CONFIG.addresses.core,
    factory:
      process.env.FACTORY_CONTRACT_ADDRESS ||
      PUSH_CHAIN_TESTNET_CONFIG.addresses.factory,
    feeVault:
      process.env.FEE_VAULT_CONTRACT_ADDRESS ||
      PUSH_CHAIN_TESTNET_CONFIG.addresses.feeVault,
    wpush:
      process.env.WPUSH_CONTRACT_ADDRESS || PUSH_CHAIN_TESTNET_CONFIG.addresses.wpush,
    uniswapV3Factory:
      process.env.UNISWAP_V3_FACTORY_ADDRESS ||
      PUSH_CHAIN_TESTNET_CONFIG.addresses.uniswapV3Factory,
  };
}

/**
 * Get chain configuration from environment or default
 * @returns Chain configuration
 */
export function getChainConfig(): ChainConfig {
  const chainId = parseInt(process.env.CHAIN_ID || '42101', 10);

  if (chainId === 42101) {
    return {
      ...PUSH_CHAIN_TESTNET_CONFIG,
      addresses: getContractAddressesFromEnv(),
    };
  }

  // Future: Add mainnet configuration here
  return {
    ...PUSH_CHAIN_TESTNET_CONFIG,
    chainId,
    addresses: getContractAddressesFromEnv(),
  };
}

/**
 * Contract configuration factory for NestJS ConfigModule
 */
export const contractsConfig = () => ({
  [CONTRACT_ADDRESSES_KEY]: getChainConfig(),
});
