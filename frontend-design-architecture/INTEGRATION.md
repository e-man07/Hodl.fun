# API & Web3 Integration

## 10. API Integration Layer

### 10.1 API Client Configuration

```typescript
// src/lib/api/client.ts
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const REQUEST_TIMEOUT = 30000;

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response.data,
      async (error: AxiosError<ApiErrorResponse>) => {
        const originalRequest = error.config;

        // Handle 401 - try refresh token
        if (error.response?.status === 401 && !originalRequest?._retry) {
          originalRequest._retry = true;
          try {
            await this.refreshToken();
            return this.client(originalRequest);
          } catch {
            this.clearAuth();
            window.location.href = '/';
          }
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 5;
          throw new RateLimitError(`Rate limited. Retry after ${retryAfter}s`);
        }

        throw new ApiError(
          error.response?.data?.error?.message || 'Network error',
          error.response?.status || 500
        );
      }
    );
  }

  setAccessToken(token: string) {
    this.accessToken = token;
    localStorage.setItem('accessToken', token);
  }

  clearAuth() {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  private async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });

    this.setAccessToken(response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
  }

  // HTTP methods
  get<T>(url: string, params?: object): Promise<ApiResponse<T>> {
    return this.client.get(url, { params });
  }

  post<T>(url: string, data?: object): Promise<ApiResponse<T>> {
    return this.client.post(url, data);
  }

  put<T>(url: string, data?: object): Promise<ApiResponse<T>> {
    return this.client.put(url, data);
  }

  delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.client.delete(url);
  }
}

export const apiClient = new ApiClient();
```

### 10.2 API Endpoints

```typescript
// src/lib/api/tokens.ts
import { apiClient } from './client';
import type { Token, Trade, Holder, PriceHistory, PaginatedResponse } from '@/types';

export const tokensApi = {
  // Get paginated token list
  getTokens: (params: {
    page?: number;
    limit?: number;
    status?: 'TRADING' | 'LOCKED' | 'LISTED';
    sortBy?: 'createdAt' | 'marketCap' | 'currentPrice' | 'volume24h';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Token>> => {
    return apiClient.get('/tokens', params);
  },

  // Get trending tokens (cached 30s on backend)
  getTrending: (): Promise<Token[]> => {
    return apiClient.get('/tokens/trending');
  },

  // Get newly created tokens
  getNew: (params: { limit?: number }): Promise<Token[]> => {
    return apiClient.get('/tokens/new', params);
  },

  // Get single token details
  getToken: (address: string): Promise<Token> => {
    return apiClient.get(`/tokens/${address}`);
  },

  // Get price history (OHLC candles)
  getPriceHistory: (
    address: string,
    interval: 'ONE_MINUTE' | 'FIVE_MINUTES' | 'FIFTEEN_MINUTES' | 'ONE_HOUR' | 'FOUR_HOURS' | 'ONE_DAY'
  ): Promise<PriceHistory[]> => {
    return apiClient.get(`/tokens/${address}/price-history`, { interval });
  },

  // Get token trades
  getTrades: (
    address: string,
    params: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Trade>> => {
    return apiClient.get(`/tokens/${address}/trades`, params);
  },

  // Get token holders
  getHolders: (
    address: string,
    params: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Holder>> => {
    return apiClient.get(`/tokens/${address}/holders`, params);
  },
};

// src/lib/api/users.ts
export const usersApi = {
  // Get user profile
  getProfile: (address: string): Promise<UserProfile> => {
    return apiClient.get(`/users/${address}`);
  },

  // Update user profile (requires signature)
  updateProfile: (
    address: string,
    data: UpdateProfileRequest
  ): Promise<UserProfile> => {
    return apiClient.put(`/users/${address}/profile`, data);
  },

  // Get user holdings
  getHoldings: (
    address: string,
    params: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Holding>> => {
    return apiClient.get(`/users/${address}/holdings`, params);
  },

  // Get user trade history
  getTrades: (
    address: string,
    params: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Trade>> => {
    return apiClient.get(`/users/${address}/trades`, params);
  },

  // Get tokens created by user
  getCreatedTokens: (
    address: string,
    params: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Token>> => {
    return apiClient.get(`/users/${address}/created-tokens`, params);
  },

  // Get user's accumulated creator fees
  getCreatorFees: (address: string): Promise<CreatorFeeResponse> => {
    return apiClient.get(`/users/${address}/creator-fees`);
  },
};

// src/lib/api/auth.ts
export const authApi = {
  // Get nonce for wallet signature
  getNonce: (wallet: string): Promise<{ nonce: string }> => {
    return apiClient.post('/auth/nonce', { wallet });
  },

  // Verify signature and get tokens
  verify: (wallet: string, signature: string): Promise<AuthResponse> => {
    return apiClient.post('/auth/verify', { wallet, signature });
  },

  // Refresh access token
  refresh: (refreshToken: string): Promise<AuthResponse> => {
    return apiClient.post('/auth/refresh', { refreshToken });
  },
};
```

### 10.3 React Query Hooks

