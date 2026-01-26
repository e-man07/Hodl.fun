module.exports = {
  displayName: 'database',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/*.d.ts'],
  coverageDirectory: '../../coverage/libs/database',
  moduleNameMapper: {
    '^@hodlfun/database$': '<rootDir>/src',
    '^@hodlfun/database/(.*)$': '<rootDir>/src/$1',
  },
};
