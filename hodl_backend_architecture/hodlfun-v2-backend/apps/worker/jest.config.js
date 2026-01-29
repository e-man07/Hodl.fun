module.exports = {
  displayName: 'worker',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  // Only run unit tests by default (exclude integration tests)
  testRegex: 'src/__tests__/unit/.*\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.d.ts', '!src/**/*.module.ts'],
  coverageDirectory: '../../coverage/apps/worker',
};