```typescript
// src/hooks/useTokenData.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { tokensApi } from '@/lib/api/tokens';
import { queryKeys } from '@/lib/cache/queryClient';

export function useTokens(filters: TokenFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.tokens.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      tokensApi.getTokens({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useTrendingTokens() {
  return useQuery({
    queryKey: queryKeys.tokens.trending(),
    queryFn: tokensApi.getTrending,
    staleTime: 30 * 1000, // Cached 30s on backend too
    refetchInterval: 30 * 1000, // Refetch every 30s
  });
}

export function useToken(address: string | null) {
  return useQuery({
    queryKey: queryKeys.tokens.detail(address!),
    queryFn: () => tokensApi.getToken(address!),
    enabled: !!address,
    staleTime: 10 * 1000, // 10 seconds
  });
}

export function usePriceHistory(address: string, interval: PriceInterval) {
  return useQuery({
    queryKey: queryKeys.tokens.priceHistory(address, interval),
    queryFn: () => tokensApi.getPriceHistory(address, interval),
    staleTime: 5 * 1000, // 5 seconds (real-time updates via WebSocket)
    refetchInterval: false, // WebSocket handles updates
  });
}

export function useTokenTrades(address: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.tokens.trades(address),
    queryFn: ({ pageParam = 1 }) =>
      tokensApi.getTrades(address, { page: pageParam, limit: 50 }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
    staleTime: 0, // Always fetch fresh (WebSocket supplements)
  });
}

export function useTokenHolders(address: string) {
  return useQuery({
    queryKey: queryKeys.tokens.holders(address),
    queryFn: () => tokensApi.getHolders(address, { limit: 100 }),
    staleTime: 60 * 1000, // 1 minute
  });
}
```

---

## 11. Web3 Integration

### 11.1 Contract Configuration

```typescript
// src/config/contracts.ts
export const CHAIN_CONFIG = {
  id: 42101,
  name: 'Push Chain Testnet',
  network: 'push-testnet',
  nativeCurrency: {
    name: 'PUSH',
    symbol: 'PUSH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://evm.rpc-testnet-donut-node1.push.org/'] },
    public: { http: ['https://evm.rpc-testnet-donut-node1.push.org/'] },
  },
  blockExplorers: {
    default: { name: 'Push Explorer', url: 'https://donut.push.network/' },
  },
};

export const CONTRACT_ADDRESSES = {
  Core: '0x592F8f0abbB9a3d3c425980Ac0263363C8405b03',
  Factory: '0x3c2e258d3cf31653a17b27d5c4f1789d25d14ea8',
  FeeVault: '0xbe2fd9b720d1d7fac7208523376d2a3332019928',
  WPUSH: '0x2137c11bdb56c8a74be8cc0fbad23ccf5cb9a8a7',
} as const;
```

### 11.2 Contract Hooks

```typescript
// src/hooks/useContracts.ts
import { ethers, Contract, BrowserProvider, Signer } from 'ethers';
import { usePushWallet } from '@pushchain/ui-kit';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG } from '@/config/contracts';
import { CoreABI, FactoryABI, TokenABI, WPUSHABI } from '@/config/abis';

export function useContracts() {
  const { pushChainClient, connectionStatus } = usePushWallet();

  const getProvider = (): BrowserProvider | null => {
    if (connectionStatus !== 'CONNECTED' || !pushChainClient) return null;
    return new BrowserProvider(pushChainClient.universal.provider);
  };

  const getSigner = async (): Promise<Signer | null> => {
    const provider = getProvider();
    if (!provider) return null;
    return provider.getSigner();
  };

  const getCoreContract = async (withSigner = false): Promise<Contract | null> => {
    const provider = getProvider();
    if (!provider) return null;

    const signerOrProvider = withSigner ? await getSigner() : provider;
    return new Contract(CONTRACT_ADDRESSES.Core, CoreABI, signerOrProvider);
  };

  const getFactoryContract = async (withSigner = false): Promise<Contract | null> => {
    const provider = getProvider();
    if (!provider) return null;

    const signerOrProvider = withSigner ? await getSigner() : provider;
    return new Contract(CONTRACT_ADDRESSES.Factory, FactoryABI, signerOrProvider);
  };

  const getTokenContract = async (
    tokenAddress: string,
    withSigner = false
  ): Promise<Contract | null> => {
    const provider = getProvider();
    if (!provider) return null;

    const signerOrProvider = withSigner ? await getSigner() : provider;
    return new Contract(tokenAddress, TokenABI, signerOrProvider);
  };

  const getWPUSHContract = async (withSigner = false): Promise<Contract | null> => {
    const provider = getProvider();
    if (!provider) return null;

    const signerOrProvider = withSigner ? await getSigner() : provider;
    return new Contract(CONTRACT_ADDRESSES.WPUSH, WPUSHABI, signerOrProvider);
  };

  return {
    getProvider,
    getSigner,
    getCoreContract,
    getFactoryContract,
    getTokenContract,
    getWPUSHContract,
    isConnected: connectionStatus === 'CONNECTED',
  };
}
```

### 11.3 Trading Hook

