import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with appropriate suffix (K, M, B)
 */
export function formatNumber(num: number, decimals = 2): string {
  if (num === 0) return '0';
  if (Math.abs(num) >= 1e9) {
    return (num / 1e9).toFixed(decimals) + 'B';
  }
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(decimals) + 'M';
  }
  if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(decimals) + 'K';
  }
  if (Math.abs(num) < 0.01 && num !== 0) {
    return num.toExponential(2);
  }
  return num.toFixed(decimals);
}

/**
 * Format currency with symbol
 */
export function formatCurrency(
  amount: number,
  currency: 'PUSH' | 'USD' = 'PUSH',
  decimals = 2
): string {
  if (currency === 'USD') {
    return `$${formatNumber(amount, decimals)}`;
  }
  return `${formatNumber(amount, decimals)} PUSH`;
}

/**
 * Format percentage with sign
 */
export function formatPercentage(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(
  address: string,
  startLength = 6,
  endLength = 4
): string {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

// Cached date formatter for performance (js-cache-function-results rule)
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

/**
 * Format date using Intl.DateTimeFormat for consistent, performant formatting
 */
export function formatDate(timestamp: string | Date): string {
  const date = new Date(timestamp);
  return dateFormatter.format(date);
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(date);
}

/**
 * Format wei to human readable
 */
export function formatFromWei(weiString: string, decimals = 18): number {
  const wei = BigInt(weiString);
  const divisor = BigInt(10 ** decimals);
  const wholePart = wei / divisor;
  const fractionalPart = wei % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  return parseFloat(`${wholePart}.${fractionalStr}`);
}

/**
 * Parse human readable to wei string
 */
export function parseToWei(amount: number | string, decimals = 18): string {
  const amountStr = amount.toString();
  const [whole, fraction = ''] = amountStr.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction).toString();
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert IPFS URI to gateway URL
 */
export function getIPFSUrl(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
    return `${gateway}${uri.replace('ipfs://', '')}`;
  }
  return uri;
}

/**
 * Calculate slippage-adjusted amount
 */
export function applySlippage(amount: bigint, slippageBps: number, isBuy: boolean): bigint {
  // For buy: minimum amount out = amount * (10000 - slippage) / 10000
  // For sell: maximum amount in = amount * (10000 + slippage) / 10000
  const bps = BigInt(10000);
  const slippage = BigInt(slippageBps);

  if (isBuy) {
    return (amount * (bps - slippage)) / bps;
  }
  return (amount * (bps + slippage)) / bps;
}

/**
 * Get deadline timestamp (current time + minutes)
 */
export function getDeadline(minutes = 20): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}
