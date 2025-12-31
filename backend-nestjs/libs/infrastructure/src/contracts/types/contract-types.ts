/**
 * Smart Contract Type Definitions
 * TypeScript types for interacting with Hodl.fun smart contracts
 */

/**
 * Factory configuration from BondingCurveFactory.getConfig()
 */
export interface FactoryConfig {
  deployFee: bigint;
  listingFee: bigint;
  virtualNative: bigint;
  virtualToken: bigint;
  k: bigint;
  graduationMarketCap: bigint;
  feeDenominator: number;
  feeNumerator: number;
  dexFee: number;
  creatorFeeShare: number;
}

/**
 * Curve data returned from Core.getCurveData()
 */
export interface CurveData {
  virtualNative: bigint;
  virtualToken: bigint;
  k: bigint;
}

/**
 * Virtual reserves from BondingCurve.getVirtualReserves()
 */
export interface VirtualReserves {
  virtualNativeReserve: bigint;
  virtualTokenReserve: bigint;
}

/**
 * Real reserves from BondingCurve.getReserves()
 */
export interface RealReserves {
  nativeReserves: bigint;
  tokenReserves: bigint;
}

/**
 * Fee configuration from BondingCurve.getFeeConfig()
 */
export interface FeeConfig {
  denominator: number;
  numerator: number;
}

/**
 * ATH (All-Time High) data
 */
export interface ATHData {
  value: bigint;
  timestamp: bigint;
}

/**
 * Transaction data for frontend signing
 */
export interface TransactionData {
  to: string;
  data: string;
  value: string;
  gasEstimate?: string;
}

/**
 * Parameters for creating a new curve/token
 */
export interface CreateCurveParams {
  creator: string;
  name: string;
  symbol: string;
  tokenURI: string;
  amountIn: string;
  fee: string;
}

/**
 * Parameters for exactInBuy
 */
export interface ExactInBuyParams {
  amountIn: string;
  amountOutMin: string;
  token: string;
  to: string;
  deadline: number;
}

/**
 * Parameters for exactOutBuy
 */
export interface ExactOutBuyParams {
  amountOut: string;
  amountInMax: string;
  token: string;
  to: string;
  deadline: number;
}

/**
 * Parameters for exactInSell
 */
export interface ExactInSellParams {
  amountIn: string;
  amountOutMin: string;
  token: string;
  from: string;
  to: string;
  deadline: number;
}

/**
 * Parameters for exactOutSell
 */
export interface ExactOutSellParams {
  amountOut: string;
  amountInMax: string;
  token: string;
  from: string;
  to: string;
  deadline: number;
}

/**
 * Quote result for buy/sell operations
 */
export interface QuoteResult {
  amountIn: string;
  amountOut: string;
  priceImpact: string;
  fee: string;
}

/**
 * Parsed CreateCurve event
 */
export interface CreateCurveEvent {
  creator: string;
  curve: string;
  token: string;
  tokenURI: string;
  name: string;
  symbol: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed Buy event
 */
export interface BuyEvent {
  token: string;
  to: string;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
  timestamp: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed Sell event
 */
export interface SellEvent {
  token: string;
  from: string;
  to: string;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
  timestamp: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed Lock event
 */
export interface LockEvent {
  token: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed Listing event (graduation to DEX)
 */
export interface ListingEvent {
  curve: string;
  token: string;
  pool: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed NewATHPrice event
 */
export interface NewATHPriceEvent {
  token: string;
  newPrice: bigint;
  timestamp: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed NewATHMarketCap event
 */
export interface NewATHMarketCapEvent {
  token: string;
  newMarketCap: bigint;
  timestamp: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed Sync event
 */
export interface SyncEvent {
  token: string;
  realNative: bigint;
  realToken: bigint;
  virtualNative: bigint;
  virtualToken: bigint;
  price: bigint;
  timestamp: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed CreatorFeeDistributed event
 */
export interface CreatorFeeDistributedEvent {
  token: string;
  creator: string;
  amount: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed CreatorFeeDeferredFromBuy event
 * event CreatorFeeDeferredFromBuy(address indexed token, uint256 feeTokenAmount, uint256 price)
 */
export interface CreatorFeeDeferredFromBuyEvent {
  token: string;
  feeTokenAmount: bigint;
  price: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed CreatorFeesAccumulated event
 * event CreatorFeesAccumulated(address indexed creator, uint256 amount, uint256 totalAccumulated)
 */
export interface CreatorFeesAccumulatedEvent {
  creator: string;
  amount: bigint;
  totalAccumulated: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Parsed CreatorFeesClaimed event
 * event CreatorFeesClaimed(address indexed creator, uint256 amount)
 */
export interface CreatorFeesClaimedEvent {
  creator: string;
  amount: bigint;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Union type for all parsed events
 */
export type ParsedEvent =
  | { type: 'CreateCurve'; data: CreateCurveEvent }
  | { type: 'Buy'; data: BuyEvent }
  | { type: 'Sell'; data: SellEvent }
  | { type: 'Lock'; data: LockEvent }
  | { type: 'Listing'; data: ListingEvent }
  | { type: 'NewATHPrice'; data: NewATHPriceEvent }
  | { type: 'NewATHMarketCap'; data: NewATHMarketCapEvent }
  | { type: 'Sync'; data: SyncEvent }
  | { type: 'CreatorFeeDistributed'; data: CreatorFeeDistributedEvent }
  | { type: 'CreatorFeeDeferredFromBuy'; data: CreatorFeeDeferredFromBuyEvent }
  | { type: 'CreatorFeesAccumulated'; data: CreatorFeesAccumulatedEvent }
  | { type: 'CreatorFeesClaimed'; data: CreatorFeesClaimedEvent };

/**
 * Indexed event filter
 */
export interface EventFilter {
  address?: string;
  topics?: (string | string[] | null)[];
  fromBlock?: number;
  toBlock?: number | 'latest';
}