```typescript
// src/hooks/useTrading.ts
import { useState, useCallback } from 'react';
import { ethers, parseEther, formatEther } from 'ethers';
import { useContracts } from './useContracts';
import { usePushWallet } from '@pushchain/ui-kit';
import { useTradeStore } from '@/stores/tradeStore';
import { CONTRACT_ADDRESSES } from '@/config/contracts';

export function useTrading() {
  const { getCoreContract, getTokenContract, getWPUSHContract, getSigner } = useContracts();
  const { pushChainClient } = usePushWallet();
  const { addPendingTx, updateTxStatus } = useTradeStore();
  const [loading, setLoading] = useState(false);

  // Calculate expected tokens for PUSH amount
  const calculateBuyOutput = useCallback(
    async (tokenAddress: string, pushAmount: string): Promise<string> => {
      const core = await getCoreContract();
      if (!core || !pushAmount || parseFloat(pushAmount) <= 0) return '0';

      try {
        const amountIn = parseEther(pushAmount);
        // Use view function to calculate expected output
        const amountOut = await core.calculateBuyOutput(tokenAddress, amountIn);
        return formatEther(amountOut);
      } catch (error) {
        console.error('Error calculating buy output:', error);
        return '0';
      }
    },
    [getCoreContract]
  );

  // Calculate expected PUSH for token amount
  const calculateSellOutput = useCallback(
    async (tokenAddress: string, tokenAmount: string): Promise<string> => {
      const core = await getCoreContract();
      if (!core || !tokenAmount || parseFloat(tokenAmount) <= 0) return '0';

      try {
        const amountIn = parseEther(tokenAmount);
        const amountOut = await core.calculateSellOutput(tokenAddress, amountIn);
        return formatEther(amountOut);
      } catch (error) {
        console.error('Error calculating sell output:', error);
        return '0';
      }
    },
    [getCoreContract]
  );

  // Buy tokens with PUSH
  const buyTokens = useCallback(
    async (
      tokenAddress: string,
      pushAmount: string,
      minTokensOut: string,
      slippagePercent: number = 2
    ): Promise<string> => {
      setLoading(true);

      try {
        const core = await getCoreContract(true);
        const signer = await getSigner();
        if (!core || !signer) throw new Error('Not connected');

        const userAddress = await signer.getAddress();
        const amountIn = parseEther(pushAmount);

        // Apply slippage to minimum output
        const minOut = parseEther(minTokensOut);
        const slippageMultiplier = BigInt(10000 - slippagePercent * 100);
        const amountOutMin = (minOut * slippageMultiplier) / BigInt(10000);

        // Deadline: 5 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 300;

        // Execute buy
        const tx = await core.exactInBuy(
          amountIn,
          amountOutMin,
          tokenAddress,
          userAddress,
          deadline,
          { value: amountIn } // Send native PUSH
        );

        // Add to pending transactions
        addPendingTx(tx.hash, {
          type: 'buy',
          tokenAddress,
          amountIn: pushAmount,
          status: 'pending',
          timestamp: Date.now(),
        });

        // Wait for confirmation
        const receipt = await tx.wait();
        updateTxStatus(tx.hash, receipt.status === 1 ? 'confirmed' : 'failed');

        return tx.hash;
      } catch (error: any) {
        console.error('Buy error:', error);
        throw new TradingError(parseContractError(error));
      } finally {
        setLoading(false);
      }
    },
    [getCoreContract, getSigner, addPendingTx, updateTxStatus]
  );

  // Sell tokens for PUSH
  const sellTokens = useCallback(
    async (
      tokenAddress: string,
      tokenAmount: string,
      minPushOut: string,
      slippagePercent: number = 2
    ): Promise<string> => {
      setLoading(true);

      try {
        const core = await getCoreContract(true);
        const token = await getTokenContract(tokenAddress, true);
        const signer = await getSigner();
        if (!core || !token || !signer) throw new Error('Not connected');

        const userAddress = await signer.getAddress();
        const amountIn = parseEther(tokenAmount);

        // Check and request approval if needed
        const allowance = await token.allowance(userAddress, CONTRACT_ADDRESSES.Core);
        if (allowance < amountIn) {
          const approveTx = await token.approve(CONTRACT_ADDRESSES.Core, ethers.MaxUint256);
          await approveTx.wait();
        }

        // Apply slippage to minimum output
        const minOut = parseEther(minPushOut);
        const slippageMultiplier = BigInt(10000 - slippagePercent * 100);
        const amountOutMin = (minOut * slippageMultiplier) / BigInt(10000);

        // Deadline: 5 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 300;

        // Execute sell
        const tx = await core.exactInSell(
          amountIn,
          amountOutMin,
          tokenAddress,
          userAddress,
          userAddress,
          deadline
        );

        addPendingTx(tx.hash, {
          type: 'sell',
          tokenAddress,
          amountIn: tokenAmount,
          status: 'pending',
          timestamp: Date.now(),
        });

        const receipt = await tx.wait();
        updateTxStatus(tx.hash, receipt.status === 1 ? 'confirmed' : 'failed');

        return tx.hash;
      } catch (error: any) {
        console.error('Sell error:', error);
        throw new TradingError(parseContractError(error));
      } finally {
        setLoading(false);
      }
    },
    [getCoreContract, getTokenContract, getSigner, addPendingTx, updateTxStatus]
  );

  return {
    calculateBuyOutput,
    calculateSellOutput,
    buyTokens,
    sellTokens,
    loading,
  };
}

// Error parsing helper
function parseContractError(error: any): string {
  const message = error.message || '';

  if (message.includes('Expired')) return 'Transaction expired. Please try again.';
  if (message.includes('InsufficientOutput')) return 'Price moved too much. Increase slippage.';
  if (message.includes('ExcessiveInput')) return 'Price moved too much. Increase slippage.';
  if (message.includes('BondingCurveLocked')) return 'Token has graduated. Trade on DEX.';
  if (message.includes('user rejected')) return 'Transaction rejected by user.';
  if (message.includes('insufficient funds')) return 'Insufficient balance.';

  return 'Transaction failed. Please try again.';
}
```

