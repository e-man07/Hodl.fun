module.exports = {
  displayName: 'redis',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/*.d.ts'],
  coverageDirectory: '../../coverage/libs/redis',
  moduleNameMapper: {
    '^@hodlfun/redis$': '<rootDir>/src',
    '^@hodlfun/redis/(.*)$': '<rootDir>/src/$1',
  },
};
