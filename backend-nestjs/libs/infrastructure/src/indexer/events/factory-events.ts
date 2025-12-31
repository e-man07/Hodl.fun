import { id } from 'ethers';

/**
 * BondingCurveFactory Contract Event Definitions
 * Event signatures and topic hashes from IBondingCurveFactory.sol
 */

// Event signatures
export const FACTORY_EVENT_SIGNATURES = {
  CreatorFeesAccumulated:
    'CreatorFeesAccumulated(address,uint256,uint256)',
  CreatorFeesClaimed: 'CreatorFeesClaimed(address,uint256)',
} as const;

// Event topic hashes (keccak256 of signature)
export const FACTORY_EVENT_TOPICS = {
  CreatorFeesAccumulated: id(FACTORY_EVENT_SIGNATURES.CreatorFeesAccumulated),
  CreatorFeesClaimed: id(FACTORY_EVENT_SIGNATURES.CreatorFeesClaimed),
} as const;

/**
 * CreatorFeesAccumulated event structure
 * event CreatorFeesAccumulated(
 *   address indexed creator,
 *   uint256 amount,
 *   uint256 totalAccumulated
 * )
 */
export interface CreatorFeesAccumulatedEventArgs {
  creator: string;
  amount: bigint;
  totalAccumulated: bigint;
}

/**
 * CreatorFeesClaimed event structure
 * event CreatorFeesClaimed(
 *   address indexed creator,
 *   uint256 amount
 * )
 */
export interface CreatorFeesClaimedEventArgs {
  creator: string;
  amount: bigint;
}

// ABI fragments for decoding
export const FACTORY_EVENT_ABI = [
  {
    type: 'event',
    name: 'CreatorFeesAccumulated',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'totalAccumulated', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CreatorFeesClaimed',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
];
