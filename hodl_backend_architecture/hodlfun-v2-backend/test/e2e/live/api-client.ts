/**
 * Live E2E Test API Client
 * HTTP client for testing API endpoints with real data
 */
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { SERVICE_URLS, API_ENDPOINTS, TIMEOUTS, testLog } from './config';

// Types for API responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface NonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenResponse {
  address: string;
  curveAddress: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  tokenUri: string | null;
  currentPrice: string;
  marketCap: string;
  virtualNative: string;
  virtualToken: string;
  realNative: string;
  realToken: string;
  k: string;
  athPrice: string | null;
  athPriceTimestamp: string | null;
  athMarketCap: string | null;
  athMarketCapTimestamp: string | null;
  status: 'TRADING' | 'LOCKED' | 'LISTED';
  poolAddress: string | null;
  createdBlock: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioResponse {
  id: string;
  walletAddress: string;
  totalInvested: string;
  totalReturned: string;
  totalTrades: number;
  updatedAt: string;
}

export interface TradeResponse {
  id: string;
  tokenAddress: string;
  type: 'BUY' | 'SELL';
  traderAddress: string;
  amountIn: string;
  amountOut: string;
  price: string;
  feeAmount: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
}

export interface HolderResponse {
  tokenAddress: string;
  holderAddress: string;
  balance: string;
  firstBuyTimestamp: string;
  lastActivityTimestamp: string;
}

export interface PriceHistoryResponse {
  tokenAddress: string;
  interval: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volumeNative: string;
  volumeToken: string;
  tradeCount: number;
}

export interface UserResponse {
  address: string;
  portfolio?: {
    totalInvested: string;
    totalReturned: string;
    totalTrades: number;
  };
}

export interface HealthResponse {
  status: string;
  checks?: {
    database: string;
    redis: string;
  };
  timestamp?: string;
}

export interface LeaderboardTokenResponse {
  address: string;
  name: string;
  symbol: string;
  currentPrice: string;
  marketCap: string;
  priceChange24h?: number;
  volume24h?: string;
  status: 'TRADING' | 'LOCKED' | 'LISTED';
  createdAt: string;
}

