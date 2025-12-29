import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  collectCoverageFrom: [
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/*.interface.ts',
    '!**/index.ts',
    '!**/*mock*.ts',
    '!**/*.spec.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs', '<rootDir>/apps'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/libs/core/src/$1',
    '^@core$': '<rootDir>/libs/core/src',
    '^@domain/(.*)$': '<rootDir>/libs/domain/src/$1',
    '^@domain$': '<rootDir>/libs/domain/src',
    '^@application/(.*)$': '<rootDir>/libs/application/src/$1',
    '^@application$': '<rootDir>/libs/application/src',
    '^@infrastructure/(.*)$': '<rootDir>/libs/infrastructure/src/$1',
    '^@infrastructure$': '<rootDir>/libs/infrastructure/src',
    '^@presentation/(.*)$': '<rootDir>/libs/presentation/src/$1',
    '^@presentation$': '<rootDir>/libs/presentation/src',
    '^@shared/(.*)$': '<rootDir>/libs/shared/src/$1',
    '^@shared$': '<rootDir>/libs/shared/src',
  },
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
};

export default config;
