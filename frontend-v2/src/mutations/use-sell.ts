'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Contract, parseUnits, MaxUint256 } from 'ethers';
import { queryKeys } from '@/queries/keys';
import { useWallet } from '@/hooks/use-wallet';
import { CONTRACTS, TOKEN_CONSTANTS } from '@/lib/contracts/config';
import { CORE_ABI, TOKEN_ABI } from '@/lib/contracts/abis';
import { getDeadline } from '@/lib/utils';
import { useTradeStore } from '@/store/trade';

interface SellParams {
  tokenAddress: string;
  amountIn: string; // Token amount in ether format
  amountOutMin: bigint; // Minimum PUSH to receive (in wei)
}

export function useSell() {
  const queryClient = useQueryClient();
  const { address, getSigner } = useWallet();
  const { setIsPending, setTxHash, setError, reset } = useTradeStore();

  return useMutation({
    mutationFn: async ({ tokenAddress, amountIn, amountOutMin }: SellParams) => {
      const signer = await getSigner();
      if (!signer || !address) {
        throw new Error('Wallet not connected');
      }

      const token = new Contract(tokenAddress, TOKEN_ABI, signer);
      const core = new Contract(CONTRACTS.CORE, CORE_ABI, signer);
      const amountInWei = parseUnits(amountIn, 18);
      const deadline = getDeadline(TOKEN_CONSTANTS.DEFAULT_DEADLINE_MINUTES);

      // Check allowance in parallel with preparing the transaction
      // Only await approval if needed
      const allowance = await token.allowance(address, CONTRACTS.CORE);
      if (allowance < amountInWei) {
        const approveTx = await token.approve(CONTRACTS.CORE, MaxUint256);
        await approveTx.wait();
      }

      // Execute sell
      const tx = await core.exactInSell(
        amountInWei,
        amountOutMin,
        tokenAddress,
        address,
        address,
        deadline
      );

      return tx;
    },
    onMutate: async ({ tokenAddress }) => {
      setIsPending(true);
      setError(null);

      await queryClient.cancelQueries({
        queryKey: queryKeys.tokens.detail(tokenAddress),
      });
    },
    onSuccess: async (tx, { tokenAddress }) => {
      setTxHash(tx.hash);

      await tx.wait();

      // Invalidate relevant queries in parallel
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
