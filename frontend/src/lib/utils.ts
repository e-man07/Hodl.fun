import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatNumber = (num: number, decimals: number = 2): string => {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(decimals) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(decimals) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(decimals) + 'K';
  }
  return num.toFixed(decimals);
};

export const formatCurrency = (amount: number, currency: string = 'ETH', ethPrice?: number | null): string => {
  // If currency is USD and ethPrice is provided, convert from ETH to USD
  if (currency === 'USD' && ethPrice) {
    const usdAmount = amount * ethPrice;
    return `$${formatNumber(usdAmount)}`;
  }
  return `${formatNumber(amount)} ${currency}`;
};

/**
 * Format market cap in USD (converts from ETH)
 */
export const formatMarketCapUSD = (ethAmount: number, ethPrice: number | null | undefined): string => {
  if (!ethPrice) {
    // Fallback to ETH if price not available
    return formatCurrency(ethAmount, 'ETH');
  }
  const usdAmount = ethAmount * ethPrice;
  return `$${formatNumber(usdAmount)}`;
};

export const truncateAddress = (address: string, startLength: number = 6, endLength: number = 4): string => {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
};