export interface AlertResponse {
  id: string;
  walletAddress: string;
  tokenAddress: string;
  alertType: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'GRADUATION';
  targetPrice: string | null;
  isTriggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

// Create axios instance
let client: AxiosInstance | null = null;
let authToken: string | null = null;

/**
 * Get or create the API client instance
 */
export function getApiClient(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: SERVICE_URLS.api,
      timeout: TIMEOUTS.apiRequest,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        testLog(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Add response interceptor for logging
    client.interceptors.response.use(
      (response) => {
        testLog(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        testLog(`API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
        return Promise.reject(error);
      },
    );
  }
  return client;
}

/**
 * Set the authentication token for subsequent requests
 */
export function setAuthToken(token: string): void {
  authToken = token;
  const apiClient = getApiClient();
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  testLog('Auth token set');
}

/**
 * Clear the authentication token
 */
export function clearAuthToken(): void {
  authToken = null;
  const apiClient = getApiClient();
  delete apiClient.defaults.headers.common['Authorization'];
  testLog('Auth token cleared');
}

/**
 * Get current auth token
 */
export function getAuthToken(): string | null {
  return authToken;
}

// =============================================================================
// Health Check Endpoints
// =============================================================================

/**
 * Check API health
 */
export async function checkApiHealth(): Promise<HealthResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<HealthResponse>>(API_ENDPOINTS.authNonce.replace('/auth/nonce', '/health/ready'));
  return response.data.data!;
}

/**
 * Check all services health
 */
export async function checkAllServicesHealth(): Promise<{
  api: boolean;
  websocket: boolean;
  indexer: boolean;
  worker: boolean;
}> {
  const results = {
    api: false,
    websocket: false,
    indexer: false,
    worker: false,
  };

  // Check each service in parallel
  const checks = await Promise.allSettled([
    axios.get(`${SERVICE_URLS.api}/api/v1/health/ready`, { timeout: 5000 }),
    axios.get(`${SERVICE_URLS.websocket}/health/ready`, { timeout: 5000 }),
    axios.get(`${SERVICE_URLS.indexer}/health/ready`, { timeout: 5000 }),
    axios.get(`${SERVICE_URLS.worker}/health/ready`, { timeout: 5000 }),
  ]);

  results.api = checks[0].status === 'fulfilled' && (checks[0].value as AxiosResponse).status === 200;
  results.websocket = checks[1].status === 'fulfilled' && (checks[1].value as AxiosResponse).status === 200;
  results.indexer = checks[2].status === 'fulfilled' && (checks[2].value as AxiosResponse).status === 200;
  results.worker = checks[3].status === 'fulfilled' && (checks[3].value as AxiosResponse).status === 200;

  testLog('Service health check complete', results);
  return results;
}

/**
 * Get health metrics (Prometheus format)
 */
export async function getHealthMetrics(): Promise<string> {
  const apiClient = getApiClient();
  const response = await apiClient.get('/api/v1/health/metrics', {
    transformResponse: [(data: string) => data],
  });
  return response.data;
}

/**
 * Get Prometheus metrics
 */
export async function getPrometheusMetrics(): Promise<string> {
  const apiClient = getApiClient();
  const response = await apiClient.get('/api/v1/metrics', {
    transformResponse: [(data: string) => data],
  });
  return response.data;
}

// =============================================================================
// Authentication Endpoints
// =============================================================================

/**
 * Request authentication nonce
 */
export async function requestNonce(walletAddress: string): Promise<NonceResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.post<ApiResponse<NonceResponse>>(API_ENDPOINTS.authNonce, {
    wallet: walletAddress.toLowerCase(),
  });
  return response.data.data!;
}

/**
 * Verify signature and get tokens
 */
export async function verifySignature(
  walletAddress: string,
  signature: string,
): Promise<AuthTokens> {
  const apiClient = getApiClient();
  const response = await apiClient.post<ApiResponse<AuthTokens>>(API_ENDPOINTS.authVerify, {
    wallet: walletAddress.toLowerCase(),
    signature,
  });
  return response.data.data!;
}

/**
 * Refresh authentication tokens
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const apiClient = getApiClient();
  const response = await apiClient.post<ApiResponse<AuthTokens>>(API_ENDPOINTS.authRefresh, {
    refreshToken,
  });
  return response.data.data!;
}

/**
 * Full authentication flow
 */
export async function authenticate(
  walletAddress: string,
  signMessageFn: (message: string) => Promise<string>,
): Promise<AuthTokens> {
  // Get nonce
  const nonceResponse = await requestNonce(walletAddress);

  // Sign message
  const signature = await signMessageFn(nonceResponse.message);

  // Verify and get tokens
  const tokens = await verifySignature(walletAddress, signature);

  // Set token for future requests
  setAuthToken(tokens.accessToken);

  testLog('Authentication complete', { expiresIn: tokens.expiresIn });
  return tokens;
}

// =============================================================================
// Token Endpoints
// =============================================================================

/**
 * Get list of tokens
 */
export async function getTokens(params?: {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<PaginatedResponse<TokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<TokenResponse>>>(
    API_ENDPOINTS.tokens,
    { params },
  );
  return response.data.data!;
}

/**
 * Get token by address
 */
export async function getToken(tokenAddress: string): Promise<TokenResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<TokenResponse>>(
    API_ENDPOINTS.tokenByAddress(tokenAddress),
  );
  return response.data.data!;
}

/**
 * Get token trades
 */
export async function getTokenTrades(
  tokenAddress: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedResponse<TradeResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<TradeResponse>>>(
    API_ENDPOINTS.tokenTrades(tokenAddress),
    { params },
  );
  return response.data.data!;
}

/**
 * Get token holders
 */
export async function getTokenHolders(
  tokenAddress: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedResponse<HolderResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<HolderResponse>>>(
    API_ENDPOINTS.tokenHolders(tokenAddress),
    { params },
  );
  return response.data.data!;
}

/**
 * Get token price history
 */
export async function getTokenPriceHistory(
  tokenAddress: string,
  params?: { interval?: string; limit?: number },
): Promise<PriceHistoryResponse[]> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PriceHistoryResponse[]>>(
    API_ENDPOINTS.tokenPriceHistory(tokenAddress),
    { params },
  );
  return response.data.data!;
}

/**
 * Get trending tokens
 */
export async function getTrendingTokens(params?: {
  limit?: number;
}): Promise<PaginatedResponse<TokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<TokenResponse>>>(
    API_ENDPOINTS.tokensTrending,
    { params },
  );
  return response.data.data!;
}

/**
 * Get new tokens
 */
export async function getNewTokens(params?: {
  limit?: number;
}): Promise<PaginatedResponse<TokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<TokenResponse>>>(
    API_ENDPOINTS.tokensNew,
    { params },
  );
  return response.data.data!;
}

// =============================================================================
// User Endpoints
// =============================================================================

/**
 * Get user profile
 */
export async function getUserProfile(walletAddress: string): Promise<UserResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<UserResponse>>(
    API_ENDPOINTS.userProfile(walletAddress),
  );
  return response.data.data!;
}

/**
 * Get user holdings
 */
export async function getUserHoldings(
  walletAddress: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedResponse<HolderResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<HolderResponse>>>(
    API_ENDPOINTS.userHoldings(walletAddress),
    { params },
  );
  return response.data.data!;
}

/**
 * Get user trades
 */
export async function getUserTrades(
  walletAddress: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedResponse<TradeResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<TradeResponse>>>(
    API_ENDPOINTS.userTrades(walletAddress),
    { params },
  );
  return response.data.data!;
}

/**
 * Get tokens created by user
 */
export async function getUserCreatedTokens(
  walletAddress: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedResponse<TokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<TokenResponse>>>(
    API_ENDPOINTS.userCreatedTokens(walletAddress),
    { params },
  );
  return response.data.data!;
}

/**
 * Get current user profile (requires auth)
 */
export async function getMyProfile(): Promise<UserResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<UserResponse>>(API_ENDPOINTS.userMe);
  return response.data.data!;
}

/**
 * Get current user portfolio (requires auth)
 */
export async function getMyPortfolio(): Promise<PortfolioResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PortfolioResponse>>(API_ENDPOINTS.userMePortfolio);
  return response.data.data!;
}

/**
 * Get user portfolio by address
 */
export async function getUserPortfolio(walletAddress: string): Promise<PortfolioResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PortfolioResponse>>(
    API_ENDPOINTS.userPortfolio(walletAddress),
  );
  return response.data.data!;
}

/**
 * Wait for portfolio to be populated with minimum trades
 */
export async function waitForPortfolioInApi(
  walletAddress: string,
  expectedMinTrades: number,
  maxWaitMs = 30000,
  pollIntervalMs = 2000,
): Promise<PortfolioResponse | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const portfolio = await getUserPortfolio(walletAddress);
      if (portfolio && portfolio.totalTrades >= expectedMinTrades) {
        testLog('Portfolio found in API', { walletAddress, totalTrades: portfolio.totalTrades });
        return portfolio;
      }
      testLog(`Portfolio not ready yet (${portfolio?.totalTrades || 0}/${expectedMinTrades} trades), waiting...`);
    } catch {
      testLog('Portfolio not yet available, waiting...');
    }
    await sleep(pollIntervalMs);
  }

  testLog('Portfolio not ready after timeout', { walletAddress, maxWaitMs });
  return null;
}

// =============================================================================
// Leaderboard Endpoints
// =============================================================================

/**
 * Get top price gainers
 */
export async function getLeaderboardGainers(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<LeaderboardTokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<LeaderboardTokenResponse>>>(
    API_ENDPOINTS.leaderboardGainers,
    { params },
  );
  return response.data.data!;
}

/**
 * Get top price losers
 */
export async function getLeaderboardLosers(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<LeaderboardTokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<LeaderboardTokenResponse>>>(
    API_ENDPOINTS.leaderboardLosers,
    { params },
  );
  return response.data.data!;
}

/**
 * Get top volume tokens
 */
export async function getLeaderboardVolume(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<LeaderboardTokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<LeaderboardTokenResponse>>>(
    API_ENDPOINTS.leaderboardVolume,
    { params },
  );
  return response.data.data!;
}

/**
 * Get newest tokens
 */
export async function getLeaderboardNew(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<LeaderboardTokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<LeaderboardTokenResponse>>>(
    API_ENDPOINTS.leaderboardNew,
    { params },
  );
  return response.data.data!;
}

/**
 * Get graduated tokens
 */
export async function getLeaderboardGraduated(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<LeaderboardTokenResponse>> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<PaginatedResponse<LeaderboardTokenResponse>>>(
    API_ENDPOINTS.leaderboardGraduated,
    { params },
  );
  return response.data.data!;
}

// =============================================================================
// Alert Endpoints
// =============================================================================

/**
 * Create a new alert (requires auth)
 */
export async function createAlert(data: {
  tokenAddress: string;
  alertType: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'GRADUATION';
  targetPrice?: string;
}): Promise<AlertResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.post<ApiResponse<AlertResponse>>(
    API_ENDPOINTS.alerts,
    data,
  );
  return response.data.data!;
}

/**
 * Get all alerts for authenticated user (requires auth)
 */
export async function getAlerts(): Promise<AlertResponse[]> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<AlertResponse[]>>(API_ENDPOINTS.alerts);
  return response.data.data!;
}

/**
 * Get a specific alert by ID (requires auth)
 */
export async function getAlertById(id: string): Promise<AlertResponse | null> {
  const apiClient = getApiClient();
  const response = await apiClient.get<ApiResponse<AlertResponse | null>>(
    API_ENDPOINTS.alertById(id),
  );
  return response.data.data!;
}

/**
 * Update an alert (requires auth)
 */
export async function updateAlert(
  id: string,
  data: {
    alertType?: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'GRADUATION';
    targetPrice?: string;
  },
): Promise<AlertResponse> {
  const apiClient = getApiClient();
  const response = await apiClient.put<ApiResponse<AlertResponse>>(
    API_ENDPOINTS.alertById(id),
    data,
  );
  return response.data.data!;
}

/**
 * Delete an alert (requires auth)
 */
export async function deleteAlert(id: string): Promise<void> {
  const apiClient = getApiClient();
  await apiClient.delete(API_ENDPOINTS.alertById(id));
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Wait for a token to appear in the API (after indexer processes it)
 */
export async function waitForTokenInApi(
  tokenAddress: string,
  maxWaitMs = 15000,
  pollIntervalMs = 1000,
): Promise<TokenResponse | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const token = await getToken(tokenAddress);
      testLog('Token found in API', { tokenAddress });
      return token;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        testLog(`Token not yet indexed, waiting... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
        await sleep(pollIntervalMs);
      } else {
        throw error;
      }
    }
  }

  testLog('Token not found in API after timeout', { tokenAddress, maxWaitMs });
  return null;
}

/**
 * Wait for a trade to appear in the API
 */
export async function waitForTradeInApi(
  tokenAddress: string,
  txHash: string,
  maxWaitMs = 15000,
  pollIntervalMs = 1000,
): Promise<TradeResponse | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const trades = await getTokenTrades(tokenAddress, { limit: 50 });
      const trade = trades.data.find((t) => t.txHash.toLowerCase() === txHash.toLowerCase());

      if (trade) {
        testLog('Trade found in API', { txHash });
        return trade;
      }

      testLog(`Trade not yet indexed, waiting... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
      await sleep(pollIntervalMs);
    } catch {
      await sleep(pollIntervalMs);
    }
  }

  testLog('Trade not found in API after timeout', { txHash, maxWaitMs });
  return null;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cleanup API client
 */
export function cleanupApiClient(): void {
  clearAuthToken();
  client = null;
  testLog('API client cleanup complete');
}
