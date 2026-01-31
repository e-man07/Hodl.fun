import type { AuthTokens } from '@/types';
import { apiClient, setAuthTokens, clearAuthTokens } from './client';

interface NonceResponse {
  nonce: string;
  walletAddress: string;
}

interface VerifyRequest {
  wallet: string;
  signature: string;
}

/**
 * Get a nonce for wallet authentication
 */
export async function getNonce(wallet: string): Promise<NonceResponse> {
  return apiClient.post<NonceResponse>('auth/nonce', {
    json: { wallet },
  });
}

/**
 * Verify wallet signature and get auth tokens
 */
export async function verifySignature(data: VerifyRequest): Promise<AuthTokens> {
  const tokens = await apiClient.post<AuthTokens>('auth/verify', {
    json: data,
  });
  setAuthTokens(tokens);
  return tokens;
}

/**
 * Logout and clear tokens
 */
export function logout(): void {
  clearAuthTokens();
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

/**
 * Create the message to sign for authentication
 */
export function createSignMessage(nonce: string): string {
  return `Sign to login: ${nonce}`;
}
