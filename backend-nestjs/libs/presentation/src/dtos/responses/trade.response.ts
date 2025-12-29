/**
 * Trade Response DTO
 *
 * Structure returned for trade data
 */
export class TradeResponseDto {
  id!: string;
  tokenId!: string;
  type!: 'buy' | 'sell';
  user!: string;
  amountIn!: string;
  amountOut!: string;
  pricePerToken!: string;
  totalValue!: string;
  transactionHash!: string;
  blockNumber!: number;
  timestamp!: Date;
}

/**
 * Paginated Trade List Response
 */
export class TradeListResponseDto {
  items!: TradeResponseDto[];
  total!: number;
  limit!: number;
  offset!: number;
  hasMore!: boolean;
}

/**
 * Trade Statistics Response
 */
export class TradeStatsResponseDto {
  tokenId?: string;
  user?: string;
  totalTrades!: number;
  totalBuyVolume!: string;
  totalSellVolume!: string;
  totalTokensBought?: string;
  totalTokensSold?: string;
  uniqueTraders?: number;
  avgBuyPrice?: string;
  avgSellPrice?: string;
  realizedPNL?: string;
}

/**
 * Trade Execution Response (after placing a trade)
 */
export class TradeExecutionResponseDto {
  success!: boolean;
  transactionHash!: string;
  amountIn!: string;
  amountOut!: string;
  pricePerToken!: string;
  timestamp!: Date;
  message?: string;
}
