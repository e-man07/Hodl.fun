'use client';

import { useReducer, useCallback } from 'react';
import type { AlertType } from '@/types';

/**
 * State shape for the create alert form
 * Consolidated from scattered useState calls (patterns-lift-state rule)
 */
export interface AlertFormState {
  tokenAddress: string;
  alertType: AlertType;
  targetPrice: string;
}

type AlertFormAction =
  | { type: 'SET_TOKEN_ADDRESS'; payload: string }
  | { type: 'SET_ALERT_TYPE'; payload: AlertType }
  | { type: 'SET_TARGET_PRICE'; payload: string }
  | { type: 'RESET' };

const initialState: AlertFormState = {
  tokenAddress: '',
  alertType: 'PRICE_ABOVE',
  targetPrice: '',
};

function alertFormReducer(state: AlertFormState, action: AlertFormAction): AlertFormState {
  switch (action.type) {
    case 'SET_TOKEN_ADDRESS':
      return { ...state, tokenAddress: action.payload };
    case 'SET_ALERT_TYPE':
      return { ...state, alertType: action.payload };
    case 'SET_TARGET_PRICE':
      return { ...state, targetPrice: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

/**
 * Hook for managing alert form state with a reducer
 * Provides a cleaner API than multiple useState calls
 */
export function useAlertForm() {
  const [state, dispatch] = useReducer(alertFormReducer, initialState);

  const setTokenAddress = useCallback((value: string) => {
    dispatch({ type: 'SET_TOKEN_ADDRESS', payload: value });
  }, []);

  const setAlertType = useCallback((value: AlertType) => {
    dispatch({ type: 'SET_ALERT_TYPE', payload: value });
  }, []);

  const setTargetPrice = useCallback((value: string) => {
    dispatch({ type: 'SET_TARGET_PRICE', payload: value });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    ...state,
    setTokenAddress,
    setAlertType,
    setTargetPrice,
    reset,
  };
}
