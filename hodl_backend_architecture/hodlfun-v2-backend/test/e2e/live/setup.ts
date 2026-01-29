/**
 * Live E2E Test Setup
 * Configures global test environment for live blockchain tests
 */

// Increase Jest timeout for all live tests (blockchain operations are slow)
jest.setTimeout(120000);

// Log test environment
console.log('='.repeat(60));
console.log('LIVE E2E TEST ENVIRONMENT');
console.log('='.repeat(60));
console.log(`Network: Push Chain Testnet (Chain ID: 42101)`);
console.log(`RPC: ${process.env.RPC_URL || 'https://evm.rpc-testnet-donut-node1.push.org/'}`);
console.log(`API: ${process.env.API_URL || 'http://localhost:3000'}`);
console.log(`WebSocket: ${process.env.WS_URL || 'http://localhost:3001'}`);
console.log(`Indexer: ${process.env.INDEXER_URL || 'http://localhost:3002'}`);
console.log(`Worker: ${process.env.WORKER_URL || 'http://localhost:3003'}`);
console.log('='.repeat(60));

// Validate required environment variables
if (!process.env.TEST_WALLET_PRIVATE_KEY) {
  console.error('\nERROR: TEST_WALLET_PRIVATE_KEY environment variable is required!');
  console.error('Set it in your environment or create a .env.test file:\n');
  console.error('  TEST_WALLET_PRIVATE_KEY=0x...\n');
  console.error('The wallet should have at least 1-5 PUSH on Push Chain testnet.');
  console.error('Get testnet PUSH from: https://faucet.push.org/\n');
  process.exit(1);
}

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log when tests start
beforeAll(() => {
  console.log('\nStarting live E2E tests...\n');
});

// Log when tests complete
afterAll(() => {
  console.log('\nLive E2E tests completed.\n');
});