### 11.4 Token Creation Hook

```typescript
// src/hooks/useCreateToken.ts
import { useState, useCallback } from 'react';
import { parseEther } from 'ethers';
import { useContracts } from './useContracts';
import { uploadToIPFS, uploadMetadataToIPFS } from '@/lib/ipfs';

interface CreateTokenParams {
  name: string;
  symbol: string;
  description?: string;
  image?: File;
  twitter?: string;
  telegram?: string;
  website?: string;
  initialBuyAmount?: string;
}

export function useCreateToken() {
  const { getCoreContract, getSigner } = useContracts();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'uploading' | 'creating' | 'confirming'>('idle');

  const createToken = useCallback(
    async (params: CreateTokenParams): Promise<{ txHash: string; tokenAddress: string }> => {
      setLoading(true);
      setStep('uploading');

      try {
        const signer = await getSigner();
        const core = await getCoreContract(true);
        if (!signer || !core) throw new Error('Not connected');

        const creatorAddress = await signer.getAddress();

        // Step 1: Upload image to IPFS (if provided)
        let imageUri = '';
        if (params.image) {
          imageUri = await uploadToIPFS(params.image);
        }

        // Step 2: Create and upload metadata JSON
        const metadata = {
          name: params.name,
          symbol: params.symbol,
          description: params.description || '',
          image: imageUri,
          external_url: params.website || '',
          attributes: [
            { trait_type: 'twitter', value: params.twitter || '' },
            { trait_type: 'telegram', value: params.telegram || '' },
          ],
        };
        const tokenUri = await uploadMetadataToIPFS(metadata);

        setStep('creating');

        // Step 3: Call Core.createCurve()
        const initialBuy = params.initialBuyAmount
          ? parseEther(params.initialBuyAmount)
          : BigInt(0);

        // Deploy fee is 0.01 PUSH + initial buy amount
        const deployFee = parseEther('0.01');
        const totalValue = deployFee + initialBuy;

        const tx = await core.createCurve(
          creatorAddress,
          params.name,
          params.symbol,
          tokenUri,
          initialBuy,
          deployFee,
          { value: totalValue }
        );

        setStep('confirming');

        // Wait for confirmation and extract token address from events
        const receipt = await tx.wait();

        // Find CreateCurve event to get token address
        const createEvent = receipt.logs.find(
          (log: any) => log.topics[0] === core.interface.getEvent('CreateCurve').topicHash
        );

        if (!createEvent) throw new Error('Token creation event not found');

        const decoded = core.interface.decodeEventLog(
          'CreateCurve',
          createEvent.data,
          createEvent.topics
        );

        return {
          txHash: tx.hash,
          tokenAddress: decoded.token,
        };
      } catch (error: any) {
        console.error('Create token error:', error);
        throw new Error(parseContractError(error));
      } finally {
        setLoading(false);
        setStep('idle');
      }
    },
    [getCoreContract, getSigner]
  );

  return {
    createToken,
    loading,
    step,
  };
}
```

### 11.5 Balance Hook

```typescript
// src/hooks/useBalances.ts
import { useQuery } from '@tanstack/react-query';
import { formatEther } from 'ethers';
import { useContracts } from './useContracts';
import { usePushWallet } from '@pushchain/ui-kit';

export function useNativeBalance() {
  const { getProvider } = useContracts();
  const { pushChainClient, connectionStatus } = usePushWallet();

  return useQuery({
    queryKey: ['balance', 'native', pushChainClient?.universal?.account],
    queryFn: async () => {
      const provider = getProvider();
      if (!provider || !pushChainClient?.universal?.account) return '0';

      const balance = await provider.getBalance(pushChainClient.universal.account);
      return formatEther(balance);
    },
    enabled: connectionStatus === 'CONNECTED',
    refetchInterval: 10000, // Refetch every 10s
  });
}

export function useTokenBalance(tokenAddress: string | null) {
  const { getTokenContract } = useContracts();
  const { pushChainClient, connectionStatus } = usePushWallet();

  return useQuery({
    queryKey: ['balance', 'token', tokenAddress, pushChainClient?.universal?.account],
    queryFn: async () => {
      if (!tokenAddress || !pushChainClient?.universal?.account) return '0';

      const token = await getTokenContract(tokenAddress);
      if (!token) return '0';

      const balance = await token.balanceOf(pushChainClient.universal.account);
      return formatEther(balance);
    },
    enabled: connectionStatus === 'CONNECTED' && !!tokenAddress,
    refetchInterval: 10000,
  });
}
```

---

## 12. Additional Contract Integrations (Gap Fixes)

