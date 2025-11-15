/**
 * Request deduplication to prevent duplicate RPC/API calls
 */

// Store pending requests by key
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicate requests - if same request is in flight, return existing promise
 */
export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check if request is already in flight
  if (pendingRequests.has(key)) {
    console.log('🔄 Reusing in-flight request:', key);
    return pendingRequests.get(key) as Promise<T>;
  }

  // Create new request
  const promise = fetcher()
    .finally(() => {
      // Clean up after request completes
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Clear all pending requests
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Get number of pending requests
 */
export function getPendingRequestCount(): number {
  return pendingRequests.size;
}

/**
 * Check if a request is pending
 */
export function isRequestPending(key: string): boolean {
  return pendingRequests.has(key);
}
