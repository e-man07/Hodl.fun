/**
 * Transaction Data Response DTO
 *
 * Response for transaction build endpoints
 * Contains calldata for frontend wallet signing
 */
export interface TransactionDataResponseDto {
  /** Target contract address */
  to: string;
  /** Encoded function calldata */
  data: string;
  /** Value to send in wei (as string for BigInt precision) */
  value: string;
  /** Gas estimate (optional) */
  gasEstimate?: string;
}

/**
 * Quote Response DTO
 *
 * Response for quote endpoints
 */
export interface QuoteResponseDto {
  /** Input amount (in wei/tokens) */
  amountIn: string;
  /** Output amount (in tokens/wei) */
  amountOut: string;
  /** Price impact in basis points (1 bp = 0.01%) */
  priceImpact: string;
  /** Fee amount */
  fee: string;
  /** Current token price before trade */
  spotPrice?: string;
  /** Effective price after trade */
  executionPrice?: string;
}

/**
 * Approve Transaction Response DTO
 *
 * Response for ERC20 approval transaction
 */
export interface ApproveTransactionResponseDto {
  /** Token contract address */
  to: string;
  /** Encoded approve calldata */
  data: string;
  /** Value (always 0 for approvals) */
  value: string;
}
