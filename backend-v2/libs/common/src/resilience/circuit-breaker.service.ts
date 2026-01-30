import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreaker,
  CircuitBreakerOptions,
  CircuitBreakerState,
  CircuitBreakerMetrics,
} from './circuit-breaker';

export { CircuitBreakerState, CircuitBreakerMetrics };

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxAttempts?: number;
}

const DEFAULT_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  halfOpenMaxAttempts: 1,
};

/**
 * NestJS service for managing circuit breakers.
 * Provides named circuit breakers for different services/operations.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a named circuit breaker.
   */
  getBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    const { name, ...options } = config;

    if (!this.breakers.has(name)) {
      const breakerOptions: CircuitBreakerOptions = {
        failureThreshold: options.failureThreshold ?? DEFAULT_CONFIG.failureThreshold,
        resetTimeoutMs: options.resetTimeoutMs ?? DEFAULT_CONFIG.resetTimeoutMs,
        halfOpenMaxAttempts: options.halfOpenMaxAttempts ?? DEFAULT_CONFIG.halfOpenMaxAttempts,
        onStateChange: (from, to) => {
          this.logger.warn(`Circuit breaker [${name}]: ${from} -> ${to}`);
        },
        onFailure: (error) => {
          this.logger.warn(`Circuit breaker [${name}] failure: ${error.message}`);
        },
      };

      this.breakers.set(name, new CircuitBreaker(breakerOptions));
      this.logger.log(`Circuit breaker [${name}] created`);
    }

    return this.breakers.get(name)!;
  }

  /**
   * Execute a function through a named circuit breaker.
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
    config?: Omit<CircuitBreakerConfig, 'name'>,
  ): Promise<T> {
    const breaker = this.getBreaker({ name, ...config });
    return breaker.execute(fn, fallback);
  }

  /**
   * Get metrics for all circuit breakers.
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * Get metrics for a specific circuit breaker.
   */
  getMetrics(name: string): CircuitBreakerMetrics | undefined {
    return this.breakers.get(name)?.getMetrics();
  }

  /**
   * Get the state of a specific circuit breaker.
   */
  getState(name: string): CircuitBreakerState | undefined {
    return this.breakers.get(name)?.getState();
  }

  /**
   * Reset a specific circuit breaker.
   */
  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
      this.logger.log(`Circuit breaker [${name}] reset`);
    }
  }

  /**
   * Reset all circuit breakers.
   */
  resetAll(): void {
    for (const [name, breaker] of this.breakers) {
      breaker.reset();
      this.logger.log(`Circuit breaker [${name}] reset`);
    }
  }
}
