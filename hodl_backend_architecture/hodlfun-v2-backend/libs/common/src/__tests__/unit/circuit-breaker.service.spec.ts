import { CircuitBreaker, CircuitBreakerState, CircuitBreakerOptions } from '../../resilience/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  const defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 3,
    resetTimeoutMs: 1000,
    halfOpenMaxAttempts: 1,
  };

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(defaultOptions);
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should have zero failure count initially', () => {
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });

  describe('CLOSED state behavior', () => {
    it('should execute successful calls and remain CLOSED', async () => {
      const successFn = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(successFn);

      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should increment failure count on failed calls', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');

      expect(circuitBreaker.getFailureCount()).toBe(1);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reset failure count on successful call', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      const successFn = jest.fn().mockResolvedValue('success');

      // Fail twice
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      expect(circuitBreaker.getFailureCount()).toBe(2);

      // Succeed once - should reset
      await circuitBreaker.execute(successFn);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should transition to OPEN after reaching failure threshold', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('OPEN state behavior', () => {
    beforeEach(async () => {
      // Trip the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      }
    });

    it('should reject calls immediately when OPEN', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      await expect(circuitBreaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');

      expect(fn).not.toHaveBeenCalled();
    });

    it('should use fallback function when OPEN if provided', async () => {
      const fn = jest.fn().mockResolvedValue('primary');
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await circuitBreaker.execute(fn, fallback);

      expect(result).toBe('fallback');
      expect(fn).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });

  describe('HALF_OPEN state behavior', () => {
    beforeEach(async () => {
      // Trip the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      }
      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it('should be in HALF_OPEN state after reset timeout', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should transition to CLOSED on successful call in HALF_OPEN', async () => {
      const successFn = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(successFn);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should transition back to OPEN on failed call in HALF_OPEN', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('fail');

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('event callbacks', () => {
    it('should call onStateChange when state changes', async () => {
      const onStateChange = jest.fn();
      circuitBreaker = new CircuitBreaker({
        ...defaultOptions,
        onStateChange,
      });

      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      }

      expect(onStateChange).toHaveBeenCalledWith(
        CircuitBreakerState.CLOSED,
        CircuitBreakerState.OPEN,
      );
    });

    it('should call onFailure when a call fails', async () => {
      const onFailure = jest.fn();
      circuitBreaker = new CircuitBreaker({
        ...defaultOptions,
        onFailure,
      });

      const error = new Error('test error');
      const failFn = jest.fn().mockRejectedValue(error);

      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();

      expect(onFailure).toHaveBeenCalledWith(error);
    });

    it('should call onSuccess when a call succeeds', async () => {
      const onSuccess = jest.fn();
      circuitBreaker = new CircuitBreaker({
        ...defaultOptions,
        onSuccess,
      });

      const successFn = jest.fn().mockResolvedValue('result');

      await circuitBreaker.execute(successFn);

      expect(onSuccess).toHaveBeenCalledWith('result');
    });
  });

  describe('metrics', () => {
    it('should track total calls', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successfulCalls).toBe(2);
      expect(metrics.failedCalls).toBe(1);
    });

    it('should track rejected calls when OPEN', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      }

      // Try to call when open
      await expect(circuitBreaker.execute(failFn)).rejects.toThrow('Circuit breaker is OPEN');

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.rejectedCalls).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset to CLOSED state and clear metrics', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failFn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
      expect(circuitBreaker.getMetrics().totalCalls).toBe(0);
    });
  });
});