### 12.1 Price Calculation Hook (Corrected)

The Core contract doesn't have `calculateBuyOutput` - use `getAmountOut` with curve data instead:

```typescript
// src/hooks/usePriceCalculation.ts
import { useCallback } from 'react';
import { parseEther, formatEther } from 'ethers';
import { useContracts } from './useContracts';

export function usePriceCalculation() {
  const { getCoreContract, getFactoryContract } = useContracts();

  /**
   * Calculate expected tokens out for PUSH in (buy)
   * Uses Core.getAmountOut() with curve reserves
   */
  const calculateBuyOutput = useCallback(
    async (tokenAddress: string, pushAmountIn: string): Promise<string> => {
      const core = await getCoreContract();
      const factory = await getFactoryContract();
      if (!core || !factory || !pushAmountIn || parseFloat(pushAmountIn) <= 0) return '0';

      try {
        const curveAddress = await factory.getCurve(tokenAddress);
        const [virtualNative, virtualToken, k] = await core.getCurveData(curveAddress);

        const amountIn = parseEther(pushAmountIn);

        // Deduct 1% fee first (as contract does)
        const feeAmount = amountIn / BigInt(100);
        const amountInAfterFee = amountIn - feeAmount;

        // Calculate output using constant product formula
        const amountOut = await core.getAmountOut(
          amountInAfterFee,
          k,
          virtualNative,
          virtualToken
        );

        return formatEther(amountOut);
      } catch (error) {
        console.error('Error calculating buy output:', error);
        return '0';
      }
    },
    [getCoreContract, getFactoryContract]
  );

  /**
   * Calculate expected PUSH out for tokens in (sell)
   */
  const calculateSellOutput = useCallback(
    async (tokenAddress: string, tokenAmountIn: string): Promise<string> => {
      const core = await getCoreContract();
      const factory = await getFactoryContract();
      if (!core || !factory || !tokenAmountIn || parseFloat(tokenAmountIn) <= 0) return '0';

      try {
        const curveAddress = await factory.getCurve(tokenAddress);
        const [virtualNative, virtualToken, k] = await core.getCurveData(curveAddress);

        const amountIn = parseEther(tokenAmountIn);

        // Calculate output (token -> PUSH)
        const amountOut = await core.getAmountOut(
          amountIn,
          k,
          virtualToken,  // Swap reserve order for sell
          virtualNative
        );

        // Deduct 1% fee from output
        const feeAmount = amountOut / BigInt(100);
        const amountOutAfterFee = amountOut - feeAmount;

        return formatEther(amountOutAfterFee);
      } catch (error) {
        console.error('Error calculating sell output:', error);
        return '0';
      }
    },
    [getCoreContract, getFactoryContract]
  );

  /**
   * Calculate PUSH needed for exact token amount (exactOutBuy)
   */
  const calculateBuyInput = useCallback(
    async (tokenAddress: string, tokenAmountOut: string): Promise<string> => {
      const core = await getCoreContract();
      const factory = await getFactoryContract();
      if (!core || !factory || !tokenAmountOut || parseFloat(tokenAmountOut) <= 0) return '0';

      try {
        const curveAddress = await factory.getCurve(tokenAddress);
        const [virtualNative, virtualToken, k] = await core.getCurveData(curveAddress);

        const amountOut = parseEther(tokenAmountOut);

        // Calculate input needed
        const amountInBeforeFee = await core.getAmountIn(
          amountOut,
          k,
          virtualNative,
          virtualToken
        );

        // Add 1% fee
        const amountInWithFee = (amountInBeforeFee * BigInt(100)) / BigInt(99);

        return formatEther(amountInWithFee);
      } catch (error) {
        console.error('Error calculating buy input:', error);
        return '0';
      }
    },
    [getCoreContract, getFactoryContract]
  );

  /**
   * Get current price from Core contract directly
   */
  const getCurrentPrice = useCallback(
    async (tokenAddress: string): Promise<string> => {
      const core = await getCoreContract();
      if (!core) return '0';

      try {
        const price = await core.getCurrentPrice(tokenAddress);
        return formatEther(price);
      } catch (error) {
        console.error('Error getting price:', error);
        return '0';
      }
    },
    [getCoreContract]
  );

  /**
   * Get market cap from Core contract directly
   */
  const getMarketCap = useCallback(
    async (tokenAddress: string): Promise<string> => {
      const core = await getCoreContract();
      if (!core) return '0';

      try {
        const marketCap = await core.calculateMarketCap(tokenAddress);
        return formatEther(marketCap);
      } catch (error) {
        console.error('Error getting market cap:', error);
        return '0';
      }
    },
    [getCoreContract]
  );

  return {
    calculateBuyOutput,
    calculateSellOutput,
    calculateBuyInput,
    getCurrentPrice,
    getMarketCap,
  };
}
```

### 12.2 ExactOut Trading Hook

