/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/test/tsconfig.e2e.json',
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage/e2e',
  testEnvironment: 'node',
  // Add module paths for pnpm workspace resolution
  modulePaths: ['<rootDir>/apps/api/node_modules', '<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@hodlfun/database$': '<rootDir>/libs/database/src/index.ts',
    '^@hodlfun/database/(.*)$': '<rootDir>/libs/database/src/$1',
    '^@hodlfun/redis$': '<rootDir>/libs/redis/src/index.ts',
    '^@hodlfun/redis/(.*)$': '<rootDir>/libs/redis/src/$1',
    '^@hodlfun/common$': '<rootDir>/libs/common/src/index.ts',
    '^@hodlfun/common/(.*)$': '<rootDir>/libs/common/src/$1',
  },
  testTimeout: 60000, // E2E tests may take longer
  // Run tests sequentially since they share real services
  maxWorkers: 1,
  // Setup file for global test initialization
  setupFilesAfterEnv: ['<rootDir>/test/e2e/setup.ts'],
};
