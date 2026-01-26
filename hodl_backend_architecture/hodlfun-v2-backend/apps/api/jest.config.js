module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.d.ts', '!src/**/*.module.ts'],
  coverageDirectory: '../../coverage/apps/api',
  moduleNameMapper: {
    '^@hodlfun/common$': '<rootDir>/../../libs/common/src',
    '^@hodlfun/common/(.*)$': '<rootDir>/../../libs/common/src/$1',
    '^@hodlfun/database$': '<rootDir>/../../libs/database/src',
    '^@hodlfun/database/(.*)$': '<rootDir>/../../libs/database/src/$1',
    '^@hodlfun/redis$': '<rootDir>/../../libs/redis/src',
    '^@hodlfun/redis/(.*)$': '<rootDir>/../../libs/redis/src/$1',
  },
};
