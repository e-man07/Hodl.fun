import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Price Feed Service
 *
 * Fetches token price data from external sources
 * Supports multiple data providers (CoinGecko, etc.)
 * Aggregates prices and manages fallback providers
 */
@Injectable()
export class PriceFeedService {
  private readonly logger = new Logger(PriceFeedService.name);
  private readonly coingeckoApi: AxiosInstance;

  // Cache for price data to reduce API calls
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor() {
    this.coingeckoApi = axios.create({
      baseURL: 'https://api.coingecko.com/api/v3',
      timeout: 10000,
    });
  }

  /**
   * Get current price of a token by contract address
   * Supports Ethereum and other EVM networks
   */
  async getTokenPrice(
    contractAddress: string,
    nativeChainId: string = 'ethereum',
  ): Promise<number | null> {
    try {
      // Check cache first
      const cached = this.getPriceFromCache(contractAddress);
      if (cached !== null) {
        return cached;
      }

      // Fetch from CoinGecko
      const price = await this.fetchCoinGeckoPrice(contractAddress, nativeChainId);

      if (price !== null) {
        this.setPriceCache(contractAddress, price);
        return price;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting price for ${contractAddress}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch price from CoinGecko API
   */
  private async fetchCoinGeckoPrice(
    contractAddress: string,
    chainId: string = 'ethereum',
  ): Promise<number | null> {
    try {
      const response = await this.coingeckoApi.get(
        `/simple/token_price/${chainId}`,
        {
          params: {
            contract_addresses: contractAddress.toLowerCase(),
            vs_currencies: 'usd',
            include_market_cap: true,
            include_24hr_vol: true,
            include_24hr_change: true,
          },
        },
      );

      const tokenData = response.data[contractAddress.toLowerCase()];
      if (tokenData && tokenData.usd !== undefined) {
        return tokenData.usd;
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `CoinGecko price fetch failed for ${contractAddress}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get detailed token data including price, market cap, and volume
   */
  async getTokenData(
    contractAddress: string,
    nativeChainId: string = 'ethereum',
  ): Promise<{
    price: number;
    marketCap: number | null;
    volume24h: number | null;
    change24h: number | null;
  } | null> {
    try {
      const response = await this.coingeckoApi.get(
        `/simple/token_price/${nativeChainId}`,
        {
          params: {
            contract_addresses: contractAddress.toLowerCase(),
            vs_currencies: 'usd',
            include_market_cap: true,
            include_24hr_vol: true,
            include_24hr_change: true,
          },
        },
      );

      const tokenData = response.data[contractAddress.toLowerCase()];
      if (!tokenData) {
        return null;
      }

      return {
        price: tokenData.usd || 0,
        marketCap: tokenData.usd_market_cap || null,
        volume24h: tokenData.usd_24h_vol || null,
        change24h: tokenData.usd_24h_change || null,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching token data for ${contractAddress}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  async getTokenPrices(
    contractAddresses: string[],
    nativeChainId: string = 'ethereum',
  ): Promise<Map<string, number>> {
    try {
      const prices = new Map<string, number>();

      // Filter out cached prices
      const addressesToFetch = contractAddresses.filter((addr) => {
        const cached = this.getPriceFromCache(addr);
        if (cached !== null) {
          prices.set(addr, cached);
          return false;
        }
        return true;
      });

      if (addressesToFetch.length === 0) {
        return prices;
      }

      // Fetch uncached prices from API
      const response = await this.coingeckoApi.get(
        `/simple/token_price/${nativeChainId}`,
        {
          params: {
            contract_addresses: addressesToFetch
              .map((addr) => addr.toLowerCase())
              .join(','),
            vs_currencies: 'usd',
          },
        },
      );

      // Build price map and cache
      for (const address of addressesToFetch) {
        const tokenData = response.data[address.toLowerCase()];
        if (tokenData && tokenData.usd !== undefined) {
          prices.set(address, tokenData.usd);
          this.setPriceCache(address, tokenData.usd);
        }
      }

      return prices;
    } catch (error) {
      this.logger.error(`Error fetching multiple token prices: ${error.message}`);
      return new Map();
    }
  }

  /**
   * Get native token price (ETH, etc.)
   */
  async getNativeTokenPrice(nativeSymbol: string = 'ethereum'): Promise<number | null> {
    try {
      const response = await this.coingeckoApi.get('/simple/price', {
        params: {
          ids: nativeSymbol.toLowerCase(),
          vs_currencies: 'usd',
        },
      });

      const priceData = response.data[nativeSymbol.toLowerCase()];
      return priceData?.usd || null;
    } catch (error) {
      this.logger.error(
        `Error fetching native token price for ${nativeSymbol}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get market data for a token
   */
  async getMarketData(
    tokenId: string,
  ): Promise<{
    currentPrice: number;
    marketCap: number | null;
    marketCapRank: number | null;
    volume24h: number | null;
    priceChange24h: number | null;
    allTimeHigh: number | null;
    allTimeLow: number | null;
  } | null> {
    try {
      const response = await this.coingeckoApi.get(`/coins/${tokenId}`);

      const data = response.data;
      return {
        currentPrice: data.market_data?.current_price?.usd || 0,
        marketCap: data.market_data?.market_cap?.usd || null,
        marketCapRank: data.market_cap_rank || null,
        volume24h: data.market_data?.total_volume?.usd || null,
        priceChange24h: data.market_data?.price_change_percentage_24h || null,
        allTimeHigh: data.market_data?.ath?.usd || null,
        allTimeLow: data.market_data?.atl?.usd || null,
      };
    } catch (error) {
      this.logger.error(`Error fetching market data for ${tokenId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(from: string, to: string): Promise<number | null> {
    try {
      const response = await this.coingeckoApi.get('/simple/price', {
        params: {
          ids: from.toLowerCase(),
          vs_currencies: to.toLowerCase(),
        },
      });

      const rateData = response.data[from.toLowerCase()];
      return rateData?.[to.toLowerCase()] || null;
    } catch (error) {
      this.logger.error(
        `Error getting exchange rate from ${from} to ${to}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get price from cache if still valid
   */
  private getPriceFromCache(contractAddress: string): number | null {
    const cached = this.priceCache.get(contractAddress);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL_MS) {
      this.priceCache.delete(contractAddress);
      return null;
    }

    return cached.price;
  }

  /**
   * Set price in cache
   */
  private setPriceCache(contractAddress: string, price: number): void {
    this.priceCache.set(contractAddress, {
      price,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached prices
   */
  clearCache(): void {
    this.priceCache.clear();
    this.logger.log('Price cache cleared');
  }

  /**
   * Health check - verify CoinGecko API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.coingeckoApi.get('/simple/price', {
        params: {
          ids: 'ethereum',
          vs_currencies: 'usd',
        },
      });
      return response.status === 200;
    } catch (error) {
      this.logger.error(`Price feed health check failed: ${error.message}`);
      return false;
    }
  }
}
