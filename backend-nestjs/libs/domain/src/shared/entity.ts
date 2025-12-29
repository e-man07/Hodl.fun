/**
 * Entity Base Class
 *
 * Objects that have identity and mutable state
 * Equality is based on ID, not property values
 *
 * Usage:
 * ```typescript
 * export class User extends Entity<UserProps> {
 *   constructor(props: UserProps, id?: string) {
 *     super(props, id);
 *   }
 *
 *   changeName(name: string): void {
 *     this.props.name = name;
 *   }
 * }
 * ```
 */
export abstract class Entity<T = any> {
  protected readonly props: T;
  protected readonly _id: string;

  constructor(props: T, id?: string) {
    this.props = props;
    this._id = id || '';
  }

  get id(): string {
    return this._id;
  }

  /**
   * Entities are equal if they have the same ID
   */
  equals(other: Entity<T>): boolean {
    if (!(other instanceof Entity)) {
      return false;
    }
    return this._id === other._id;
  }

  /**
   * Get entity properties
   */
  getProps(): T {
    return this.props;
  }

  /**
   * Convert entity to JSON-serializable object
   */
  toJSON(): any {
    return {
      id: this._id,
      ...this.props,
    };
  }
}
