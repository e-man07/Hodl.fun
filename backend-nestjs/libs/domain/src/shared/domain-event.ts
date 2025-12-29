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
  toJSON(): any {
    return {
      eventName: this.getEventName(),
      occurredAt: this.occurredAt.toISOString(),
      ...Object.getOwnPropertyNames(this)
        .filter((prop) => prop !== 'occurredAt')
        .reduce((acc: any, prop: string) => {
          acc[prop] = (this as any)[prop];
          return acc;
        }, {}),
    };
  }
}
