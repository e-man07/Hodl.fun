import { id } from 'ethers';

/**
 * Core Contract Event Definitions
 * Event signatures and topic hashes from ICore.sol
 */

// Event signatures
export const CORE_EVENT_SIGNATURES = {
  CreateCurve:
    'CreateCurve(address,address,address,string,string,string)',
  Buy: 'Buy(address,address,uint256,uint256,uint256,uint256)',
  Sell: 'Sell(address,address,address,uint256,uint256,uint256,uint256)',
} as const;

// Event topic hashes (keccak256 of signature)
export const CORE_EVENT_TOPICS = {
  CreateCurve: id(CORE_EVENT_SIGNATURES.CreateCurve),
  Buy: id(CORE_EVENT_SIGNATURES.Buy),
  Sell: id(CORE_EVENT_SIGNATURES.Sell),
} as const;

/**
 * CreateCurve event structure
 * event CreateCurve(
 *   address indexed creator,
 *   address indexed curve,
 *   address indexed token,
 *   string tokenURI,
 *   string name,
 *   string symbol
 * )
 */
export interface CreateCurveEventArgs {
  creator: string;
  curve: string;
  token: string;
  tokenURI: string;
  name: string;
  symbol: string;
}

/**
 * Buy event structure
 * event Buy(
 *   address indexed token,
 *   address indexed to,
 *   uint256 amountIn,
 *   uint256 amountOut,
 *   uint256 price,
 *   uint256 timestamp
 * )
 */
export interface BuyEventArgs {
  token: string;
  to: string;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
  timestamp: bigint;
}

/**
 * Sell event structure
 * event Sell(
 *   address indexed token,
 *   address indexed from,
 *   address indexed to,
 *   uint256 amountIn,
 *   uint256 amountOut,
 *   uint256 price,
 *   uint256 timestamp
 * )
 */
export interface SellEventArgs {
  token: string;
  from: string;
  to: string;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
  timestamp: bigint;
}

// ABI fragments for decoding
export const CORE_EVENT_ABI = [
  {
    type: 'event',
    name: 'CreateCurve',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'curve', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'tokenURI', type: 'string', indexed: false },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Buy',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Sell',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
];
