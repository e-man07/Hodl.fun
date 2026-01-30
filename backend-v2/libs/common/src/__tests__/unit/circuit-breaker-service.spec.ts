import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService, CircuitBreakerState } from '../../resilience';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  describe('getBreaker', () => {
    it('should create a new circuit breaker', () => {
      const breaker = service.getBreaker({ name: 'test' });
      expect(breaker).toBeDefined();
      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should return the same breaker for the same name', () => {
      const breaker1 = service.getBreaker({ name: 'test' });
      const breaker2 = service.getBreaker({ name: 'test' });
      expect(breaker1).toBe(breaker2);
    });

    it('should create different breakers for different names', () => {
      const breaker1 = service.getBreaker({ name: 'test1' });
      const breaker2 = service.getBreaker({ name: 'test2' });
      expect(breaker1).not.toBe(breaker2);
    });

    it('should use custom config when provided', () => {
      const breaker = service.getBreaker({
        name: 'custom',
        failureThreshold: 2,
      });
      expect(breaker).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute function through circuit breaker', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      const result = await service.execute('test', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use fallback when circuit is open', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockResolvedValue('fallback');

      // Trip the circuit (default threshold is 5)
      for (let i = 0; i < 5; i++) {
        await expect(service.execute('test-open', failFn)).rejects.toThrow();
      }

      const result = await service.execute('test-open', failFn, fallback);
      expect(result).toBe('fallback');
    });
  });

  describe('getAllMetrics', () => {
    it('should return metrics for all breakers', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      await service.execute('breaker1', fn);
      await service.execute('breaker2', fn);

      const metrics = service.getAllMetrics();

      expect(metrics['breaker1']).toBeDefined();
      expect(metrics['breaker2']).toBeDefined();
      expect(metrics['breaker1'].totalCalls).toBe(1);
      expect(metrics['breaker2'].totalCalls).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for a specific breaker', async () => {
      const fn = jest.fn().mockResolvedValue('result');

      await service.execute('test', fn);
      await service.execute('test', fn);

      const metrics = service.getMetrics('test');

      expect(metrics).toBeDefined();
      expect(metrics!.totalCalls).toBe(2);
      expect(metrics!.successfulCalls).toBe(2);
    });

    it('should return undefined for non-existent breaker', () => {
      const metrics = service.getMetrics('non-existent');
      expect(metrics).toBeUndefined();
    });
  });

  describe('getState', () => {
    it('should return state of a specific breaker', () => {
      service.getBreaker({ name: 'test' });
      const state = service.getState('test');
      expect(state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should return undefined for non-existent breaker', () => {
      const state = service.getState('non-existent');
      expect(state).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset a specific breaker', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        await expect(service.execute('test-reset', failFn)).rejects.toThrow();
      }

      expect(service.getState('test-reset')).toBe(CircuitBreakerState.OPEN);

      service.reset('test-reset');

      expect(service.getState('test-reset')).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('resetAll', () => {
    it('should reset all breakers', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Trip multiple circuits
      for (let i = 0; i < 5; i++) {
        await expect(service.execute('breaker1', failFn)).rejects.toThrow();
        await expect(service.execute('breaker2', failFn)).rejects.toThrow();
      }

      expect(service.getState('breaker1')).toBe(CircuitBreakerState.OPEN);
      expect(service.getState('breaker2')).toBe(CircuitBreakerState.OPEN);

      service.resetAll();

      expect(service.getState('breaker1')).toBe(CircuitBreakerState.CLOSED);
      expect(service.getState('breaker2')).toBe(CircuitBreakerState.CLOSED);
    });
  });
});
