import type { LeaderboardEntry } from '@/types';
import { apiClient } from './client';

export type LeaderboardType = 'gainers' | 'losers' | 'volume' | 'new' | 'graduated';

/**
 * Get leaderboard entries
 */
export async function getLeaderboard(
  type: LeaderboardType,
  limit = 20
): Promise<LeaderboardEntry[]> {
  return apiClient.get<LeaderboardEntry[]>(`leaderboard/${type}?limit=${limit}`);
}

/**
 * Get top gainers
 */
export async function getTopGainers(limit = 20): Promise<LeaderboardEntry[]> {
  return getLeaderboard('gainers', limit);
}

/**
 * Get top losers
 */
export async function getTopLosers(limit = 20): Promise<LeaderboardEntry[]> {
  return getLeaderboard('losers', limit);
}

/**
 * Get top by volume
 */
export async function getTopVolume(limit = 20): Promise<LeaderboardEntry[]> {
  return getLeaderboard('volume', limit);
}

/**
 * Get newest tokens
 */
export async function getNewest(limit = 20): Promise<LeaderboardEntry[]> {
  return getLeaderboard('new', limit);
}

/**
 * Get recently graduated tokens
 */
export async function getGraduated(limit = 20): Promise<LeaderboardEntry[]> {
  return getLeaderboard('graduated', limit);
}
