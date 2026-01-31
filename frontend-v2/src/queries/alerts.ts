'use client';

import { useQuery } from '@tanstack/react-query';
import { isAuthenticated } from '@/lib/api/client';
import { getAlerts, getAlert } from '@/lib/api/alerts';
import { queryKeys } from './keys';

/**
 * Hook for user's alerts (requires auth)
 */
export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts.all,
    queryFn: getAlerts,
    enabled: isAuthenticated(),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for single alert
 */
export function useAlert(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.alerts.detail(id || ''),
    queryFn: () => getAlert(id!),
    enabled: !!id && isAuthenticated(),
    staleTime: 60 * 1000,
  });
}
