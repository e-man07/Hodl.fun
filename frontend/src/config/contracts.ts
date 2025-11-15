// Contract addresses and configuration for Push Chain deployment
export const CONTRACTS = {
  PUSH_TESTNET: {
    chainId: 42101,
    name: 'Push Chain Testnet',
    rpcUrl: 'https://evm.donut.rpc.push.org/',
    blockExplorer: 'https://donut.push.network',
    nativeCurrency: {
      name: 'PUSH',
      symbol: 'PUSH',
      decimals: 18,
    },
    contracts: {
      TokenMarketplace: '0x7f2F649125E1Cb4F5cC84DBF581Cd59b6311f46f',
      TokenFactory: '0xFB07792D0F71C7e385aC220bEaeF0cbF187233A0',
    },
  },
} as const;

// Current network configuration
export const CURRENT_NETWORK = CONTRACTS.PUSH_TESTNET;

// Contract addresses for easy access
export const CONTRACT_ADDRESSES = CURRENT_NETWORK.contracts;

// Network configuration
export const NETWORK_CONFIG = {
  chainId: CURRENT_NETWORK.chainId,
  chainName: CURRENT_NETWORK.name,
  rpcUrls: [CURRENT_NETWORK.rpcUrl],
  blockExplorerUrls: [CURRENT_NETWORK.blockExplorer],
  nativeCurrency: CURRENT_NETWORK.nativeCurrency,
};

// Contract deployment info
export const DEPLOYMENT_INFO = {
  network: 'Push Chain Testnet',
  deployedAt: new Date('2025-01-09'),
  deployer: '0xE9D8e0a26Bc6ee5C35596dD4caEb91ec633D1d1D',
  verified: true,
  marketplaceUrl: `${CURRENT_NETWORK.blockExplorer}/address/${CONTRACT_ADDRESSES.TokenMarketplace}`,
  factoryUrl: `${CURRENT_NETWORK.blockExplorer}/address/${CONTRACT_ADDRESSES.TokenFactory}`,
};
