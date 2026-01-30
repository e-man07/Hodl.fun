/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../../..',
  testRegex: 'test/e2e/live/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/test/tsconfig.e2e.json',
      },
    ],
  },
  testEnvironment: 'node',
  // Add module paths for pnpm workspace resolution
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@hodlfun/database$': '<rootDir>/libs/database/src/index.ts',
    '^@hodlfun/database/(.*)$': '<rootDir>/libs/database/src/$1',
    '^@hodlfun/redis$': '<rootDir>/libs/redis/src/index.ts',
    '^@hodlfun/redis/(.*)$': '<rootDir>/libs/redis/src/$1',
    '^@hodlfun/common$': '<rootDir>/libs/common/src/index.ts',
    '^@hodlfun/common/(.*)$': '<rootDir>/libs/common/src/$1',
  },
  // Long timeout for live tests (2 minutes per test)
  testTimeout: 120000,
  // Run tests sequentially since they depend on blockchain state
  maxWorkers: 1,
  // Verbose output for live testing
  verbose: true,
  // No coverage for live tests
  collectCoverage: false,
  // Setup file
  setupFilesAfterEnv: ['<rootDir>/test/e2e/live/setup.ts'],
  // Fail fast on first error
  bail: false,
  // Allow console output
  silent: false,
};
