module.exports = {
  displayName: 'api-integration',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: 'src/__tests__/integration/.*\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.d.ts', '!src/**/*.module.ts'],
  coverageDirectory: '../../coverage/apps/api-integration',
  // Run integration tests serially to avoid database conflicts
  maxWorkers: 1,
  testTimeout: 30000,
};
