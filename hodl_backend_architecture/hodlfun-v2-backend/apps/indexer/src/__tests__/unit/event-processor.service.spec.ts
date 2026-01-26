/**
 * Event Processor Service Unit Tests
 * Tests for blockchain event processing
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventProcessorService } from '../../event-processor/event-processor.service';
import { PrismaService } from '@hodlfun/database';
import { PubSubService, CacheService } from '@hodlfun/redis';
import { MetricsService } from '@hodlfun/common';
import { RpcService } from '../../blockchain/rpc.service';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    Interface: jest.fn().mockImplementation(() => ({
      parseLog: jest.fn(),
    })),
  },
}));

// Test addresses
const TEST_ADDRESSES = {
  core: '0xcore123',
  factory: '0xfactory456',
  token: '0xtoken789',
  curve: '0xcurve101',
  user: '0xuser202',
  pool: '0xpool303',
};

// Mock factories
const createMockConfigService = () => ({
  get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      CORE_ADDRESS: TEST_ADDRESSES.core,
      FACTORY_ADDRESS: TEST_ADDRESSES.factory,
      INDEXER_BATCH_SIZE: '100',
      INDEXER_START_BLOCK: '0',
    };
    return config[key] || defaultValue;
  }),
});

const createMockPrismaService = () => ({
  token: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  trade: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  holder: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  creatorFee: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  indexerState: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

const createMockRpcService = () => ({
  getBlockNumber: jest.fn(),
  getLogs: jest.fn(),
});

const createMockPubSubService = () => ({
  publish: jest.fn(),
});

const createMockCacheService = () => ({
  invalidate: jest.fn(),
  invalidatePattern: jest.fn(),
});

const createMockMetricsService = () => ({
  indexerBlockLag: { set: jest.fn() },
  indexerEventsProcessed: { inc: jest.fn() },
  tokensCreatedTotal: { inc: jest.fn() },
  tradesTotal: { inc: jest.fn() },
  tradingVolume: { inc: jest.fn() },
});

describe('EventProcessorService', () => {
  let service: EventProcessorService;
  let mockConfig: ReturnType<typeof createMockConfigService>;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockRpc: ReturnType<typeof createMockRpcService>;
  let mockPubsub: ReturnType<typeof createMockPubSubService>;
  let mockCache: ReturnType<typeof createMockCacheService>;
  let mockMetrics: ReturnType<typeof createMockMetricsService>;

  beforeEach(async () => {
    mockConfig = createMockConfigService();
    mockPrisma = createMockPrismaService();
    mockRpc = createMockRpcService();
    mockPubsub = createMockPubSubService();
    mockCache = createMockCacheService();
    mockMetrics = createMockMetricsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventProcessorService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RpcService, useValue: mockRpc },
        { provide: PubSubService, useValue: mockPubsub },
        { provide: CacheService, useValue: mockCache },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<EventProcessorService>(EventProcessorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize successfully', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('processNewBlocks', () => {
    beforeEach(() => {
      mockPrisma.indexerState.findUnique.mockResolvedValue({
        id: 'main',
        lastProcessedBlock: 100n,
      });
      mockRpc.getBlockNumber.mockResolvedValue(150);
      mockRpc.getLogs.mockResolvedValue([]);
    });

    it('should skip if already processing', async () => {
      // Set processing flag to true via reflection
      (service as any).isProcessing = true;

      await service.processNewBlocks();

      expect(mockRpc.getBlockNumber).not.toHaveBeenCalled();

      // Reset for cleanup
      (service as any).isProcessing = false;
    });

    it('should set block lag to 0 when caught up', async () => {
      mockRpc.getBlockNumber.mockResolvedValue(100);
      mockPrisma.indexerState.findUnique.mockResolvedValue({
        id: 'main',
        lastProcessedBlock: 100n,
      });

      await service.processNewBlocks();

      expect(mockMetrics.indexerBlockLag.set).toHaveBeenCalledWith(0);
    });

    it('should process blocks in batches', async () => {
      mockRpc.getBlockNumber.mockResolvedValue(250);
      mockConfig.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'INDEXER_BATCH_SIZE') return '100';
        return defaultValue;
      });

      await service.processNewBlocks();

      // Should process from 101 to 200 (batch of 100)
      expect(mockRpc.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 101,
          toBlock: 200,
        }),
      );
    });

    it('should update indexer state after processing', async () => {
      await service.processNewBlocks();

      expect(mockPrisma.indexerState.update).toHaveBeenCalledWith({
        where: { id: 'main' },
        data: { lastProcessedBlock: expect.any(BigInt) },
      });
    });

    it('should create indexer state if not exists', async () => {
      mockPrisma.indexerState.findUnique.mockResolvedValue(null);
      mockPrisma.indexerState.create.mockResolvedValue({
        id: 'main',
        lastProcessedBlock: 0n,
      });

      await service.processNewBlocks();

      expect(mockPrisma.indexerState.create).toHaveBeenCalled();
    });
  });

  describe('handleCreateCurve', () => {
    it('should create token in database', async () => {
      const mockLog = {
        blockNumber: 100,
        transactionHash: '0xabc123',
      };

      const mockParsed = {
        args: {
          creator: TEST_ADDRESSES.user,
          curve: TEST_ADDRESSES.curve,
          token: TEST_ADDRESSES.token,
          tokenURI: 'https://example.com/token.json',
          name: 'Test Token',
          symbol: 'TEST',
        },
      };

      // Access private method
      await (service as any).handleCreateCurve(mockParsed, mockLog);

      expect(mockPrisma.token.upsert).toHaveBeenCalledWith({
        where: { address: TEST_ADDRESSES.token.toLowerCase() },
        update: {},
        create: expect.objectContaining({
          address: TEST_ADDRESSES.token.toLowerCase(),
          name: 'Test Token',
          symbol: 'TEST',
          status: 'TRADING',
        }),
      });
    });

    it('should publish token_created event', async () => {
      const mockParsed = {
        args: {
          creator: TEST_ADDRESSES.user,
          curve: TEST_ADDRESSES.curve,
          token: TEST_ADDRESSES.token,
          tokenURI: '',
          name: 'Test Token',
          symbol: 'TEST',
        },
      };

      await (service as any).handleCreateCurve(mockParsed, { blockNumber: 100 });

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        'token_created',
        expect.objectContaining({
          type: 'token_created',
          token: expect.objectContaining({
            address: TEST_ADDRESSES.token.toLowerCase(),
            name: 'Test Token',
            symbol: 'TEST',
          }),
        }),
      );
    });

    it('should invalidate cache and increment metrics', async () => {
      const mockParsed = {
        args: {
          creator: TEST_ADDRESSES.user,
          curve: TEST_ADDRESSES.curve,
          token: TEST_ADDRESSES.token,
          tokenURI: '',
          name: 'Test',
          symbol: 'T',
        },
      };

      await (service as any).handleCreateCurve(mockParsed, { blockNumber: 100 });

      expect(mockCache.invalidatePattern).toHaveBeenCalledWith('tokens:*');
      expect(mockMetrics.tokensCreatedTotal.inc).toHaveBeenCalled();
      expect(mockMetrics.indexerEventsProcessed.inc).toHaveBeenCalledWith({
        event_type: 'CreateCurve',
      });
    });
  });

  describe('handleBuy', () => {
    const mockBuyEvent = {
      args: {
        token: TEST_ADDRESSES.token,
        to: TEST_ADDRESSES.user,
        amountIn: BigInt('1000000000000000000'), // 1 ETH
        amountOut: BigInt('1000000000000000000000'), // 1000 tokens
        price: BigInt('20000000000000'), // 0.00002 ETH
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      },
    };

    const mockLog = {
      blockNumber: 100,
      transactionHash: '0xabc123',
    };

    it('should skip duplicate trades', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({ id: 'existing' });

      await (service as any).handleBuy(mockBuyEvent, mockLog);

      expect(mockPrisma.trade.create).not.toHaveBeenCalled();
    });

    it('should create trade record', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await (service as any).handleBuy(mockBuyEvent, mockLog);

      expect(mockPrisma.trade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenAddress: TEST_ADDRESSES.token.toLowerCase(),
          type: 'BUY',
          traderAddress: TEST_ADDRESSES.user.toLowerCase(),
          amountIn: '1000000000000000000',
          amountOut: '1000000000000000000000',
        }),
      });
    });

    it('should upsert holder record', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await (service as any).handleBuy(mockBuyEvent, mockLog);

      expect(mockPrisma.holder.upsert).toHaveBeenCalled();
    });

    it('should update token price', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await (service as any).handleBuy(mockBuyEvent, mockLog);

      expect(mockPrisma.token.update).toHaveBeenCalledWith({
        where: { address: TEST_ADDRESSES.token.toLowerCase() },
        data: { currentPrice: '20000000000000' },
      });
    });

    it('should publish trade event', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await (service as any).handleBuy(mockBuyEvent, mockLog);

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        'trade',
        expect.objectContaining({
          type: 'trade',
          trade: expect.objectContaining({
            type: 'BUY',
          }),
        }),
      );
    });

    it('should increment trading metrics', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue(null);

      await (service as any).handleBuy(mockBuyEvent, mockLog);

      expect(mockMetrics.tradesTotal.inc).toHaveBeenCalledWith({ type: 'BUY', status: 'success' });
      expect(mockMetrics.tradingVolume.inc).toHaveBeenCalled();
    });
  });

  describe('handleSell', () => {
    const mockSellEvent = {
      args: {
        token: TEST_ADDRESSES.token,
        from: TEST_ADDRESSES.user,
        amountIn: BigInt('1000000000000000000000'), // 1000 tokens
        amountOut: BigInt('900000000000000000'), // 0.9 ETH
        price: BigInt('18000000000000'), // 0.000018 ETH
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      },
    };

    const mockLog = {
      blockNumber: 101,
      transactionHash: '0xdef456',
    };

    it('should skip duplicate trades', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({ id: 'existing' });

      await (service as any).handleSell(mockSellEvent, mockLog);

      expect(mockPrisma.trade.create).not.toHaveBeenCalled();
    });

    it('should create sell trade record', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue({
        balance: '2000000000000000000000',
      });

      await (service as any).handleSell(mockSellEvent, mockLog);

      expect(mockPrisma.trade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'SELL',
          amountIn: '1000000000000000000000',
          amountOut: '900000000000000000',
        }),
      });
    });

    it('should update holder balance', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue({
        balance: '2000000000000000000000', // 2000 tokens
      });

      await (service as any).handleSell(mockSellEvent, mockLog);

      expect(mockPrisma.holder.update).toHaveBeenCalledWith({
        where: expect.any(Object),
        data: expect.objectContaining({
          balance: '1000000000000000000000', // 2000 - 1000 = 1000
        }),
      });
    });

    it('should handle balance going to zero', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);
      mockPrisma.holder.findUnique.mockResolvedValue({
        balance: '1000000000000000000000', // Equal to sell amount
      });

      await (service as any).handleSell(mockSellEvent, mockLog);

      expect(mockPrisma.holder.update).toHaveBeenCalledWith({
        where: expect.any(Object),
        data: expect.objectContaining({
          balance: '0',
        }),
      });
    });
  });

  describe('handleLock', () => {
    it('should update token status to LOCKED', async () => {
      const mockLockEvent = {
        args: {
          token: TEST_ADDRESSES.token,
        },
      };

      await (service as any).handleLock(mockLockEvent);

      expect(mockPrisma.token.update).toHaveBeenCalledWith({
        where: { address: TEST_ADDRESSES.token.toLowerCase() },
        data: {
          status: 'LOCKED',
          graduatedAt: expect.any(Date),
        },
      });
    });

    it('should publish graduation event', async () => {
      const mockLockEvent = {
        args: { token: TEST_ADDRESSES.token },
      };

      await (service as any).handleLock(mockLockEvent);

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        'graduation',
        expect.objectContaining({
          type: 'graduation',
          status: 'LOCKED',
        }),
      );
    });
  });

  describe('handleListing', () => {
    it('should update token status to LISTED with pool address', async () => {
      const mockListingEvent = {
        args: {
          token: TEST_ADDRESSES.token,
          pool: TEST_ADDRESSES.pool,
          amount0: BigInt('1000'),
          amount1: BigInt('2000'),
          liquidity: BigInt('1414'),
        },
      };

      await (service as any).handleListing(mockListingEvent, { blockNumber: 200 });

      expect(mockPrisma.token.update).toHaveBeenCalledWith({
        where: { address: TEST_ADDRESSES.token.toLowerCase() },
        data: {
          status: 'LISTED',
          poolAddress: TEST_ADDRESSES.pool.toLowerCase(),
          listedAt: expect.any(Date),
          listingBlock: 200n,
        },
      });
    });

    it('should publish listing event', async () => {
      const mockListingEvent = {
        args: {
          token: TEST_ADDRESSES.token,
          pool: TEST_ADDRESSES.pool,
          amount0: BigInt('1000'),
          amount1: BigInt('2000'),
          liquidity: BigInt('1414'),
        },
      };

      await (service as any).handleListing(mockListingEvent, { blockNumber: 200 });

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        'listing',
        expect.objectContaining({
          type: 'listing',
          poolAddress: TEST_ADDRESSES.pool.toLowerCase(),
        }),
      );
    });
  });

  describe('handleSync', () => {
    it('should update token reserves and price', async () => {
      const mockSyncEvent = {
        args: {
          realNative: BigInt('50000000000000000000'), // 50 ETH
          realToken: BigInt('400000000000000000000000'), // 400k tokens
          virtualNative: BigInt('1000000000000000000'), // 1 ETH
          virtualToken: BigInt('50000000000000000000000000'), // 50M tokens
          price: BigInt('25000000000000'), // 0.000025 ETH
        },
      };

      await (service as any).handleSync(mockSyncEvent, TEST_ADDRESSES.token);

      expect(mockPrisma.token.update).toHaveBeenCalledWith({
        where: { address: TEST_ADDRESSES.token },
        data: expect.objectContaining({
          realNative: '50000000000000000000',
          realToken: '400000000000000000000000',
          currentPrice: '25000000000000',
        }),
      });
    });

    it('should publish price update event', async () => {
      const mockSyncEvent = {
        args: {
          realNative: BigInt('50000000000000000000'),
          realToken: BigInt('400000000000000000000000'),
          virtualNative: BigInt('1000000000000000000'),
          virtualToken: BigInt('50000000000000000000000000'),
          price: BigInt('25000000000000'),
        },
      };

      await (service as any).handleSync(mockSyncEvent, TEST_ADDRESSES.token);

      expect(mockPubsub.publish).toHaveBeenCalledWith(
        'price_update',
        expect.objectContaining({
          type: 'price_update',
          tokenAddress: TEST_ADDRESSES.token,
        }),
      );
    });
  });

  describe('handleNewATHPrice', () => {
    it('should update ATH price', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const mockATHEvent = {
        args: {
          token: TEST_ADDRESSES.token,
          newPrice: BigInt('50000000000000'),
          timestamp: BigInt(timestamp),
        },
      };

      await (service as any).handleNewATHPrice(mockATHEvent);

      expect(mockPrisma.token.update).toHaveBeenCalledWith({
        where: { address: TEST_ADDRESSES.token.toLowerCase() },
        data: {
          athPrice: '50000000000000',
          athPriceTimestamp: new Date(timestamp * 1000),
        },
      });
    });
  });

  describe('handleNewATHMarketCap', () => {
    it('should update ATH market cap', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const mockATHEvent = {
        args: {
          token: TEST_ADDRESSES.token,
          newMarketCap: BigInt('100000000000000000000000'),
          timestamp: BigInt(timestamp),
        },
      };

      await (service as any).handleNewATHMarketCap(mockATHEvent);

      expect(mockPrisma.token.update).toHaveBeenCalledWith({
        where: { address: TEST_ADDRESSES.token.toLowerCase() },
        data: {
          athMarketCap: '100000000000000000000000',
          athMarketCapTimestamp: new Date(timestamp * 1000),
        },
      });
    });
  });
});
