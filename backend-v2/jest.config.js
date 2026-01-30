/**
 * Root Jest Configuration for Hodlfun V2 Backend
 * Monorepo-wide test configuration
 */
module.exports = {
  projects: [
    '<rootDir>/libs/common',
    '<rootDir>/libs/database',
    '<rootDir>/libs/redis',
    '<rootDir>/apps/api',
    '<rootDir>/apps/websocket',
    '<rootDir>/apps/indexer',
    '<rootDir>/apps/worker',
  ],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/test/**',
    '!**/*.d.ts',
    '!**/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    '^@hodlfun/common$': '<rootDir>/libs/common/src',
    '^@hodlfun/common/(.*)$': '<rootDir>/libs/common/src/$1',
    '^@hodlfun/database$': '<rootDir>/libs/database/src',
    '^@hodlfun/database/(.*)$': '<rootDir>/libs/database/src/$1',
    '^@hodlfun/redis$': '<rootDir>/libs/redis/src',
    '^@hodlfun/redis/(.*)$': '<rootDir>/libs/redis/src/$1',
  },
  testEnvironment: 'node',
  verbose: true,
};
