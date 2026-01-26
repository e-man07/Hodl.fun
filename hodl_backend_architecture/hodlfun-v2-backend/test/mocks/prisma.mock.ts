/**
 * Prisma Mock Factory
 * Creates mocked PrismaService for unit tests
 */
import { PrismaClient } from '@prisma/client';

// Type-safe mock for PrismaClient
export type MockPrismaClient = {
  [K in keyof PrismaClient]: K extends `$${string}`
    ? jest.Mock
    : {
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        create: jest.Mock;
        createMany: jest.Mock;
        update: jest.Mock;
        updateMany: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
        count: jest.Mock;
        aggregate: jest.Mock;
        upsert: jest.Mock;
      };
};

/**
 * Creates a mock PrismaService with all models mocked
 */
export function createMockPrismaService(): MockPrismaClient {
  const modelMethods = () => ({
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  });

  return {
    token: modelMethods(),
    trade: modelMethods(),
    holder: modelMethods(),
    priceHistory: modelMethods(),
    creatorFee: modelMethods(),
    userPortfolio: modelMethods(),
    indexerState: modelMethods(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn((cb) => cb(createMockPrismaService())),
    $on: jest.fn(),
    $extends: jest.fn(),
  } as unknown as MockPrismaClient;
}

/**
 * Creates a mock PrismaService that is a class (for NestJS DI)
 */
export class MockPrismaService {
  token = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };

  trade = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };

  holder = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };

  priceHistory = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };

  creatorFee = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };

  userPortfolio = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };

  indexerState = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };

  $connect = jest.fn();
  $disconnect = jest.fn();
  $executeRaw = jest.fn();
  $executeRawUnsafe = jest.fn();
  $queryRaw = jest.fn();
  $queryRawUnsafe = jest.fn();
  $transaction = jest.fn((cb: (prisma: MockPrismaService) => Promise<unknown>) =>
    cb(this),
  );
  $on = jest.fn();

  cleanDatabase = jest.fn();
  onModuleInit = jest.fn();
  onModuleDestroy = jest.fn();
}
