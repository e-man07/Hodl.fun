/**
 * Circuit Breaker States
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker Metrics
 */
export interface CircuitBreakerMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  lastStateChange?: Date;
}

/**
 * Circuit Breaker Options
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before transitioning from OPEN to HALF_OPEN */
  resetTimeoutMs: number;
  /** Max attempts allowed in HALF_OPEN state before deciding */
  halfOpenMaxAttempts: number;
  /** Callback when state changes */
  onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;
  /** Callback when a call fails */
  onFailure?: (error: Error) => void;
  /** Callback when a call succeeds */
  onSuccess?: (result: unknown) => void;
}

/**
 * Circuit Breaker implementation for resilient service calls.
 *
 * States:
 * - CLOSED: Normal operation, calls pass through
 * - OPEN: Circuit tripped, calls are rejected immediately
 * - HALF_OPEN: Testing if service recovered, limited calls allowed
 *
 * Transitions:
 * - CLOSED -> OPEN: When failure count reaches threshold
 * - OPEN -> HALF_OPEN: After reset timeout expires
 * - HALF_OPEN -> CLOSED: On successful call
 * - HALF_OPEN -> OPEN: On failed call
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private lastStateChange?: Date;
  private halfOpenAttempts = 0;

  // Metrics
  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private rejectedCalls = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  /**
   * Execute a function through the circuit breaker.
   * @param fn The function to execute
   * @param fallback Optional fallback function when circuit is OPEN
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    // Check if we should transition from OPEN to HALF_OPEN
    this.checkStateTransition();

    if (this.state === CircuitBreakerState.OPEN) {
      this.rejectedCalls++;
      if (fallback) {
        return fallback();
      }
      throw new Error('Circuit breaker is OPEN');
    }

    this.totalCalls++;

    try {
      const result = await fn();
      this.onCallSuccess(result);
      return result;
    } catch (error) {
      this.onCallFailure(error as Error);
      throw error;
    }
  }

  /**
   * Get the current state of the circuit breaker.
   */
  getState(): CircuitBreakerState {
    this.checkStateTransition();
    return this.state;
  }

  /**
   * Get the current failure count.
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get circuit breaker metrics.
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      rejectedCalls: this.rejectedCalls,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state.
   */
  reset(): void {
    this.transitionTo(CircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.rejectedCalls = 0;
    this.lastFailureTime = undefined;
  }

  /**
   * Check if state should transition based on time.
   */
  private checkStateTransition(): void {
    if (this.state === CircuitBreakerState.OPEN && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime.getTime();
      if (elapsed >= this.options.resetTimeoutMs) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
        this.halfOpenAttempts = 0;
      }
    }
  }

  /**
   * Handle successful call.
   */
  private onCallSuccess(result: unknown): void {
    this.successfulCalls++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Success in HALF_OPEN means service recovered
      this.transitionTo(CircuitBreakerState.CLOSED);
      this.failureCount = 0;
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }

    this.options.onSuccess?.(result);
  }

  /**
   * Handle failed call.
   */
  private onCallFailure(error: Error): void {
    this.failedCalls++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Failure in HALF_OPEN means service still failing
      this.transitionTo(CircuitBreakerState.OPEN);
    } else if (this.failureCount >= this.options.failureThreshold) {
      // Threshold reached, open the circuit
      this.transitionTo(CircuitBreakerState.OPEN);
    }

    this.options.onFailure?.(error);
  }

  /**
   * Transition to a new state.
   */
  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.lastStateChange = new Date();
      this.options.onStateChange?.(oldState, newState);
    }
  }
}
