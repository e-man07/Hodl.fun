import { create } from 'zustand';

type TradeMode = 'buy' | 'sell';
type InputMode = 'native' | 'token';

interface TradeState {
  // Trade mode
  mode: TradeMode;
  setMode: (mode: TradeMode) => void;

  // Input mode (which currency user is typing)
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;

  // Input values
  nativeAmount: string;
  tokenAmount: string;
  setNativeAmount: (amount: string) => void;
  setTokenAmount: (amount: string) => void;

  // Slippage settings
  slippageBps: number;
  setSlippageBps: (bps: number) => void;
  customSlippage: boolean;
  setCustomSlippage: (custom: boolean) => void;

  // Transaction state
  isPending: boolean;
  setIsPending: (pending: boolean) => void;
  txHash: string | null;
  setTxHash: (hash: string | null) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Reset form
  reset: () => void;
}

const DEFAULT_SLIPPAGE_BPS = 100; // 1%

export const useTradeStore = create<TradeState>((set) => ({
  // Trade mode
  mode: 'buy',
  setMode: (mode) => set({ mode, nativeAmount: '', tokenAmount: '', error: null }),

  // Input mode
  inputMode: 'native',
  setInputMode: (inputMode) => set({ inputMode }),

  // Input values
  nativeAmount: '',
  tokenAmount: '',
  setNativeAmount: (nativeAmount) => set({ nativeAmount, inputMode: 'native' }),
  setTokenAmount: (tokenAmount) => set({ tokenAmount, inputMode: 'token' }),

  // Slippage
  slippageBps: DEFAULT_SLIPPAGE_BPS,
  setSlippageBps: (slippageBps) => set({ slippageBps }),
  customSlippage: false,
  setCustomSlippage: (customSlippage) => set({ customSlippage }),

  // Transaction state
  isPending: false,
  setIsPending: (isPending) => set({ isPending }),
  txHash: null,
  setTxHash: (txHash) => set({ txHash }),
  error: null,
  setError: (error) => set({ error }),

  // Reset
  reset: () =>
    set({
      nativeAmount: '',
      tokenAmount: '',
      inputMode: 'native',
      isPending: false,
      txHash: null,
      error: null,
    }),
}));

// Slippage presets
export const SLIPPAGE_PRESETS = [
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
  { label: '2%', value: 200 },
  { label: '5%', value: 500 },
] as const;