```typescript
// src/hooks/useExactOutTrading.ts
import { useState, useCallback } from 'react';
import { parseEther } from 'ethers';
import { useContracts } from './useContracts';
import { useTradeStore } from '@/stores/tradeStore';

export function useExactOutTrading() {
  const { getCoreContract, getSigner } = useContracts();
  const { addPendingTx, updateTxStatus } = useTradeStore();
  const [loading, setLoading] = useState(false);

  /**
   * Buy exact amount of tokens, paying up to maxPushIn
   */
  const exactOutBuy = useCallback(
    async (
      tokenAddress: string,
      tokenAmountOut: string,
      maxPushIn: string,
      slippagePercent: number = 2
    ): Promise<string> => {
      setLoading(true);

      try {
        const core = await getCoreContract(true);
        const signer = await getSigner();
        if (!core || !signer) throw new Error('Not connected');

        const userAddress = await signer.getAddress();
        const amountOut = parseEther(tokenAmountOut);

        // Apply slippage to maximum input
        const maxIn = parseEther(maxPushIn);
        const slippageMultiplier = BigInt(10000 + slippagePercent * 100);
        const amountInMax = (maxIn * slippageMultiplier) / BigInt(10000);

        const deadline = Math.floor(Date.now() / 1000) + 300;

        const tx = await core.exactOutBuy(
          amountOut,
          amountInMax,
          tokenAddress,
          userAddress,
          deadline,
          { value: amountInMax } // Send max, contract refunds excess
        );

        addPendingTx(tx.hash, {
          type: 'buy',
          tokenAddress,
          amountOut: tokenAmountOut,
          status: 'pending',
          timestamp: Date.now(),
        });

        const receipt = await tx.wait();
        updateTxStatus(tx.hash, receipt.status === 1 ? 'confirmed' : 'failed');

        return tx.hash;
      } catch (error: any) {
        console.error('ExactOutBuy error:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [getCoreContract, getSigner, addPendingTx, updateTxStatus]
  );

  /**
   * Sell tokens to receive exact amount of PUSH
   */
  const exactOutSell = useCallback(
    async (
      tokenAddress: string,
      pushAmountOut: string,
      maxTokensIn: string,
      slippagePercent: number = 2
    ): Promise<string> => {
      setLoading(true);

      try {
        const core = await getCoreContract(true);
        const signer = await getSigner();
        if (!core || !signer) throw new Error('Not connected');

        const userAddress = await signer.getAddress();
        const amountOut = parseEther(pushAmountOut);

        // Apply slippage to maximum input
        const maxIn = parseEther(maxTokensIn);
        const slippageMultiplier = BigInt(10000 + slippagePercent * 100);
        const amountInMax = (maxIn * slippageMultiplier) / BigInt(10000);

        const deadline = Math.floor(Date.now() / 1000) + 300;

        const tx = await core.exactOutSell(
          amountOut,
          amountInMax,
          tokenAddress,
          userAddress,
          userAddress,
          deadline
        );

        addPendingTx(tx.hash, {
          type: 'sell',
          tokenAddress,
          amountOut: pushAmountOut,
          status: 'pending',
          timestamp: Date.now(),
        });

        const receipt = await tx.wait();
        updateTxStatus(tx.hash, receipt.status === 1 ? 'confirmed' : 'failed');

        return tx.hash;
      } catch (error: any) {
        console.error('ExactOutSell error:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [getCoreContract, getSigner, addPendingTx, updateTxStatus]
  );

  return {
    exactOutBuy,
    exactOutSell,
    loading,
  };
}
```

### 12.3 BondingCurve Read Hook

```typescript
// src/hooks/useBondingCurve.ts
import { useQuery } from '@tanstack/react-query';
import { formatEther, Contract } from 'ethers';
import { useContracts } from './useContracts';
import { BondingCurveABI } from '@/config/abis';

export function useBondingCurveData(curveAddress: string | null) {
  const { getProvider } = useContracts();

  return useQuery({
    queryKey: ['bondingCurve', curveAddress],
    queryFn: async () => {
      if (!curveAddress) return null;

      const provider = getProvider();
      if (!provider) return null;

      const curve = new Contract(curveAddress, BondingCurveABI, provider);

      const [
        [realNative, realToken],
        [virtualNative, virtualToken],
        k,
        graduationMarketCap,
        isLocked,
        isListed,
        currentPrice,
        marketCap,
        [athPrice, athPriceTimestamp],
        [athMarketCap, athMarketCapTimestamp],
      ] = await Promise.all([
        curve.getReserves(),
        curve.getVirtualReserves(),
        curve.getK(),
        curve.getGraduationMarketCap(),
        curve.getLock(),
        curve.getIsListing(),
        curve.getCurrentPrice(),
        curve.calculateMarketCap(),
        curve.getATHPrice(),
        curve.getATHMarketCap(),
      ]);

      return {
        realNative: formatEther(realNative),
        realToken: formatEther(realToken),
        virtualNative: formatEther(virtualNative),
        virtualToken: formatEther(virtualToken),
        k: k.toString(),
        graduationMarketCap: formatEther(graduationMarketCap),
        isLocked,
        isListed,
        currentPrice: formatEther(currentPrice),
        marketCap: formatEther(marketCap),
        athPrice: formatEther(athPrice),
        athPriceTimestamp: new Date(Number(athPriceTimestamp) * 1000),
        athMarketCap: formatEther(athMarketCap),
        athMarketCapTimestamp: new Date(Number(athMarketCapTimestamp) * 1000),
        // Graduation progress (0-100%)
        graduationProgress: Math.min(
          100,
          (Number(formatEther(marketCap)) / Number(formatEther(graduationMarketCap))) * 100
        ),
      };
    },
    enabled: !!curveAddress,
    staleTime: 5000, // 5 seconds
  });
}
```

