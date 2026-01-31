'use client';

import { useQuery } from '@tanstack/react-query';
import { Contract, JsonRpcProvider } from 'ethers';
import { CONTRACTS, NETWORK } from '@/lib/contracts/config';
import { FACTORY_ABI } from '@/lib/contracts/abis';
import { queryKeys } from './keys';

/**
 * Get a read-only provider for contract reads
 */
function getProvider() {
  return new JsonRpcProvider(NETWORK.rpcUrl);
}

/**
 * Hook to get accumulated creator fees for an address
 */
export function useCreatorFees(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contracts.creatorFees(address || ''),
    queryFn: async () => {
      if (!address) throw new Error('No address');

      const provider = getProvider();
      const factory = new Contract(CONTRACTS.FACTORY, FACTORY_ABI, provider);
      const fees = await factory.getCreatorFees(address);

      return fees.toString();
    },
    enabled: !!address,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
