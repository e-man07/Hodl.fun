// Test setup file
// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/hodl_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.RPC_URL = 'https://evm.donut.rpc.push.org/';
process.env.PINATA_API_KEY = 'test-key';
process.env.PINATA_SECRET_KEY = 'test-secret';

// Import after setting env vars
import { db } from '../config/database';

// Global setup
global.beforeAll(async () => {
  // Database connection is handled by Prisma
});

// Clean up after each test
global.afterEach(async () => {
  // Clear test data if needed
});

// Global teardown
global.afterAll(async () => {
  try {
    await db.$disconnect();
  } catch (error) {
    // Ignore disconnect errors in tests
  }
});
