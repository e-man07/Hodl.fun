import ky, { type KyInstance, type Options } from 'ky';
import type { AuthTokens } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Token storage keys
const ACCESS_TOKEN_KEY = 'hodl_access_token';
const REFRESH_TOKEN_KEY = 'hodl_refresh_token';

// In-memory token cache to avoid localStorage reads on every API call (js-cache-storage rule)
let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokensCacheInitialized = false;

// Auth state
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Initialize token cache from localStorage (called once)
 */
function initTokenCache(): void {
  if (tokensCacheInitialized || typeof window === 'undefined') return;
  cachedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  cachedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  tokensCacheInitialized = true;
}

/**
 * Get stored access token (cached)
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  initTokenCache();
  return cachedAccessToken;
}

/**
 * Get stored refresh token (cached)
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  initTokenCache();
  return cachedRefreshToken;
}

/**
 * Store auth tokens (updates cache and localStorage)
 */
export function setAuthTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  cachedAccessToken = tokens.accessToken;
  cachedRefreshToken = tokens.refreshToken;
  tokensCacheInitialized = true;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

/**
 * Clear auth tokens (clears cache and localStorage)
 */
export function clearAuthTokens(): void {
  if (typeof window === 'undefined') return;
  cachedAccessToken = null;
  cachedRefreshToken = null;
  tokensCacheInitialized = false;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Refresh the access token
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await ky.post(`${API_URL}/auth/refresh`, {
      json: { refreshToken },
    }).json<AuthTokens>();

    setAuthTokens(response);
    return true;
  } catch {
    clearAuthTokens();
    return false;
  }
}

/**
 * Handle token refresh with deduplication
 */
async function handleTokenRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = refreshAccessToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Create the API client with auth interceptors
 */
function createApiClient(): KyInstance {
  return ky.create({
    prefixUrl: API_URL,
    timeout: 30000,
    retry: {
      limit: 2,
      methods: ['get'],
      statusCodes: [408, 500, 502, 503, 504],
    },
    hooks: {
      beforeRequest: [
        (request) => {
          const token = getAccessToken();
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        },
      ],
      afterResponse: [
        async (request, options, response) => {
          // Handle 401 Unauthorized - try to refresh token
          if (response.status === 401 && !request.url.includes('/auth/')) {
            const refreshed = await handleTokenRefresh();
            if (refreshed) {
              // Retry the request with new token
              const token = getAccessToken();
              if (token) {
                request.headers.set('Authorization', `Bearer ${token}`);
              }
              return ky(request, options);
            }
            // Redirect to home or trigger logout
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth:logout'));
            }
          }
          return response;
        },
      ],
    },
  });
}

// Export the API client instance
export const api = createApiClient();

/**
 * Type-safe API methods
 */
export const apiClient = {
  get: <T>(url: string, options?: Options) => api.get(url, options).json<T>(),
  post: <T>(url: string, options?: Options) => api.post(url, options).json<T>(),
  put: <T>(url: string, options?: Options) => api.put(url, options).json<T>(),
  patch: <T>(url: string, options?: Options) => api.patch(url, options).json<T>(),
  delete: <T>(url: string, options?: Options) => api.delete(url, options).json<T>(),
};
