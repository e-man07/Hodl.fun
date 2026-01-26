/**
 * Shared Jest Preset for all packages
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  moduleNameMapper: {
    '^@hodlfun/common$': '<rootDir>/../../libs/common/src',
    '^@hodlfun/common/(.*)$': '<rootDir>/../../libs/common/src/$1',
    '^@hodlfun/database$': '<rootDir>/../../libs/database/src',
    '^@hodlfun/database/(.*)$': '<rootDir>/../../libs/database/src/$1',
    '^@hodlfun/redis$': '<rootDir>/../../libs/redis/src',
    '^@hodlfun/redis/(.*)$': '<rootDir>/../../libs/redis/src/$1',
  },
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
