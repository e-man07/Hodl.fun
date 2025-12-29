/**
 * Value Object Base Class
 *
 * Immutable objects that have no identity, only value
 * Two value objects are equal if all their properties are equal
 *
 * Usage:
 * ```typescript
 * export class Price extends ValueObject {
 *   constructor(public readonly value: number) {
 *     super();
 *   }
 *
 *   equals(other: Price): boolean {
 *     return this.value === other.value;
 *   }
 * }
 * ```
 */
export abstract class ValueObject {
  /**
   * Check equality with another value object
   * Subclasses must implement this method
   */
  abstract equals(other: any): boolean;

  /**
   * Get unique identifier for this value object
   * Used for Set/Map operations
   */
  hashCode(): string {
    return JSON.stringify(this);
  }

  /**
   * Convert value object to JSON-serializable object
   */
  toJSON(): any {
    return Object.getOwnPropertyNames(this).reduce((acc: any, prop: string) => {
      const value = (this as any)[prop];
      acc[prop] = value instanceof ValueObject ? value.toJSON() : value;
      return acc;
    }, {});
  }
}
