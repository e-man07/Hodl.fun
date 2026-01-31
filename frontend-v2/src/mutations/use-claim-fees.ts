'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Contract } from 'ethers';
import { queryKeys } from '@/queries/keys';
import { useWallet } from '@/hooks/use-wallet';
import { CONTRACTS } from '@/lib/contracts/config';
import { FACTORY_ABI } from '@/lib/contracts/abis';

export function useClaimFees() {
  const queryClient = useQueryClient();
  const { address, getSigner } = useWallet();

  return useMutation({
    mutationFn: async () => {
      const signer = await getSigner();
      if (!signer || !address) {
        throw new Error('Wallet not connected');
      }

      const factory = new Contract(CONTRACTS.FACTORY, FACTORY_ABI, signer);
      const tx = await factory.claimCreatorFees();

      return tx;
    },
    onSuccess: async (tx) => {
      await tx.wait();

      if (address) {
        // Invalidate creator fees query
        queryClient.invalidateQueries({
          queryKey: queryKeys.contracts.creatorFees(address),
        });
        // Invalidate portfolio
        queryClient.invalidateQueries({
          queryKey: queryKeys.users.portfolio(address),
        });
      }
    },
  });
}
