import { describe, it, expect, beforeEach } from 'vitest';
import { useTradeStore, SLIPPAGE_PRESETS } from './trade';

describe('useTradeStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useTradeStore.getState().reset();
    useTradeStore.setState({ mode: 'buy' });
  });

  it('should have correct initial state', () => {
    const state = useTradeStore.getState();
    expect(state.mode).toBe('buy');
    expect(state.nativeAmount).toBe('');
    expect(state.tokenAmount).toBe('');
    expect(state.slippageBps).toBe(100); // 1%
    expect(state.inputMode).toBe('native');
  });

  it('should set mode and reset amounts', () => {
    useTradeStore.getState().setNativeAmount('50');
    useTradeStore.getState().setMode('sell');

    const state = useTradeStore.getState();
    expect(state.mode).toBe('sell');
    expect(state.nativeAmount).toBe('');
    expect(state.tokenAmount).toBe('');
  });

  it('should set native amount and update input mode', () => {
    useTradeStore.getState().setTokenAmount('100');
    useTradeStore.getState().setNativeAmount('50');

    const state = useTradeStore.getState();
    expect(state.nativeAmount).toBe('50');
    expect(state.inputMode).toBe('native');
  });

  it('should set token amount and update input mode', () => {
    useTradeStore.getState().setNativeAmount('50');
    useTradeStore.getState().setTokenAmount('100');

    const state = useTradeStore.getState();
    expect(state.tokenAmount).toBe('100');
    expect(state.inputMode).toBe('token');
  });

  it('should set slippage in bps', () => {
    useTradeStore.getState().setSlippageBps(200);
    expect(useTradeStore.getState().slippageBps).toBe(200);
  });

  it('should reset state', () => {
    useTradeStore.getState().setNativeAmount('50');
    useTradeStore.getState().setTokenAmount('100');
    useTradeStore.getState().setError('Some error');
    useTradeStore.getState().reset();

    const state = useTradeStore.getState();
    expect(state.nativeAmount).toBe('');
    expect(state.tokenAmount).toBe('');
    expect(state.inputMode).toBe('native');
    expect(state.error).toBeNull();
  });

  it('should track pending state', () => {
    useTradeStore.getState().setIsPending(true);
    expect(useTradeStore.getState().isPending).toBe(true);

    useTradeStore.getState().setIsPending(false);
    expect(useTradeStore.getState().isPending).toBe(false);
  });

  it('should track transaction hash', () => {
    useTradeStore.getState().setTxHash('0x123abc');
    expect(useTradeStore.getState().txHash).toBe('0x123abc');

    useTradeStore.getState().setTxHash(null);
    expect(useTradeStore.getState().txHash).toBeNull();
  });
});

describe('SLIPPAGE_PRESETS', () => {
  it('should have correct presets', () => {
    expect(SLIPPAGE_PRESETS).toHaveLength(4);
    expect(SLIPPAGE_PRESETS[0]).toEqual({ label: '0.5%', value: 50 });
    expect(SLIPPAGE_PRESETS[1]).toEqual({ label: '1%', value: 100 });
    expect(SLIPPAGE_PRESETS[2]).toEqual({ label: '2%', value: 200 });
    expect(SLIPPAGE_PRESETS[3]).toEqual({ label: '5%', value: 500 });
  });
});
