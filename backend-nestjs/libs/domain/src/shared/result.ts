/**
 * Result Type
 *
 * Represents the result of an operation that can succeed or fail
 * Used for error handling without throwing exceptions
 *
 * Usage:
 * ```typescript
 * const result = calculatePrice(amount);
 * if (result.isSuccess) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export type Result<T> = Success<T> | Failure;

export class Success<T> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(readonly value: T) {}
}

export class Failure {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(readonly error: string) {}
}

/**
 * Create a success result
 */
export function ok<T>(value: T): Result<T> {
  return new Success(value);
}

/**
 * Create a failure result
 */
export function fail(error: string): Result<never> {
  return new Failure(error);
}

/**
 * Helper to check if result is success with type guard
 */
export function isSuccess<T>(result: Result<T>): result is Success<T> {
  return result.isSuccess;
}

/**
 * Helper to check if result is failure with type guard
 */
export function isFailure<T>(result: Result<T>): result is Failure {
  return result.isFailure;
}
