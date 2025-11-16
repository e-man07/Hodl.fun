// Mock data for testing
import { ethers } from 'ethers';

export const mockTokenAddress = '0x1234567890123456789012345678901234567890';
export const mockUserAddress = '0x0987654321098765432109876543210987654321';
export const mockCreatorAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
export const mockMarketplaceAddress = '0x9876543210987654321098765432109876543210';

export const mockToken = {
  address: mockTokenAddress,
  name: 'Test Token',
  symbol: 'TEST',
  creator: mockCreatorAddress,
  totalSupply: ethers.parseEther('1000000').toString(),
  reserveRatio: 50,
  metadataURI: 'ipfs://QmTest123',
  metadataCache: {
    name: 'Test Token',
    symbol: 'TEST',
    description: 'A test token for unit testing',
    image: 'ipfs://QmTestImage123',
    social: {
      twitter: 'https://twitter.com/test',
      telegram: 'https://t.me/test',
      website: 'https://test.com',
    },
  },
  logoURL: 'ipfs://QmTestImage123',
  description: 'A test token for unit testing',
  socialLinks: {},
  createdAt: new Date('2024-01-01'),
  blockNumber: BigInt(1000000),
  transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  tradingEnabled: true,
  updatedAt: new Date('2024-01-01'),
};

export const mockTokenMetric = {
  id: 'metric1',
  tokenAddress: mockTokenAddress,
  timestamp: new Date('2024-01-01'),
  price: 0.001,
  marketCap: 1000,
  currentSupply: ethers.parseEther('1000000').toString(),
  reserveBalance: ethers.parseEther('1000').toString(),
  holders: 100,
  volume24h: 50,
  priceChange24h: 5.5,
  trades24h: 25,
};

export const mockTransaction = {
  hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  userAddress: mockUserAddress,
  tokenAddress: mockTokenAddress,
  type: 'BUY' as const,
  amountIn: ethers.parseEther('1').toString(),
  amountOut: ethers.parseEther('1000').toString(),
  price: 0.001,
  timestamp: new Date('2024-01-01'),
  blockNumber: BigInt(1000001),
  status: 'SUCCESS' as const,
  gasUsed: '100000',
  gasPrice: ethers.parseUnits('20', 'gwei').toString(),
};

export const mockHolder = {
  id: 'holder1',
  tokenAddress: mockTokenAddress,
  holderAddress: mockUserAddress,
  balance: ethers.parseEther('100').toString(),
  firstAcquired: new Date('2024-01-01'),
  lastUpdated: new Date('2024-01-01'),
};

export const mockUserPortfolio = {
  id: 'portfolio1',
  userAddress: mockUserAddress,
  tokenAddress: mockTokenAddress,
  balance: ethers.parseEther('100').toString(),
  averagePrice: 0.001,
  totalInvested: 0.1,
  realizedPnL: 0,
  unrealizedPnL: 0,
  firstPurchase: new Date('2024-01-01'),
  lastUpdated: new Date('2024-01-01'),
};

export const mockIPFSMetadata = {
  name: 'Test Token',
  symbol: 'TEST',
  description: 'A test token for unit testing',
  image: 'ipfs://QmTestImage123',
  social: {
    twitter: 'https://twitter.com/test',
    telegram: 'https://t.me/test',
    website: 'https://test.com',
  },
};

export const mockMarketStats = {
  date: new Date('2024-01-01'),
  totalTokens: 100,
  totalMarketCap: 100000,
  totalVolume24h: 5000,
  totalHolders: 1000,
  newTokens24h: 5,
  trades24h: 150,
  activeUsers24h: 75,
  avgTokenPrice: 0.001,
};
