/**
 * Database Seed Script for Testing
 *
 * Seeds the database with mock data to test all READ-ONLY endpoints
 * without making any contract calls.
 *
 * Usage:
 *   npx ts-node test/seed/seed-mock-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mock addresses
const MOCK_ADDRESSES = {
  creator1: '0x1111111111111111111111111111111111111111',
  creator2: '0x2222222222222222222222222222222222222222',
  user1: '0x3333333333333333333333333333333333333333',
  user2: '0x4444444444444444444444444444444444444444',
  user3: '0x5555555555555555555555555555555555555555',
  token1: '0xaaaa111111111111111111111111111111111111',
  token2: '0xaaaa222222222222222222222222222222222222',
  token3: '0xaaaa333333333333333333333333333333333333',
  token4: '0xaaaa444444444444444444444444444444444444',
  token5: '0xaaaa555555555555555555555555555555555555',
  curve1: '0xbbbb111111111111111111111111111111111111',
  curve2: '0xbbbb222222222222222222222222222222222222',
  curve3: '0xbbbb333333333333333333333333333333333333',
  curve4: '0xbbbb444444444444444444444444444444444444',
  curve5: '0xbbbb555555555555555555555555555555555555',
  pool1: '0xcccc111111111111111111111111111111111111',
};

// Helper to generate random hash
const randomHash = () => '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

// Helper to generate wei amounts (handles decimals)
const toWei = (amount: number) => {
  // Convert to string and handle decimals
  const [whole, decimal = ''] = amount.toString().split('.');
  const paddedDecimal = decimal.padEnd(18, '0').slice(0, 18);
  const weiString = whole + paddedDecimal;
  return BigInt(weiString).toString();
};

async function seedTokens() {
  console.log('Seeding tokens...');

  const tokens = [
    {
      address: MOCK_ADDRESSES.token1,
      curveAddress: MOCK_ADDRESSES.curve1,
      name: 'Moon Rocket',
      symbol: 'MOON',
      creator: MOCK_ADDRESSES.creator1,
      decimals: 18,
      totalSupply: toWei(1000000000), // 1 billion
      reserveRatio: 50,
      metadataURI: 'ipfs://QmTest1',
      logoURL: 'https://picsum.photos/seed/moon/200',
      description: 'To the moon and beyond!',
      currentPrice: toWei(0.001),
      marketCap: toWei(500000),
      volume24h: toWei(50000),
      volume7d: toWei(250000),
      volumeTotal: toWei(1000000),
      priceChange24h: 15.5,
      holderCount: 150,
      tradeCount: 500,
      isLocked: false,
      isListed: false,
      tradingEnabled: true,
      blockNumber: BigInt(1000000),
      transactionHash: randomHash(),
      realNativeReserve: toWei(100000),
      realTokenReserve: toWei(500000000),
      virtualNativeReserve: toWei(200000),
      virtualTokenReserve: toWei(800000000),
      athPrice: toWei(0.0015),
      athMarketCap: toWei(750000),
      athPriceTimestamp: new Date(Date.now() - 3600000),
      athMarketCapTimestamp: new Date(Date.now() - 7200000),
    },
    {
      address: MOCK_ADDRESSES.token2,
      curveAddress: MOCK_ADDRESSES.curve2,
      name: 'Diamond Hands',
      symbol: 'DHAND',
      creator: MOCK_ADDRESSES.creator1,
      decimals: 18,
      totalSupply: toWei(500000000),
      reserveRatio: 50,
      metadataURI: 'ipfs://QmTest2',
      logoURL: 'https://picsum.photos/seed/diamond/200',
      description: 'Hold forever!',
      currentPrice: toWei(0.005),
      marketCap: toWei(2500000),
      volume24h: toWei(100000),
      volume7d: toWei(500000),
      volumeTotal: toWei(2000000),
      priceChange24h: -5.2,
      holderCount: 300,
      tradeCount: 1200,
      isLocked: true, // Locked for graduation
      isListed: false,
      tradingEnabled: true,
      blockNumber: BigInt(1000100),
      transactionHash: randomHash(),
      realNativeReserve: toWei(500000),
      realTokenReserve: toWei(250000000),
      virtualNativeReserve: toWei(200000),
      virtualTokenReserve: toWei(400000000),
      athPrice: toWei(0.006),
      athMarketCap: toWei(3000000),
      athPriceTimestamp: new Date(Date.now() - 86400000),
      athMarketCapTimestamp: new Date(Date.now() - 86400000),
    },
    {
      address: MOCK_ADDRESSES.token3,
      curveAddress: MOCK_ADDRESSES.curve3,
      name: 'Graduated Token',
      symbol: 'GRAD',
      creator: MOCK_ADDRESSES.creator2,
      decimals: 18,
      totalSupply: toWei(100000000),
      reserveRatio: 50,
      metadataURI: 'ipfs://QmTest3',
      logoURL: 'https://picsum.photos/seed/grad/200',
      description: 'Already on Uniswap V3!',
      currentPrice: toWei(0.05),
      marketCap: toWei(5000000),
      volume24h: toWei(500000),
      volume7d: toWei(2000000),
      volumeTotal: toWei(10000000),
      priceChange24h: 25.0,
      holderCount: 1000,
      tradeCount: 5000,
      isLocked: true,
      isListed: true, // Graduated!
      uniswapV3Pool: MOCK_ADDRESSES.pool1,
      listingTimestamp: new Date(Date.now() - 604800000), // 1 week ago
      tradingEnabled: true,
      blockNumber: BigInt(999000),
      transactionHash: randomHash(),
      realNativeReserve: '0',
      realTokenReserve: '0',
      virtualNativeReserve: '0',
      virtualTokenReserve: '0',
      athPrice: toWei(0.08),
      athMarketCap: toWei(8000000),
      athPriceTimestamp: new Date(Date.now() - 172800000),
      athMarketCapTimestamp: new Date(Date.now() - 172800000),
    },
    {
      address: MOCK_ADDRESSES.token4,
      curveAddress: MOCK_ADDRESSES.curve4,
      name: 'New Launch',
      symbol: 'NEW',
      creator: MOCK_ADDRESSES.creator2,
      decimals: 18,
      totalSupply: toWei(1000000000),
      reserveRatio: 50,
      metadataURI: 'ipfs://QmTest4',
      logoURL: 'https://picsum.photos/seed/new/200',
      description: 'Just launched!',
      currentPrice: toWei(0.0001),
      marketCap: toWei(10000),
      volume24h: toWei(5000),
      volume7d: toWei(5000),
      volumeTotal: toWei(5000),
      priceChange24h: 0,
      holderCount: 10,
      tradeCount: 15,
      isLocked: false,
      isListed: false,
      tradingEnabled: true,
      blockNumber: BigInt(1000500),
      transactionHash: randomHash(),
      realNativeReserve: toWei(5000),
      realTokenReserve: toWei(950000000),
      virtualNativeReserve: toWei(200000),
      virtualTokenReserve: toWei(800000000),
      athPrice: toWei(0.0001),
      athMarketCap: toWei(10000),
      athPriceTimestamp: new Date(),
      athMarketCapTimestamp: new Date(),
    },
    {
      address: MOCK_ADDRESSES.token5,
      curveAddress: MOCK_ADDRESSES.curve5,
      name: 'Almost There',
      symbol: 'ALMST',
      creator: MOCK_ADDRESSES.creator1,
      decimals: 18,
      totalSupply: toWei(500000000),
      reserveRatio: 50,
      metadataURI: 'ipfs://QmTest5',
      logoURL: 'https://picsum.photos/seed/almost/200',
      description: 'Almost at graduation threshold!',
      currentPrice: toWei(0.009),
      marketCap: toWei(900000), // Close to 1M graduation threshold
      volume24h: toWei(200000),
      volume7d: toWei(800000),
      volumeTotal: toWei(3000000),
      priceChange24h: 45.0,
      holderCount: 500,
      tradeCount: 2000,
      isLocked: false,
      isListed: false,
      tradingEnabled: true,
      blockNumber: BigInt(1000200),
      transactionHash: randomHash(),
      realNativeReserve: toWei(450000),
      realTokenReserve: toWei(300000000),
      virtualNativeReserve: toWei(200000),
      virtualTokenReserve: toWei(400000000),
      athPrice: toWei(0.009),
      athMarketCap: toWei(900000),
      athPriceTimestamp: new Date(),
      athMarketCapTimestamp: new Date(),
      graduationThreshold: toWei(1000000), // 1M PUSH
    },
  ];

  for (const token of tokens) {
    await prisma.token.upsert({
      where: { address: token.address },
      update: token,
      create: token,
    });
  }

  console.log(`  Created ${tokens.length} tokens`);
}

async function seedHolders() {
  console.log('Seeding holders...');

  const holders = [
    // Token 1 holders
    { tokenAddress: MOCK_ADDRESSES.token1, holderAddress: MOCK_ADDRESSES.user1, balance: toWei(10000000) },
    { tokenAddress: MOCK_ADDRESSES.token1, holderAddress: MOCK_ADDRESSES.user2, balance: toWei(5000000) },
    { tokenAddress: MOCK_ADDRESSES.token1, holderAddress: MOCK_ADDRESSES.user3, balance: toWei(2500000) },
    { tokenAddress: MOCK_ADDRESSES.token1, holderAddress: MOCK_ADDRESSES.creator1, balance: toWei(50000000) },
    // Token 2 holders
    { tokenAddress: MOCK_ADDRESSES.token2, holderAddress: MOCK_ADDRESSES.user1, balance: toWei(20000000) },
    { tokenAddress: MOCK_ADDRESSES.token2, holderAddress: MOCK_ADDRESSES.user3, balance: toWei(15000000) },
    // Token 3 holders
    { tokenAddress: MOCK_ADDRESSES.token3, holderAddress: MOCK_ADDRESSES.user1, balance: toWei(1000000) },
    { tokenAddress: MOCK_ADDRESSES.token3, holderAddress: MOCK_ADDRESSES.user2, balance: toWei(500000) },
    { tokenAddress: MOCK_ADDRESSES.token3, holderAddress: MOCK_ADDRESSES.creator2, balance: toWei(5000000) },
    // Token 4 holders (new token, few holders)
    { tokenAddress: MOCK_ADDRESSES.token4, holderAddress: MOCK_ADDRESSES.user2, balance: toWei(1000000) },
    // Token 5 holders
    { tokenAddress: MOCK_ADDRESSES.token5, holderAddress: MOCK_ADDRESSES.user1, balance: toWei(30000000) },
    { tokenAddress: MOCK_ADDRESSES.token5, holderAddress: MOCK_ADDRESSES.user2, balance: toWei(20000000) },
    { tokenAddress: MOCK_ADDRESSES.token5, holderAddress: MOCK_ADDRESSES.user3, balance: toWei(10000000) },
  ];

  for (const holder of holders) {
    await prisma.holder.upsert({
      where: {
        tokenAddress_holderAddress: {
          tokenAddress: holder.tokenAddress,
          holderAddress: holder.holderAddress,
        },
      },
      update: { balance: holder.balance },
      create: holder,
    });
  }

  console.log(`  Created ${holders.length} holder records`);
}

async function seedTransactions() {
  console.log('Seeding transactions...');

  const transactions = [];
  const types = ['BUY', 'SELL'] as const;
  const tokens = [MOCK_ADDRESSES.token1, MOCK_ADDRESSES.token2, MOCK_ADDRESSES.token3, MOCK_ADDRESSES.token5];
  const users = [MOCK_ADDRESSES.user1, MOCK_ADDRESSES.user2, MOCK_ADDRESSES.user3];

  // Generate 50 random transactions
  for (let i = 0; i < 50; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const tokenAddress = tokens[Math.floor(Math.random() * tokens.length)];
    const userAddress = users[Math.floor(Math.random() * users.length)];
    const amountIn = toWei(Math.floor(Math.random() * 10000) + 100);
    const amountOut = toWei(Math.floor(Math.random() * 1000000) + 10000);
    const price = Math.random() * 0.01;

    transactions.push({
      hash: randomHash(),
      userAddress,
      tokenAddress,
      type,
      amountIn,
      amountOut,
      price,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
      blockNumber: BigInt(1000000 + i),
      status: 'SUCCESS' as const,
    });
  }

  // Add CREATE transactions
  transactions.push({
    hash: randomHash(),
    userAddress: MOCK_ADDRESSES.creator1,
    tokenAddress: MOCK_ADDRESSES.token1,
    type: 'CREATE' as const,
    amountIn: toWei(1000),
    amountOut: toWei(100000000),
    price: 0.00001,
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    blockNumber: BigInt(1000000),
    status: 'SUCCESS' as const,
  });

  for (const tx of transactions) {
    await prisma.transaction.upsert({
      where: { hash: tx.hash },
      update: tx,
      create: tx,
    });
  }

  console.log(`  Created ${transactions.length} transactions`);
}

async function seedPriceHistory() {
  console.log('Seeding price history...');

  const entries = [];
  const tokens = [MOCK_ADDRESSES.token1, MOCK_ADDRESSES.token2, MOCK_ADDRESSES.token5];

  for (const tokenAddress of tokens) {
    // Generate hourly price data for last 7 days
    for (let i = 0; i < 168; i++) { // 7 days * 24 hours
      const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
      const basePrice = tokenAddress === MOCK_ADDRESSES.token1 ? 0.001 :
                        tokenAddress === MOCK_ADDRESSES.token2 ? 0.005 : 0.009;
      const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
      const price = basePrice * (1 + variation);

      entries.push({
        tokenAddress,
        price: toWei(price),
        marketCap: toWei(price * 500000000),
        volume: toWei(Math.random() * 10000),
        timestamp,
        blockNumber: BigInt(1000500 - i * 100),
      });
    }
  }

  // Batch insert
  await prisma.priceHistory.createMany({
    data: entries,
    skipDuplicates: true,
  });

  console.log(`  Created ${entries.length} price history entries`);
}

async function seedUserPortfolios() {
  console.log('Seeding user portfolios...');

  // UserPortfolio only has: id, userId, holdings (JSON), totalInvestedPUSH
  const portfolios = [
    {
      userId: MOCK_ADDRESSES.user1,
      totalInvestedPUSH: toWei(50000),
      holdings: JSON.stringify([
        { tokenAddress: MOCK_ADDRESSES.token1, tokenSymbol: 'MOON', balance: toWei(10000000), avgBuyPrice: toWei(0.0008), totalSpent: toWei(8000), totalSold: '0', realizedPNL: '0' },
        { tokenAddress: MOCK_ADDRESSES.token2, tokenSymbol: 'DHAND', balance: toWei(20000000), avgBuyPrice: toWei(0.004), totalSpent: toWei(80000), totalSold: '0', realizedPNL: '0' },
      ]),
    },
    {
      userId: MOCK_ADDRESSES.user2,
      totalInvestedPUSH: toWei(30000),
      holdings: JSON.stringify([
        { tokenAddress: MOCK_ADDRESSES.token1, tokenSymbol: 'MOON', balance: toWei(5000000), avgBuyPrice: toWei(0.0012), totalSpent: toWei(6000), totalSold: toWei(2000), realizedPNL: toWei(-500) },
      ]),
    },
    {
      userId: MOCK_ADDRESSES.user3,
      totalInvestedPUSH: toWei(100000),
      holdings: JSON.stringify([
        { tokenAddress: MOCK_ADDRESSES.token5, tokenSymbol: 'ALMST', balance: toWei(10000000), avgBuyPrice: toWei(0.008), totalSpent: toWei(80000), totalSold: '0', realizedPNL: '0' },
      ]),
    },
  ];

  for (const portfolio of portfolios) {
    await prisma.userPortfolio.upsert({
      where: { userId: portfolio.userId },
      update: portfolio,
      create: portfolio,
    });
  }

  console.log(`  Created ${portfolios.length} user portfolios`);
}

async function seedUserPositions() {
  console.log('Seeding user positions...');

  const positions = [
    {
      userAddress: MOCK_ADDRESSES.user1,
      tokenAddress: MOCK_ADDRESSES.token1,
      balance: toWei(10000000),
      averagePrice: toWei(0.0008),
      totalInvested: toWei(8000),
      totalSold: '0',
      realizedPnL: '0',
      unrealizedPnL: toWei(2000),
    },
    {
      userAddress: MOCK_ADDRESSES.user1,
      tokenAddress: MOCK_ADDRESSES.token2,
      balance: toWei(20000000),
      averagePrice: toWei(0.004),
      totalInvested: toWei(80000),
      totalSold: '0',
      realizedPnL: '0',
      unrealizedPnL: toWei(20000),
    },
    {
      userAddress: MOCK_ADDRESSES.user2,
      tokenAddress: MOCK_ADDRESSES.token1,
      balance: toWei(5000000),
      averagePrice: toWei(0.0012),
      totalInvested: toWei(6000),
      totalSold: toWei(2000),
      realizedPnL: toWei(-500),
      unrealizedPnL: toWei(-1000),
    },
  ];

  for (const position of positions) {
    await prisma.userPosition.upsert({
      where: {
        userAddress_tokenAddress: {
          userAddress: position.userAddress,
          tokenAddress: position.tokenAddress,
        },
      },
      update: position,
      create: position,
    });
  }

  console.log(`  Created ${positions.length} user positions`);
}

async function seedCreatorFees() {
  console.log('Seeding creator fees...');

  const fees = [
    {
      creatorAddress: MOCK_ADDRESSES.creator1,
      tokenAddress: MOCK_ADDRESSES.token1,
      accumulatedAmount: toWei(500),
      claimedAmount: toWei(200),
      pendingAmount: toWei(300),
    },
    {
      creatorAddress: MOCK_ADDRESSES.creator1,
      tokenAddress: MOCK_ADDRESSES.token2,
      accumulatedAmount: toWei(2000),
      claimedAmount: toWei(0),
      pendingAmount: toWei(2000),
    },
    {
      creatorAddress: MOCK_ADDRESSES.creator1,
      tokenAddress: MOCK_ADDRESSES.token5,
      accumulatedAmount: toWei(1500),
      claimedAmount: toWei(500),
      pendingAmount: toWei(1000),
    },
    {
      creatorAddress: MOCK_ADDRESSES.creator2,
      tokenAddress: MOCK_ADDRESSES.token3,
      accumulatedAmount: toWei(5000),
      claimedAmount: toWei(3000),
      pendingAmount: toWei(2000),
    },
    {
      creatorAddress: MOCK_ADDRESSES.creator2,
      tokenAddress: MOCK_ADDRESSES.token4,
      accumulatedAmount: toWei(50),
      claimedAmount: toWei(0),
      pendingAmount: toWei(50),
    },
  ];

  for (const fee of fees) {
    await prisma.creatorFee.upsert({
      where: {
        creatorAddress_tokenAddress: {
          creatorAddress: fee.creatorAddress,
          tokenAddress: fee.tokenAddress,
        },
      },
      update: fee,
      create: fee,
    });
  }

  console.log(`  Created ${fees.length} creator fee records`);
}

async function seedBlockchainEvents() {
  console.log('Seeding blockchain events...');

  const events = [
    {
      eventType: 'CreateCurve',
      tokenAddress: MOCK_ADDRESSES.token1,
      userAddress: MOCK_ADDRESSES.creator1,
      data: {
        creator: MOCK_ADDRESSES.creator1,
        curve: MOCK_ADDRESSES.curve1,
        token: MOCK_ADDRESSES.token1,
        name: 'Moon Rocket',
        symbol: 'MOON',
      },
      transactionHash: randomHash(),
      blockNumber: BigInt(1000000),
      logIndex: 0,
    },
    {
      eventType: 'Buy',
      tokenAddress: MOCK_ADDRESSES.token1,
      userAddress: MOCK_ADDRESSES.user1,
      data: {
        token: MOCK_ADDRESSES.token1,
        to: MOCK_ADDRESSES.user1,
        amountIn: toWei(1000),
        amountOut: toWei(10000000),
        price: toWei(0.0001),
      },
      transactionHash: randomHash(),
      blockNumber: BigInt(1000010),
      logIndex: 0,
    },
    {
      eventType: 'Sell',
      tokenAddress: MOCK_ADDRESSES.token1,
      userAddress: MOCK_ADDRESSES.user2,
      data: {
        token: MOCK_ADDRESSES.token1,
        from: MOCK_ADDRESSES.user2,
        to: MOCK_ADDRESSES.user2,
        amountIn: toWei(500000),
        amountOut: toWei(500),
        price: toWei(0.001),
      },
      transactionHash: randomHash(),
      blockNumber: BigInt(1000020),
      logIndex: 0,
    },
    {
      eventType: 'Listing',
      tokenAddress: MOCK_ADDRESSES.token3,
      userAddress: null,
      data: {
        curve: MOCK_ADDRESSES.curve3,
        token: MOCK_ADDRESSES.token3,
        pool: MOCK_ADDRESSES.pool1,
        amount0: toWei(500000),
        amount1: toWei(25000000),
        liquidity: toWei(1000000),
      },
      transactionHash: randomHash(),
      blockNumber: BigInt(999500),
      logIndex: 0,
    },
    {
      eventType: 'CreatorFeeDistributed',
      tokenAddress: MOCK_ADDRESSES.token1,
      userAddress: MOCK_ADDRESSES.creator1,
      data: {
        creator: MOCK_ADDRESSES.creator1,
        token: MOCK_ADDRESSES.token1,
        amount: toWei(100),
      },
      transactionHash: randomHash(),
      blockNumber: BigInt(1000030),
      logIndex: 0,
    },
  ];

  for (const event of events) {
    await prisma.blockchainEvent.create({
      data: event,
    });
  }

  console.log(`  Created ${events.length} blockchain events`);
}

async function seedIndexerState() {
  console.log('Seeding indexer state...');

  await prisma.indexerState.upsert({
    where: { id: 'main' },
    update: {
      lastProcessedBlock: BigInt(1000500),
      chainId: 42101,
      isRunning: true,
      errorCount: 0,
    },
    create: {
      id: 'main',
      lastProcessedBlock: BigInt(1000500),
      chainId: 42101,
      isRunning: true,
      errorCount: 0,
    },
  });

  console.log('  Created indexer state');
}

async function seedFeeVaultSnapshots() {
  console.log('Seeding fee vault snapshots...');

  const snapshots = [];
  let totalAssets = BigInt(toWei(100000));

  // Generate hourly snapshots for last 24 hours
  for (let i = 23; i >= 0; i--) {
    const delta = BigInt(Math.floor(Math.random() * 1000)) * BigInt(10 ** 18);
    totalAssets += delta;

    snapshots.push({
      totalAssets: totalAssets.toString(),
      totalSupply: totalAssets.toString(), // 1:1 for simplicity
      pricePerShare: toWei(1),
      blockNumber: BigInt(1000500 - i * 300),
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000),
      assetsDelta: delta.toString(),
    });
  }

  await prisma.feeVaultSnapshot.createMany({
    data: snapshots,
    skipDuplicates: true,
  });

  console.log(`  Created ${snapshots.length} fee vault snapshots`);
}

async function clearDatabase() {
  console.log('Clearing existing data...');

  // Delete in order to respect foreign keys
  await prisma.blockchainEvent.deleteMany();
  await prisma.feeVaultSnapshot.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.creatorFee.deleteMany();
  await prisma.userPosition.deleteMany();
  await prisma.userPortfolio.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.holder.deleteMany();
  await prisma.token.deleteMany();
  await prisma.indexerState.deleteMany();

  console.log('  Database cleared');
}

async function main() {
  console.log('\n========================================');
  console.log('  HODL.FUN DATABASE SEED SCRIPT');
  console.log('========================================\n');

  try {
    await clearDatabase();
    await seedTokens();
    await seedHolders();
    await seedTransactions();
    await seedPriceHistory();
    await seedUserPortfolios();
    await seedUserPositions();
    await seedCreatorFees();
    await seedBlockchainEvents();
    await seedIndexerState();
    await seedFeeVaultSnapshots();

    console.log('\n========================================');
    console.log('  SEEDING COMPLETE!');
    console.log('========================================');
    console.log('\nMock Data Summary:');
    console.log('  - 5 Tokens (1 graduated, 1 locked, 1 near graduation, 2 active)');
    console.log('  - 13 Holder records');
    console.log('  - 51 Transactions (50 trades + 1 create)');
    console.log('  - 504 Price history entries (7 days hourly for 3 tokens)');
    console.log('  - 3 User portfolios');
    console.log('  - 3 User positions');
    console.log('  - 5 Creator fee records');
    console.log('  - 5 Blockchain events');
    console.log('  - 1 Indexer state');
    console.log('  - 24 Fee vault snapshots');
    console.log('\nTest Addresses:');
    console.log(`  Creator 1: ${MOCK_ADDRESSES.creator1}`);
    console.log(`  Creator 2: ${MOCK_ADDRESSES.creator2}`);
    console.log(`  User 1: ${MOCK_ADDRESSES.user1}`);
    console.log(`  User 2: ${MOCK_ADDRESSES.user2}`);
    console.log(`  User 3: ${MOCK_ADDRESSES.user3}`);
    console.log(`  Token 1 (Active): ${MOCK_ADDRESSES.token1}`);
    console.log(`  Token 2 (Locked): ${MOCK_ADDRESSES.token2}`);
    console.log(`  Token 3 (Graduated): ${MOCK_ADDRESSES.token3}`);
    console.log(`  Token 4 (New): ${MOCK_ADDRESSES.token4}`);
    console.log(`  Token 5 (Near Graduation): ${MOCK_ADDRESSES.token5}`);
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
