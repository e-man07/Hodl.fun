/**
 * Jest Integration Test Configuration
 * Runs integration tests for all services with proper isolation
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/test/tsconfig.e2e.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@hodlfun/database$': '<rootDir>/libs/database/src/index.ts',
    '^@hodlfun/redis$': '<rootDir>/libs/redis/src/index.ts',
    '^@hodlfun/common$': '<rootDir>/libs/common/src/index.ts',
  },
  modulePaths: ['<rootDir>/apps/api/node_modules', '<rootDir>/node_modules'],
  testEnvironment: 'node',
  testTimeout: 30000,
  // Run integration tests serially to avoid database conflicts
  maxWorkers: 1,
  // Collect coverage from all source files
  collectCoverageFrom: [
    'apps/**/src/**/*.ts',
    'libs/**/src/**/*.ts',
    '!**/*.d.ts',
    '!**/main.ts',
    '!**/*.module.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/integration',
};
