/**
 * E2E Test Setup
 * Configures global test environment for E2E tests
 */

// Increase Jest timeout for E2E tests
jest.setTimeout(60000);

// Silence console during tests unless there's an error
const originalConsole = { ...console };

beforeAll(() => {
  // Optionally suppress non-error logs during tests
  if (process.env.SILENT_TESTS === 'true') {
    console.log = jest.fn();
    console.debug = jest.fn();
    console.info = jest.fn();
  }
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
