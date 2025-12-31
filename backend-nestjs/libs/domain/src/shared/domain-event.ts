/**
 * Domain Event Base Class
 *
 * Events that represent things that have happened in the domain
 * Used for event sourcing and event-driven architecture
 *
 * Usage:
 * ```typescript
 * export class TokenCreatedEvent extends DomainEvent {
 *   constructor(
 *     public readonly tokenId: string,
 *     public readonly name: string,
 *     public readonly creator: string,
 *   ) {
 *     super();
 *   }
 * }
 * ```
 */
export abstract class DomainEvent {
  /**
   * When the event occurred
   */
  readonly occurredAt: Date = new Date();

  /**
   * Get event name (class name by default)
   */
  getEventName(): string {
    return this.constructor.name;
  }

  /**
   * Convert event to JSON
   */
  toJSON(): Record<string, string | number | boolean | null | object> {
    type JsonValue = string | number | boolean | null | object;
    const result: Record<string, JsonValue> = {
      eventName: this.getEventName(),
      occurredAt: this.occurredAt.toISOString(),
    };
    for (const prop of Object.getOwnPropertyNames(this)) {
      if (prop !== 'occurredAt') {
        const descriptor = Object.getOwnPropertyDescriptor(this, prop);
        if (descriptor) {
          result[prop] = descriptor.value as JsonValue;
        }
      }
    }
    return result;
  }
}
