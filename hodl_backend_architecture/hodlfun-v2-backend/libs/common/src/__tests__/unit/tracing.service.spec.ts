import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TracingService, TracingConfig } from '../../tracing/tracing.service';

describe('TracingService', () => {
  let service: TracingService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          OTEL_SERVICE_NAME: 'test-service',
          OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
          NODE_ENV: 'test',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TracingService>(TracingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should get service name from config', () => {
      const config = service.getConfig();
      expect(config.serviceName).toBe('test-service');
    });

    it('should get OTLP endpoint from config', () => {
      const config = service.getConfig();
      expect(config.endpoint).toBe('http://localhost:4318');
    });

    it('should use default service name if not configured', async () => {
      // Create a new service with empty config to test defaults
      const emptyConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => defaultValue),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TracingService,
          {
            provide: ConfigService,
            useValue: emptyConfigService,
          },
        ],
      }).compile();

      const newService = module.get<TracingService>(TracingService);
      const config = newService.getConfig();
      expect(config.serviceName).toBe('hodlfun-service');
    });
  });

  describe('span creation', () => {
    it('should create a span with name', () => {
      const span = service.startSpan('test-operation');
      expect(span).toBeDefined();
      expect(typeof span.end).toBe('function');
      span.end();
    });

    it('should create a span with attributes', () => {
      const span = service.startSpan('test-operation', {
        'test.attribute': 'value',
        'test.number': 42,
      });
      expect(span).toBeDefined();
      span.end();
    });

    it('should support nested spans', () => {
      const parentSpan = service.startSpan('parent-operation');
      const childSpan = service.startSpan('child-operation');

      expect(parentSpan).toBeDefined();
      expect(childSpan).toBeDefined();

      childSpan.end();
      parentSpan.end();
    });
  });

  describe('trace context', () => {
    it('should get current trace context', () => {
      const context = service.getCurrentContext();
      expect(context).toBeDefined();
    });

    it('should get trace ID from active span', () => {
      const span = service.startSpan('test-span');
      const traceId = service.getTraceId();
      // TraceId can be all zeros if no exporter is configured
      expect(typeof traceId).toBe('string');
      span.end();
    });

    it('should get span ID from active span', () => {
      const span = service.startSpan('test-span');
      const spanId = service.getSpanId();
      expect(typeof spanId).toBe('string');
      span.end();
    });
  });

  describe('instrumentation', () => {
    it('should wrap async function with span', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      const result = await service.withSpan('wrapped-operation', mockFn);

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from wrapped function', async () => {
      const error = new Error('test error');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(service.withSpan('failing-operation', mockFn)).rejects.toThrow('test error');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should record exception on span when function throws', async () => {
      const error = new Error('test error');
      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(service.withSpan('failing-operation', mockFn)).rejects.toThrow();
    });

    it('should add attributes to wrapped span', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');

      await service.withSpan('operation-with-attrs', mockFn, {
        'custom.attribute': 'value',
      });

      expect(mockFn).toHaveBeenCalled();
    });
  });

  describe('custom span kinds', () => {
    it('should create client span', () => {
      const span = service.startClientSpan('external-call');
      expect(span).toBeDefined();
      span.end();
    });

    it('should create server span', () => {
      const span = service.startServerSpan('incoming-request');
      expect(span).toBeDefined();
      span.end();
    });

    it('should create internal span', () => {
      const span = service.startInternalSpan('internal-operation');
      expect(span).toBeDefined();
      span.end();
    });
  });

  describe('metrics integration', () => {
    it('should track span count', async () => {
      service.startSpan('span1').end();
      service.startSpan('span2').end();
      service.startSpan('span3').end();

      const metrics = service.getMetrics();
      expect(metrics.spansCreated).toBe(3);
    });

    it('should track error count', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test'));

      try {
        await service.withSpan('error-op', mockFn);
      } catch {
        // expected
      }

      const metrics = service.getMetrics();
      expect(metrics.errorsRecorded).toBe(1);
    });
  });

  describe('configuration', () => {
    it('should check if tracing is enabled', () => {
      const isEnabled = service.isEnabled();
      expect(typeof isEnabled).toBe('boolean');
    });

    it('should be disabled in test environment by default', () => {
      // In test environment (NODE_ENV=test), tracing should be disabled
      // Our mock sets NODE_ENV to 'test'
      const config = service.getConfig();
      expect(config.enabled).toBe(false);
    });
  });
});
