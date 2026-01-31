import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAlertForm } from './use-alert-form';

describe('useAlertForm', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAlertForm());

    expect(result.current.tokenAddress).toBe('');
    expect(result.current.alertType).toBe('PRICE_ABOVE');
    expect(result.current.targetPrice).toBe('');
  });

  it('should update tokenAddress', () => {
    const { result } = renderHook(() => useAlertForm());

    act(() => {
      result.current.setTokenAddress('0x123456789');
    });

    expect(result.current.tokenAddress).toBe('0x123456789');
  });

  it('should update alertType', () => {
    const { result } = renderHook(() => useAlertForm());

    act(() => {
      result.current.setAlertType('PRICE_BELOW');
    });

    expect(result.current.alertType).toBe('PRICE_BELOW');

    act(() => {
      result.current.setAlertType('GRADUATION');
    });

    expect(result.current.alertType).toBe('GRADUATION');
  });

  it('should update targetPrice', () => {
    const { result } = renderHook(() => useAlertForm());

    act(() => {
      result.current.setTargetPrice('0.00000001');
    });

    expect(result.current.targetPrice).toBe('0.00000001');
  });

  it('should reset all values to initial state', () => {
    const { result } = renderHook(() => useAlertForm());

    // Set some values
    act(() => {
      result.current.setTokenAddress('0x123');
      result.current.setAlertType('GRADUATION');
      result.current.setTargetPrice('1.5');
    });

    // Verify values were set
    expect(result.current.tokenAddress).toBe('0x123');
    expect(result.current.alertType).toBe('GRADUATION');
    expect(result.current.targetPrice).toBe('1.5');

    // Reset
    act(() => {
      result.current.reset();
    });

    // Verify reset
    expect(result.current.tokenAddress).toBe('');
    expect(result.current.alertType).toBe('PRICE_ABOVE');
    expect(result.current.targetPrice).toBe('');
  });

  it('should preserve other values when updating one field', () => {
    const { result } = renderHook(() => useAlertForm());

    act(() => {
      result.current.setTokenAddress('0x123');
      result.current.setAlertType('PRICE_BELOW');
      result.current.setTargetPrice('0.5');
    });

    // Update only tokenAddress
    act(() => {
      result.current.setTokenAddress('0x456');
    });

    // Other values should remain unchanged
    expect(result.current.tokenAddress).toBe('0x456');
    expect(result.current.alertType).toBe('PRICE_BELOW');
    expect(result.current.targetPrice).toBe('0.5');
  });

  it('should have stable setter references', () => {
    const { result, rerender } = renderHook(() => useAlertForm());

    const firstSetTokenAddress = result.current.setTokenAddress;
    const firstSetAlertType = result.current.setAlertType;
    const firstSetTargetPrice = result.current.setTargetPrice;
    const firstReset = result.current.reset;

    rerender();

    // Setters should be memoized with useCallback
    expect(result.current.setTokenAddress).toBe(firstSetTokenAddress);
    expect(result.current.setAlertType).toBe(firstSetAlertType);
    expect(result.current.setTargetPrice).toBe(firstSetTargetPrice);
    expect(result.current.reset).toBe(firstReset);
  });
});
