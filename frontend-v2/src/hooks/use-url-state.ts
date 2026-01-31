'use client';

import { useQueryState, parseAsInteger, parseAsStringEnum, parseAsString } from 'nuqs';
import type { TokenStatus } from '@/types';

// Sort options
const SORT_BY_OPTIONS = ['marketCap', 'volume24h', 'priceChange24h', 'holders', 'createdAt'] as const;
const SORT_ORDER_OPTIONS = ['asc', 'desc'] as const;
const STATUS_OPTIONS = ['TRADING', 'LOCKED', 'LISTED'] as const;

export type SortBy = (typeof SORT_BY_OPTIONS)[number];
export type SortOrder = (typeof SORT_ORDER_OPTIONS)[number];

/**
 * URL state for token list filters
 */
export function useTokenFiltersState() {
  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1)
  );

  const [status, setStatus] = useQueryState(
    'status',
    parseAsStringEnum<TokenStatus>([...STATUS_OPTIONS])
  );

  const [sortBy, setSortBy] = useQueryState(
    'sortBy',
    parseAsStringEnum<SortBy>([...SORT_BY_OPTIONS]).withDefault('marketCap')
  );

  const [sortOrder, setSortOrder] = useQueryState(
    'sortOrder',
    parseAsStringEnum<SortOrder>([...SORT_ORDER_OPTIONS]).withDefault('desc')
  );

  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('')
  );

  const resetFilters = () => {
    setPage(1);
    setStatus(null);
    setSortBy('marketCap');
    setSortOrder('desc');
    setSearch('');
  };

  return {
    // Values
    page,
    status,
    sortBy,
    sortOrder,
    search,
    // Setters
    setPage,
    setStatus,
    setSortBy,
    setSortOrder,
    setSearch,
    // Helpers
    resetFilters,
    // Combined filters object for API calls
    filters: {
      page,
      status: status || undefined,
      sortBy,
      sortOrder,
      search: search || undefined,
    },
  };
}

/**
 * URL state for leaderboard tab
 */
export function useLeaderboardState() {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum(['gainers', 'losers', 'volume', 'new', 'graduated'] as const).withDefault('gainers')
  );

  return { tab, setTab };
}

/**
 * URL state for token page tabs
 */
export function useTokenPageState() {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum(['trades', 'holders'] as const).withDefault('trades')
  );

  return { tab, setTab };
}

/**
 * URL state for dashboard tabs
 */
export function useDashboardState() {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringEnum(['holdings', 'trades', 'created'] as const).withDefault('holdings')
  );

  return { tab, setTab };
}
