'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getLeaderboard,
  getTopGainers,
  getTopLosers,
  getTopVolume,
  getNewest,
  getGraduated,
  type LeaderboardType,
} from '@/lib/api/leaderboard';
import { queryKeys } from './keys';

/**
 * Generic hook for leaderboard by type
 */
export function useLeaderboard(type: LeaderboardType, limit = 20) {
  return useQuery({
    queryKey: queryKeys.leaderboard.type(type),
    queryFn: () => getLeaderboard(type, limit),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook for top gainers
 */
export function useTopGainers(limit = 20) {
  return useQuery({
    queryKey: queryKeys.leaderboard.type('gainers'),
    queryFn: () => getTopGainers(limit),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for top losers
 */
export function useTopLosers(limit = 20) {
  return useQuery({
    queryKey: queryKeys.leaderboard.type('losers'),
    queryFn: () => getTopLosers(limit),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for top volume
 */
export function useTopVolume(limit = 20) {
  return useQuery({
    queryKey: queryKeys.leaderboard.type('volume'),
    queryFn: () => getTopVolume(limit),
    staleTime: 60 * 1000,
  });
}

/**
 * Hook for newest tokens
 */
export function useNewestTokens(limit = 20) {
  return useQuery({
    queryKey: queryKeys.leaderboard.type('new'),
    queryFn: () => getNewest(limit),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for graduated tokens
 */
export function useGraduatedTokens(limit = 20) {
  return useQuery({
    queryKey: queryKeys.leaderboard.type('graduated'),
    queryFn: () => getGraduated(limit),
    staleTime: 60 * 1000,
  });
}
