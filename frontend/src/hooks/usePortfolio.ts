// Refactored portfolio hook using backend API

import { useState, useEffect, useCallback } from 'react';
import { getUserPortfolio, getUserTransactions, getUserCreatedTokens, getUserPnL } from '@/lib/api';
import type { UserPortfolio, TokenTrade, TokenData, UserPnLSummary } from '@/lib/api/types';

/**
 * Hook for user portfolio
 */
export function useUserPortfolio(address?: string) {
  const [portfolio, setPortfolio] = useState<UserPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) {
      setPortfolio(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await getUserPortfolio(address);
      setPortfolio(response.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
      console.error('Error fetching portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  return {
    portfolio,
    loading,
    error,
    refresh: fetchPortfolio,
  };
}

/**
 * Hook for user transactions
 */
export function useUserTransactions(address?: string, page: number = 1, limit: number = 50) {
  const [transactions, setTransactions] = useState<TokenTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!address) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getUserTransactions(address, page, limit);
        setTransactions(response.data);
        setPagination(response.pagination);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [address, page, limit]);

  return { transactions, loading, error, pagination };
}

/**
 * Hook for user created tokens
 */
export function useUserCreatedTokens(address?: string) {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreatedTokens = async () => {
      if (!address) {
        setTokens([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getUserCreatedTokens(address);
        setTokens(response.data.tokens);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch created tokens');
      } finally {
        setLoading(false);
      }
    };

    fetchCreatedTokens();
  }, [address]);

  return { tokens, loading, error };
}

/**
 * Hook for user PnL summary
 */
export function useUserPnL(address?: string) {
  const [pnl, setPnl] = useState<UserPnLSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPnL = async () => {
      if (!address) {
        setPnl(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getUserPnL(address);
        setPnl(response.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to fetch PnL');
      } finally {
        setLoading(false);
      }
    };

    fetchPnL();
  }, [address]);

  return { pnl, loading, error };
}
