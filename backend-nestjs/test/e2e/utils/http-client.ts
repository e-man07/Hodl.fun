import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * HTTP Client for E2E Tests
 *
 * Wrapper around axios for making API requests during E2E tests
 */
export class TestHttpClient {
  private client: AxiosInstance;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      validateStatus: () => true, // Don't throw on any status code
    });
  }

  /**
   * Make GET request
   */
  async get<T = any>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(path, config);
  }

  /**
   * Make POST request
   */
  async post<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(path, data, config);
  }

  /**
   * Make PUT request
   */
  async put<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(path, data, config);
  }

  /**
   * Make DELETE request
   */
  async delete<T = any>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(path, config);
  }

  /**
   * Create token via API
   */
  async createToken(data: any, authorization?: string) {
    return this.post('/tokens', data, {
      headers: authorization ? { Authorization: authorization } : {},
    });
  }

  /**
   * Get token by address
   */
  async getToken(address: string) {
    return this.get(`/tokens/${address}`);
  }

  /**
   * Get all tokens with pagination
   */
  async getTokens(limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());

    return this.get(`/tokens?${params.toString()}`);
  }

  /**
   * Get trending tokens
   */
  async getTrendingTokens(timeframe?: string, metric?: string) {
    const params = new URLSearchParams();
    if (timeframe) params.append('timeframe', timeframe);
    if (metric) params.append('metric', metric);

    return this.get(`/tokens/trending?${params.toString()}`);
  }

  /**
   * Execute buy trade
   */
  async buyToken(tokenAddress: string, data: any, authorization?: string) {
    return this.post(`/trades/${tokenAddress}/buy`, data, {
      headers: authorization ? { Authorization: authorization } : {},
    });
  }

  /**
   * Execute sell trade
   */
  async sellToken(tokenAddress: string, data: any, authorization?: string) {
    return this.post(`/trades/${tokenAddress}/sell`, data, {
      headers: authorization ? { Authorization: authorization } : {},
    });
  }

  /**
   * Get token trades
   */
  async getTokenTrades(tokenAddress: string, limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());

    return this.get(`/trades/${tokenAddress}?${params.toString()}`);
  }

  /**
   * Get user trades
   */
  async getUserTrades(userAddress: string, limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());

    return this.get(`/trades/user/${userAddress}?${params.toString()}`);
  }

  /**
   * Get user portfolio
   */
  async getPortfolio(userId: string) {
    return this.get(`/portfolios/${userId}`);
  }

  /**
   * Get user portfolios by ranking
   */
  async getTopPortfolios(limit?: number) {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());

    return this.get(`/portfolios/top?${params.toString()}`);
  }

  /**
   * Get health check
   */
  async healthCheck() {
    return this.get('/health');
  }

  /**
   * Assert response has success status (2xx)
   */
  assertSuccess(response: AxiosResponse): void {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Expected success status code, got ${response.status}. Response: ${JSON.stringify(response.data)}`
      );
    }
  }

  /**
   * Assert response has error status (4xx or 5xx)
   */
  assertError(response: AxiosResponse, expectedStatus?: number): void {
    if (response.status < 400) {
      throw new Error(
        `Expected error status code, got ${response.status}. Response: ${JSON.stringify(response.data)}`
      );
    }

    if (expectedStatus && response.status !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, got ${response.status}. Response: ${JSON.stringify(response.data)}`
      );
    }
  }

  /**
   * Assert response has specific status code
   */
  assertStatus(response: AxiosResponse, status: number): void {
    if (response.status !== status) {
      throw new Error(
        `Expected status ${status}, got ${response.status}. Response: ${JSON.stringify(response.data)}`
      );
    }
  }

  /**
   * Assert response is in expected format
   */
  assertResponseFormat(response: AxiosResponse, expectedFields: string[]): void {
    const data = response.data;

    if (!data) {
      throw new Error('Response body is empty');
    }

    for (const field of expectedFields) {
      if (!(field in data)) {
        throw new Error(
          `Expected field '${field}' in response. Got: ${JSON.stringify(data)}`
        );
      }
    }
  }
}
