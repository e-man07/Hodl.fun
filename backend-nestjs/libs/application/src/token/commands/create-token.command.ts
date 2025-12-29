/**
 * Create Token Command
 *
 * CQRS Command: Triggered when user creates a new token
 * Corresponds to blockchain TokenCreated/Create event
 *
 * Command → Handler → Domain Event → Event Handler → Read Model Updated
 */
export class CreateTokenCommand {
  constructor(
    readonly tokenId: string,
    readonly tokenAddress: string,
    readonly name: string,
    readonly symbol: string,
    readonly creator: string,
    readonly decimals: number,
    readonly totalSupply: bigint,
    readonly virtualNativeReserve: bigint, // Initial bonding curve reserve (PUSH)
    readonly virtualTokenReserve: bigint, // Initial bonding curve reserve (tokens)
  ) {}
}
