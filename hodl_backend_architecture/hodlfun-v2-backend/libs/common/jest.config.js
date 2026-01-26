module.exports = {
  displayName: 'common',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/*.d.ts'],
  coverageDirectory: '../../coverage/libs/common',
  moduleNameMapper: {
    '^@hodlfun/common$': '<rootDir>/src',
    '^@hodlfun/common/(.*)$': '<rootDir>/src/$1',
    '^@hodlfun/redis$': '<rootDir>/../redis/src',
    '^@hodlfun/redis/(.*)$': '<rootDir>/../redis/src/$1',
  },
};
