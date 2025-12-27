import { useState, useEffect } from 'react';

/**
 * Hook to fetch ETH/USD price from CoinGecko API
 * Uses free tier API with caching to avoid rate limits
 */
export const useEthPrice = () => {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check cache first (5 minute cache)
        const cacheKey = 'eth_price_cache';
        const cacheTime = 5 * 60 * 1000; // 5 minutes
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
          const { price, timestamp } = JSON.parse(cached);
          const now = Date.now();
          if (now - timestamp < cacheTime) {
            setEthPrice(price);
            setIsLoading(false);
            return;
          }
        }

        // Fetch from CoinGecko (free tier, no API key needed)
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch ETH price: ${response.statusText}`);
        }

        const data = await response.json();
        const price = data.ethereum?.usd;

        if (!price || typeof price !== 'number') {
          throw new Error('Invalid price data received');
        }

        setEthPrice(price);

        // Cache the price
        localStorage.setItem(cacheKey, JSON.stringify({
          price,
          timestamp: Date.now(),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch ETH price');
        
        // Try to use cached price even if expired
        const cacheKey = 'eth_price_cache';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { price } = JSON.parse(cached);
          setEthPrice(price);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEthPrice();

    // Refresh price every 5 minutes
    const interval = setInterval(fetchEthPrice, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { ethPrice, isLoading, error };
};