### 12.4 Creator Fees Hook

```typescript
// src/hooks/useCreatorFees.ts
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatEther, Contract } from 'ethers';
import { useContracts } from './useContracts';
import { usePushWallet } from '@pushchain/ui-kit';
import { FactoryABI } from '@/config/abis';
import { CONTRACT_ADDRESSES } from '@/config/contracts';

export function useCreatorFees() {
  const { getFactoryContract, getSigner, getProvider } = useContracts();
  const { pushChainClient, connectionStatus } = usePushWallet();
  const [claiming, setClaiming] = useState(false);

  // Get creator fee share percentage
  const { data: feeShareBps } = useQuery({
    queryKey: ['creatorFeeShare'],
    queryFn: async () => {
      const factory = await getFactoryContract();
      if (!factory) return 0;
      const share = await factory.getCreatorFeeShare();
      return Number(share) / 100; // Convert basis points to percentage
    },
    staleTime: 60000, // 1 minute
  });

  // Get accumulated fees for connected wallet
  const { data: fees, refetch: refetchFees } = useQuery({
    queryKey: ['creatorFees', pushChainClient?.universal?.account],
    queryFn: async () => {
      const provider = getProvider();
      if (!provider || !pushChainClient?.universal?.account) return null;

      const factory = new Contract(
        CONTRACT_ADDRESSES.Factory,
        FactoryABI,
        provider
      );

      // Get fees from factory (stored in WPUSH)
      const accumulatedFees = await factory.getAccumulatedFees(
        pushChainClient.universal.account
      );

      return {
        accumulated: formatEther(accumulatedFees),
        canClaim: accumulatedFees > BigInt(0),
      };
    },
    enabled: connectionStatus === 'CONNECTED',
    refetchInterval: 30000, // 30 seconds
  });

  // Claim accumulated fees
  const claimFees = useCallback(async (): Promise<string> => {
    setClaiming(true);

    try {
      const factory = await getFactoryContract(true);
      const signer = await getSigner();
      if (!factory || !signer) throw new Error('Not connected');

      const tx = await factory.claimCreatorFees();
      await tx.wait();

      refetchFees();
      return tx.hash;
    } catch (error: any) {
      console.error('Claim fees error:', error);
      throw error;
    } finally {
      setClaiming(false);
    }
  }, [getFactoryContract, getSigner, refetchFees]);

  return {
    feeSharePercentage: feeShareBps,
    accumulatedFees: fees?.accumulated || '0',
    canClaim: fees?.canClaim || false,
    claimFees,
    claiming,
  };
}
```

### 12.5 Factory Config Hook

```typescript
// src/hooks/useFactoryConfig.ts
import { useQuery } from '@tanstack/react-query';
import { formatEther } from 'ethers';
import { useContracts } from './useContracts';

export interface FactoryConfig {
  deployFee: string;
  listingFee: string;
  virtualNative: string;
  virtualToken: string;
  k: string;
  graduationMarketCap: string;
  feeDenominator: number;
  feeNumerator: number;
  dexFee: number;
  creatorFeeShare: number;
}

export function useFactoryConfig() {
  const { getFactoryContract } = useContracts();

  return useQuery<FactoryConfig | null>({
    queryKey: ['factoryConfig'],
    queryFn: async () => {
      const factory = await getFactoryContract();
      if (!factory) return null;

      const config = await factory.getConfig();

      return {
        deployFee: formatEther(config.deployFee),
        listingFee: formatEther(config.listingFee),
        virtualNative: formatEther(config.virtualNative),
        virtualToken: formatEther(config.virtualToken),
        k: config.k.toString(),
        graduationMarketCap: formatEther(config.graduationMarketCap),
        feeDenominator: Number(config.feeDenominator),
        feeNumerator: Number(config.feeNumerator),
        dexFee: Number(config.dexFee),
        creatorFeeShare: Number(config.creatorFeeShare) / 100, // basis points to %
      };
    },
    staleTime: 300000, // 5 minutes (config rarely changes)
  });
}
```

### 12.6 Profile Management Hook

