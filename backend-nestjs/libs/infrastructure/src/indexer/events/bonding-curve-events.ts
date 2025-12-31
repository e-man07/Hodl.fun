import { id } from 'ethers';

/**
 * BondingCurve Contract Event Definitions
 * Event signatures and topic hashes from IBondingCurve.sol
 */

// Event signatures
export const BONDING_CURVE_EVENT_SIGNATURES = {
  Lock: 'Lock(address)',
  Listing: 'Listing(address,address,address,uint256,uint256,uint256)',
  NewATHPrice: 'NewATHPrice(address,uint256,uint256)',
  NewATHMarketCap: 'NewATHMarketCap(address,uint256,uint256)',
  Sync: 'Sync(address,uint256,uint256,uint256,uint256,uint256,uint256)',
  CreatorFeeDistributed: 'CreatorFeeDistributed(address,address,uint256)',
  CreatorFeeDeferredFromBuy: 'CreatorFeeDeferredFromBuy(address,uint256,uint256)',
} as const;

// Event topic hashes (keccak256 of signature)
export const BONDING_CURVE_EVENT_TOPICS = {
  Lock: id(BONDING_CURVE_EVENT_SIGNATURES.Lock),
  Listing: id(BONDING_CURVE_EVENT_SIGNATURES.Listing),
  NewATHPrice: id(BONDING_CURVE_EVENT_SIGNATURES.NewATHPrice),
  NewATHMarketCap: id(BONDING_CURVE_EVENT_SIGNATURES.NewATHMarketCap),
  Sync: id(BONDING_CURVE_EVENT_SIGNATURES.Sync),
  CreatorFeeDistributed: id(BONDING_CURVE_EVENT_SIGNATURES.CreatorFeeDistributed),
  CreatorFeeDeferredFromBuy: id(
    BONDING_CURVE_EVENT_SIGNATURES.CreatorFeeDeferredFromBuy,
  ),
} as const;

/**
 * Lock event structure
 * event Lock(address indexed token)
 */
export interface LockEventArgs {
  token: string;
}

/**
 * Listing event structure (graduation to DEX)
 * event Listing(
 *   address indexed curve,
 *   address indexed token,
 *   address indexed pool,
 *   uint256 amount0,
 *   uint256 amount1,
 *   uint256 liquidity
 * )
 */
export interface ListingEventArgs {
  curve: string;
  token: string;
  pool: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
}

/**
 * NewATHPrice event structure
 * event NewATHPrice(address indexed token, uint256 newPrice, uint256 timestamp)
 */
export interface NewATHPriceEventArgs {
  token: string;
  newPrice: bigint;
  timestamp: bigint;
}

/**
 * NewATHMarketCap event structure
 * event NewATHMarketCap(address indexed token, uint256 newMarketCap, uint256 timestamp)
 */
export interface NewATHMarketCapEventArgs {
  token: string;
  newMarketCap: bigint;
  timestamp: bigint;
}

/**
 * Sync event structure
 * event Sync(
 *   address indexed token,
 *   uint256 realNative,
 *   uint256 realToken,
 *   uint256 virtualNative,
 *   uint256 virtualToken,
 *   uint256 price,
 *   uint256 timestamp
 * )
 */
export interface SyncEventArgs {
  token: string;
  realNative: bigint;
  realToken: bigint;
  virtualNative: bigint;
  virtualToken: bigint;
  price: bigint;
  timestamp: bigint;
}

// ABI fragments for decoding
export const BONDING_CURVE_EVENT_ABI = [
  {
    type: 'event',
    name: 'Lock',
    inputs: [{ name: 'token', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'Listing',
    inputs: [
      { name: 'curve', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'pool', type: 'address', indexed: true },
      { name: 'amount0', type: 'uint256', indexed: false },
      { name: 'amount1', type: 'uint256', indexed: false },
      { name: 'liquidity', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NewATHPrice',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'newPrice', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NewATHMarketCap',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'newMarketCap', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Sync',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'realNative', type: 'uint256', indexed: false },
      { name: 'realToken', type: 'uint256', indexed: false },
      { name: 'virtualNative', type: 'uint256', indexed: false },
      { name: 'virtualToken', type: 'uint256', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CreatorFeeDistributed',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CreatorFeeDeferredFromBuy',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'feeTokenAmount', type: 'uint256', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
    ],
  },
];
