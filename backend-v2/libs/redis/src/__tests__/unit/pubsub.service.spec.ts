/**
 * PubSub Service Unit Tests
 * Tests for Redis pub/sub messaging
 */
import { ConfigService } from '@nestjs/config';

// Create mock Redis instance factories
const createMockRedisInstance = () => ({
  on: jest.fn().mockReturnThis(),
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue('OK'),
});

// Store mock instances to access them later
let mockPublisherInstance: ReturnType<typeof createMockRedisInstance>;
let mockSubscriberInstance: ReturnType<typeof createMockRedisInstance>;
let instanceCount = 0;

// We need to mock Redis before importing PubSubService
jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => {
    instanceCount++;
    // First instance is publisher, second is subscriber
    if (instanceCount % 2 === 1) {
      mockPublisherInstance = createMockRedisInstance();
      return mockPublisherInstance;
    } else {
      mockSubscriberInstance = createMockRedisInstance();
      return mockSubscriberInstance;
    }
  });
  return { default: MockRedis, __esModule: true };
});

const mockConfigService = {
  get: jest.fn().mockReturnValue('redis://localhost:6379'),
};

describe('PubSubService', () => {
  // Import after mock setup
  let PubSubService: typeof import('../../pubsub.service').PubSubService;
  let service: InstanceType<typeof PubSubService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    instanceCount = 0;

    // Re-import to get fresh module
    jest.isolateModules(() => {
      PubSubService = require('../../pubsub.service').PubSubService;
    });

    service = new PubSubService(mockConfigService as unknown as ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create publisher and subscriber instances', () => {
      expect(mockPublisherInstance).toBeDefined();
      expect(mockSubscriberInstance).toBeDefined();
    });

    it('should use Redis URL from config', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('REDIS_URL', 'redis://localhost:6379');
    });

    it('should set up error handlers for both connections', () => {
      expect(mockSubscriberInstance.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSubscriberInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPublisherInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('publish', () => {
    it('should publish JSON stringified message to channel', async () => {
      const message = { event: 'trade', data: { tokenId: '0x123' } };

      await service.publish('trades', message);

      expect(mockPublisherInstance.publish).toHaveBeenCalledWith('trades', JSON.stringify(message));
    });

    it('should publish string message', async () => {
      await service.publish('notifications', 'test-message');

      expect(mockPublisherInstance.publish).toHaveBeenCalledWith('notifications', '"test-message"');
    });

    it('should publish array message', async () => {
      const message = [1, 2, 3];

      await service.publish('data', message);

      expect(mockPublisherInstance.publish).toHaveBeenCalledWith('data', JSON.stringify(message));
    });

    it('should publish null message', async () => {
      await service.publish('channel', null);

      expect(mockPublisherInstance.publish).toHaveBeenCalledWith('channel', 'null');
    });

    it('should publish to different channels independently', async () => {
      await service.publish('channel1', { msg: 1 });
      await service.publish('channel2', { msg: 2 });

      expect(mockPublisherInstance.publish).toHaveBeenCalledWith('channel1', '{"msg":1}');
      expect(mockPublisherInstance.publish).toHaveBeenCalledWith('channel2', '{"msg":2}');
    });
  });

  describe('subscribe', () => {
    it('should subscribe to channel with handler', async () => {
      const handler = jest.fn();

      await service.subscribe('test-channel', handler);

      expect(mockSubscriberInstance.subscribe).toHaveBeenCalledWith('test-channel');
    });

    it('should store handler for channel', async () => {
      const handler = jest.fn();

      await service.subscribe('test-channel', handler);

      // Verify handler is stored by checking internal map
      const handlers = (service as any).handlers;
      expect(handlers.get('test-channel')).toBe(handler);
    });

    it('should allow subscribing to multiple channels', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await service.subscribe('channel1', handler1);
      await service.subscribe('channel2', handler2);

      expect(mockSubscriberInstance.subscribe).toHaveBeenCalledWith('channel1');
      expect(mockSubscriberInstance.subscribe).toHaveBeenCalledWith('channel2');
    });

    it('should replace handler when subscribing to same channel twice', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await service.subscribe('test-channel', handler1);
      await service.subscribe('test-channel', handler2);

      const handlers = (service as any).handlers;
      expect(handlers.get('test-channel')).toBe(handler2);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from channel', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel', handler);

      await service.unsubscribe('test-channel');

      expect(mockSubscriberInstance.unsubscribe).toHaveBeenCalledWith('test-channel');
    });

    it('should remove handler from internal map', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel', handler);

      await service.unsubscribe('test-channel');

      const handlers = (service as any).handlers;
      expect(handlers.has('test-channel')).toBe(false);
    });

    it('should not throw when unsubscribing from non-subscribed channel', async () => {
      await expect(service.unsubscribe('non-existent')).resolves.not.toThrow();
    });
  });

  describe('message handling', () => {
    it('should call handler with parsed message', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel', handler);

      // Simulate receiving a message by calling the message handler
      const messageHandler = mockSubscriberInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      const testMessage = { event: 'test', data: { id: 1 } };
      messageHandler('test-channel', JSON.stringify(testMessage));

      expect(handler).toHaveBeenCalledWith(testMessage);
    });

    it('should not call handler for different channel', async () => {
      const handler = jest.fn();
      await service.subscribe('channel1', handler);

      const messageHandler = mockSubscriberInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      messageHandler('channel2', JSON.stringify({ data: 'test' }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel', handler);

      const messageHandler = mockSubscriberInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      // This should not throw, just log error
      expect(() => messageHandler('test-channel', 'invalid-json{')).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle string messages', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel', handler);

      const messageHandler = mockSubscriberInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      messageHandler('test-channel', '"simple-string"');

      expect(handler).toHaveBeenCalledWith('simple-string');
    });

    it('should handle array messages', async () => {
      const handler = jest.fn();
      await service.subscribe('test-channel', handler);

      const messageHandler = mockSubscriberInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      messageHandler('test-channel', '[1,2,3]');

      expect(handler).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close both publisher and subscriber connections', async () => {
      await service.onModuleDestroy();

      expect(mockPublisherInstance.quit).toHaveBeenCalled();
      expect(mockSubscriberInstance.quit).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should set up error handler for subscriber', () => {
      const errorHandler = mockSubscriberInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'error',
      );
      expect(errorHandler).toBeDefined();
    });

    it('should set up error handler for publisher', () => {
      const errorHandler = mockPublisherInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'error',
      );
      expect(errorHandler).toBeDefined();
    });
  });
});
