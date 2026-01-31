import type { TokenFilters } from '@/lib/api/tokens';
import type { PriceInterval, LeaderboardType } from '@/types';

/**
 * Query keys factory for type-safe cache management
 */
export const queryKeys = {
  // Token queries
  tokens: {
    all: ['tokens'] as const,
    list: (filters: TokenFilters) => [...queryKeys.tokens.all, 'list', filters] as const,
    trending: () => [...queryKeys.tokens.all, 'trending'] as const,
    new: () => [...queryKeys.tokens.all, 'new'] as const,
    search: (query: string) => [...queryKeys.tokens.all, 'search', query] as const,
    detail: (address: string) => [...queryKeys.tokens.all, 'detail', address] as const,
    trades: (address: string, page = 1) =>
      [...queryKeys.tokens.detail(address), 'trades', page] as const,
    holders: (address: string, page = 1) =>
      [...queryKeys.tokens.detail(address), 'holders', page] as const,
    priceHistory: (address: string, interval: PriceInterval) =>
      [...queryKeys.tokens.detail(address), 'price', interval] as const,
  },

  // User queries
  users: {
    all: ['users'] as const,
    portfolio: (address: string) => [...queryKeys.users.all, address, 'portfolio'] as const,
    holdings: (address: string, page = 1) =>
      [...queryKeys.users.all, address, 'holdings', page] as const,
    trades: (address: string, page = 1) =>
      [...queryKeys.users.all, address, 'trades', page] as const,
    createdTokens: (address: string, page = 1) =>
      [...queryKeys.users.all, address, 'created', page] as const,
  },

  // Leaderboard queries
  leaderboard: {
    all: ['leaderboard'] as const,
    type: (type: LeaderboardType) => [...queryKeys.leaderboard.all, type] as const,
  },

  // Alert queries
  alerts: {
    all: ['alerts'] as const,
    detail: (id: string) => [...queryKeys.alerts.all, id] as const,
  },

  // Contract read queries
  contracts: {
    all: ['contracts'] as const,
    price: (token: string) => [...queryKeys.contracts.all, 'price', token] as const,
    marketCap: (token: string) => [...queryKeys.contracts.all, 'marketCap', token] as const,
    curveData: (token: string) => [...queryKeys.contracts.all, 'curveData', token] as const,
    balance: (token: string, account: string) =>
      [...queryKeys.contracts.all, 'balance', token, account] as const,
    allowance: (token: string, owner: string, spender: string) =>
      [...queryKeys.contracts.all, 'allowance', token, owner, spender] as const,
    creatorFees: (creator: string) =>
      [...queryKeys.contracts.all, 'creatorFees', creator] as const,
  },
} as const;
