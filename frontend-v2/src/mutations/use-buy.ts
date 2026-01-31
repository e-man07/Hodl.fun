'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Contract, parseEther } from 'ethers';
import { queryKeys } from '@/queries/keys';
import { useWallet } from '@/hooks/use-wallet';
import { CONTRACTS, TOKEN_CONSTANTS } from '@/lib/contracts/config';
import { CORE_ABI } from '@/lib/contracts/abis';
import { getDeadline } from '@/lib/utils';
import { useTradeStore } from '@/store/trade';

interface BuyParams {
  tokenAddress: string;
  amountIn: string; // PUSH amount in ether
  amountOutMin: bigint; // Minimum tokens to receive (in wei)
  slippageBps?: number;
}

export function useBuy() {
  const queryClient = useQueryClient();
  const { address, getSigner } = useWallet();
  const { setIsPending, setTxHash, setError, reset } = useTradeStore();

  return useMutation({
    mutationFn: async ({ tokenAddress, amountIn, amountOutMin }: BuyParams) => {
      const signer = await getSigner();
      if (!signer || !address) {
        throw new Error('Wallet not connected');
      }

      const core = new Contract(CONTRACTS.CORE, CORE_ABI, signer);
      const amountInWei = parseEther(amountIn);
      const deadline = getDeadline(TOKEN_CONSTANTS.DEFAULT_DEADLINE_MINUTES);

      const tx = await core.exactInBuy(
        amountInWei,
        amountOutMin,
        tokenAddress,
        address,
        deadline,
        { value: amountInWei }
      );

      return tx;
    },
    onMutate: async ({ tokenAddress }) => {
      setIsPending(true);
      setError(null);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.tokens.detail(tokenAddress),
      });
    },
    onSuccess: async (tx, { tokenAddress }) => {
      setTxHash(tx.hash);

      // Wait for confirmation
      await tx.wait();

      // Invalidate relevant queries in parallel (async-parallel rule)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.tokens.detail(tokenAddress),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.tokens.trades(tokenAddress),
        }),
        address
          ? Promise.all([
              queryClient.invalidateQueries({
                queryKey: queryKeys.users.portfolio(address),
              }),
              queryClient.invalidateQueries({
                queryKey: queryKeys.contracts.balance(tokenAddress, address),
              }),
            ])
          : Promise.resolve(),
      ]);

      reset();
    },
    onError: (error: Error) => {
      setIsPending(false);
      setError(error.message);
    },
  });
}
