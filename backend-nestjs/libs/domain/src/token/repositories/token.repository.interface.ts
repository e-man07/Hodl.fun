import { Token } from '../entities/token.entity';
import { TokenAddress } from '../value-objects/token-address.vo';

/**
 * Token Repository Interface (Port)
 *
 * Defines the contract for Token aggregate persistence.
 * Implementations (adapters) will handle actual storage details.
 *
 * Hexagonal Architecture:
 * - This interface is the "port" (boundary between domain and infrastructure)
 * - Repository implementations are "adapters" that implement this port
 * - Domain layer depends on this interface, not on any specific implementation
 * - Swappable: can use Prisma, MongoDB, in-memory cache for testing, etc.
 */
export interface ITokenRepository {
  /**
   * Find token by ID (aggregate root identifier)
   * Returns null if token not found
   */
  findById(id: string): Promise<Token | null>;

  /**
   * Find token by blockchain address
   * Returns null if token not found
   */
  findByAddress(address: TokenAddress): Promise<Token | null>;

  /**
   * Find token by blockchain address (string)
   * Returns null if token not found
   */
  findByAddressString(address: string): Promise<Token | null>;

  /**
   * Get all tokens with optional filtering and pagination
   *
   * @param filter - Optional filter criteria
   * @param options - Pagination and sorting options
   */
  findAll(filter?: {
    creator?: string;
    isLocked?: boolean;
    isListed?: boolean;
  }, options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'marketCap' | 'currentPrice';
    orderDirection?: 'asc' | 'desc';
  }): Promise<{
    tokens: Token[];
    total: number;
  }>;

  /**
   * Get tokens created by a specific creator
   */
  findByCreator(creator: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    tokens: Token[];
    total: number;
  }>;

  /**
   * Save a new token (insert)
   * Token should have just been created (have domain events)
   */
  save(token: Token): Promise<Token>;

  /**
   * Update an existing token (save state changes)
   * Typically called after metrics update, lock, or listing
   */
  update(token: Token): Promise<Token>;

  /**
   * Delete a token (rarely used, mainly for testing/admin)
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count total tokens
   */
  count(): Promise<number>;

  /**
   * Get tokens ready for graduation (market cap >= threshold, not locked)
   */
  findReadyForGraduation(limit?: number): Promise<Token[]>;

  /**
   * Get locked tokens not yet listed on Uniswap
   */
  findLockedNotListed(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    tokens: Token[];
    total: number;
  }>;

  /**
   * Get listed tokens (graduated to Uniswap V3)
   */
  findListed(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    tokens: Token[];
    total: number;
  }>;

  /**
   * Batch find tokens by addresses
   * Useful for loading multiple tokens in one query
   */
  findByAddresses(addresses: string[]): Promise<Map<string, Token>>;

  /**
   * Get trending tokens (by metrics)
   *
   * @param timeframe - '1h', '24h', '7d'
   * @param metric - 'price', 'marketCap', 'trades'
   * @param limit - Number of results
   */
  findTrending(
    timeframe: '1h' | '24h' | '7d',
    metric: 'price' | 'marketCap' | 'trades',
    limit?: number,
  ): Promise<Token[]>;
}

/**
 * Token Repository Symbol
 * Used for dependency injection in NestJS
 * Example: @Inject(TOKEN_REPOSITORY) private repository: ITokenRepository
 */
export const TOKEN_REPOSITORY = Symbol('ITokenRepository');