```typescript
// src/hooks/useProfile.ts
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { usePushWallet } from '@pushchain/ui-kit';
import { uploadToIPFS } from '@/lib/ipfs';
import type { UserProfile, UpdateProfileRequest } from '@/types';

export function useProfile(address: string | null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['profile', address],
    queryFn: () => usersApi.getProfile(address!),
    enabled: !!address,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useMyProfile() {
  const { pushChainClient, connectionStatus } = usePushWallet();
  const address = pushChainClient?.universal?.account;

  return useProfile(connectionStatus === 'CONNECTED' ? address : null);
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { pushChainClient } = usePushWallet();
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: {
      displayName?: string;
      bio?: string;
      avatarFile?: File;
      twitter?: string;
      telegram?: string;
      website?: string;
    }) => {
      const address = pushChainClient?.universal?.account;
      if (!address) throw new Error('Not connected');

      // Upload avatar if provided
      let avatarUri = undefined;
      if (data.avatarFile) {
        setUploading(true);
        try {
          avatarUri = await uploadToIPFS(data.avatarFile);
        } finally {
          setUploading(false);
        }
      }

      // Create message for signature
      const timestamp = Date.now();
      const message = `Update profile for ${address}\nTimestamp: ${timestamp}`;

      // Request signature from wallet
      const signature = await pushChainClient.universal.provider.request({
        method: 'personal_sign',
        params: [message, address],
      });

      // Submit profile update
      const updateData: UpdateProfileRequest = {
        displayName: data.displayName,
        bio: data.bio,
        avatarUri,
        twitter: data.twitter,
        telegram: data.telegram,
        website: data.website,
        signature,
        message,
        timestamp,
      };

      return usersApi.updateProfile(address, updateData);
    },
    onSuccess: (updatedProfile) => {
      // Update cache with new profile data
      queryClient.setQueryData(
        ['profile', updatedProfile.walletAddress],
        updatedProfile
      );
    },
  });

  return {
    updateProfile: mutation.mutateAsync,
    isUpdating: mutation.isPending || uploading,
    error: mutation.error,
  };
}

export function useProfileCreatorFees(address: string | null) {
  const { pushChainClient, connectionStatus } = usePushWallet();
  const walletAddress = address || pushChainClient?.universal?.account;

  return useQuery({
    queryKey: ['creatorFees', walletAddress],
    queryFn: () => usersApi.getCreatorFees(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useUserCreatedTokens(address: string | null) {
  return useQuery({
    queryKey: ['userCreatedTokens', address],
    queryFn: () => usersApi.getCreatedTokens(address!, { limit: 100 }),
    enabled: !!address,
    staleTime: 60 * 1000,
  });
}

export function useUserHoldings(address: string | null) {
  return useQuery({
    queryKey: ['userHoldings', address],
    queryFn: () => usersApi.getHoldings(address!, { limit: 100 }),
    enabled: !!address,
    staleTime: 30 * 1000,
  });
}

export function useUserTrades(address: string | null) {
  return useQuery({
    queryKey: ['userTrades', address],
    queryFn: () => usersApi.getTrades(address!, { limit: 50 }),
    enabled: !!address,
    staleTime: 10 * 1000,
  });
}
```

---

## 13. Complete TypeScript Types

```typescript
// src/types/token.ts

export type TokenStatus = 'TRADING' | 'LOCKED' | 'LISTED';

export interface Token {
  id: string;
  address: string;
  curveAddress: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  tokenUri: string | null;

  // Reserves (strings for BigInt precision)
  virtualNative: string;
  virtualToken: string;
  realNative: string;
  realToken: string;
  k: string;

  // Price data
  currentPrice: string;
  marketCap: string;
  athPrice: string | null;
  athPriceTimestamp: string | null;  // ISO date string
  athMarketCap: string | null;
  athMarketCapTimestamp: string | null;

  // Status
  status: TokenStatus;
  poolAddress: string | null;

  // Timestamps
  createdAt: string;
  createdBlock: string;
  graduatedAt: string | null;
  listedAt: string | null;
  listingBlock: string | null;
  updatedAt: string;
}

// src/types/trade.ts

export type TradeType = 'BUY' | 'SELL';

export interface Trade {
  id: string;
  tokenAddress: string;
  type: TradeType;
  traderAddress: string;
  amountIn: string;
  amountOut: string;
  price: string;
  feeAmount: string;
  txHash: string;
  blockNumber: string;
  timestamp: string;
}

// src/types/holder.ts

export interface Holder {
  id: string;
  tokenAddress: string;
  holderAddress: string;
  balance: string;
  firstBuyTimestamp: string;
  lastActivityTimestamp: string;
}

// src/types/user.ts

export interface UserProfile {
  walletAddress: string;
  displayName: string | null;
  bio: string | null;
  avatarUri: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  // Stats
  totalTokensCreated: number;
  totalTrades: number;
  totalVolumeTraded: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  avatarUri?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  // Signature for verification
  signature: string;
  message: string;
  timestamp: number;
}

export interface CreatorFee {
  creatorAddress: string;
  accumulatedFees: string;
  claimedFees: string;
  lastAccumulationTimestamp: string;
  lastClaimTimestamp: string | null;
}

export interface CreatorFeeResponse {
  totalAccumulated: string;
  totalClaimed: string;
  available: string;  // totalAccumulated - totalClaimed
  tokens: Array<{
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    feesGenerated: string;
  }>;
}

// src/types/priceHistory.ts

export type PriceInterval =
  | 'ONE_MINUTE'
  | 'FIVE_MINUTES'
  | 'FIFTEEN_MINUTES'
  | 'ONE_HOUR'
  | 'FOUR_HOURS'
  | 'ONE_DAY';

export interface PriceHistory {
  id: string;
  tokenAddress: string;
  timestamp: string;
  interval: PriceInterval;
  open: string;
  high: string;
  low: string;
  close: string;
  volumeNative: string;
  volumeToken: string;
  tradeCount: number;
}

// src/types/api.ts

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    statusCode: number;
    message: string | string[];
    timestamp: string;
    path?: string;
  };
}
```
