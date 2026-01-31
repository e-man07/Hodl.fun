// Contract addresses for Push Chain Testnet (v2)
export const CONTRACTS = {
  CORE: process.env.NEXT_PUBLIC_CORE_ADDRESS || '0x592F8f0abbB9a3d3c425980Ac0263363C8405b03',
  FACTORY: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8',
  FEE_VAULT: process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS || '0xbe2fd9b720d1d7fac7208523376d2a3332019928',
  WPUSH: process.env.NEXT_PUBLIC_WPUSH_ADDRESS || '0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7',
} as const;

// Network configuration
export const NETWORK = {
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '42101'),
  chainIdHex: `0x${parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '42101').toString(16)}`,
  name: 'Push Chain Testnet',
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://evm.rpc-testnet-donut-node1.push.org/',
  blockExplorer: process.env.NEXT_PUBLIC_BLOCK_EXPLORER || 'https://donut.push.network',
  nativeCurrency: {
    name: 'PUSH',
    symbol: 'PUSH',
    decimals: 18,
  },
} as const;

// Token constants
export const TOKEN_CONSTANTS = {
  TOTAL_SUPPLY: BigInt('1000000000000000000000000000'), // 1 billion tokens
  DECIMALS: 18,
  DEFAULT_SLIPPAGE_BPS: 100, // 1%
  DEFAULT_DEADLINE_MINUTES: 20,
  DEX_FEE_TIER: 3000, // 0.3%
} as const;

// Fee configuration
export const FEES = {
  DEPLOY_FEE: '10000000000000000', // 0.01 PUSH in wei
  LISTING_FEE: '100000000000000000', // 0.1 PUSH in wei
  PLATFORM_FEE_BPS: 100, // 1%
  CREATOR_FEE_SHARE_BPS: 3750, // 37.5% of platform fee goes to creator
} as const;
