/**
 * Utility functions for ATH (All-Time High) calculations
 */

/**
 * Calculate a simulated ATH market cap for display purposes
 * In a real implementation, this would come from historical data
 * 
 * @param currentMarketCap - Current market cap of the token
 * @param tokenAddress - Token address for consistent simulation
 * @returns Simulated ATH market cap
 */
export function getSimulatedATH(currentMarketCap: number, tokenAddress: string): number {
  // Use token address to create a consistent "random" multiplier
  const addressHash = tokenAddress.slice(2, 10); // Take 8 chars after 0x
  const hashNumber = parseInt(addressHash, 16);
  // Create a multiplier between 1.2x and 5x based on address hash
  const multiplier = 1.2 + (hashNumber % 1000) / 1000 * 3.8; // 1.2 to 5.0
  return currentMarketCap * multiplier;
}

/**
 * Calculate progress percentage towards ATH
 * 
 * @param currentMarketCap - Current market cap
 * @param athMarketCap - All-time high market cap
 * @returns Progress percentage (0-100)
 */
export function getATHProgress(currentMarketCap: number, athMarketCap: number): number {
  if (athMarketCap <= 0) return 100;
  return Math.min((currentMarketCap / athMarketCap) * 100, 100);
}

/**
 * Format ATH progress for display
 * 
 * @param currentMarketCap - Current market cap
 * @param athMarketCap - All-time high market cap
 * @returns Formatted progress string
 */
export function formatATHProgress(currentMarketCap: number, athMarketCap: number): string {
  const progress = getATHProgress(currentMarketCap, athMarketCap);
  return `${progress.toFixed(0)}%`;
}
