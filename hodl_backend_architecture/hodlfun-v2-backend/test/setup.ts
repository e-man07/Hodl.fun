/**
 * Global Test Setup
 * Runs once before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests (optional)
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Set timezone for consistent date handling
process.env.TZ = 'UTC';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Global mock for Date.now() if needed
// const mockDate = new Date('2024-01-01T00:00:00.000Z');
// jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

export {};
