/**
 * Utility functions for candlestick chart calculations
 */

/**
 * Determines the color for a candlestick based on price movement
 * Following standard financial charting conventions:
 * - Green (bullish): close > open (price increased)
 * - Red (bearish): close <= open (price decreased or unchanged)
 * 
 * @param open - Opening price for the time interval
 * @param close - Closing price for the time interval
 * @returns Color string for volume bars
 */
export function getCandleVolumeColor(open: number, close: number): string {
  const isUp = close > open;
  return isUp ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
}

/**
 * Determines if a candle is bullish (price increased)
 * 
 * @param open - Opening price for the time interval
 * @param close - Closing price for the time interval
 * @returns true if bullish (close > open), false otherwise
 */
export function isBullishCandle(open: number, close: number): boolean {
  return close > open;
}
