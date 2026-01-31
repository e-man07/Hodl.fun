'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Contract, parseEther } from 'ethers';
import { queryKeys } from '@/queries/keys';
import { useWallet } from '@/hooks/use-wallet';
import { CONTRACTS, TOKEN_CONSTANTS, FEES } from '@/lib/contracts/config';
import { CORE_ABI } from '@/lib/contracts/abis';

interface CreateTokenParams {
  name: string;
  symbol: string;
  tokenURI: string;
  initialBuyAmount?: string; // Optional initial buy in PUSH
}

interface CreateTokenResult {
  txHash: string;
  curveAddress: string;
  tokenAddress: string;
}

export function useCreateToken() {
  const queryClient = useQueryClient();
  const { address, getSigner } = useWallet();

  return useMutation({
    mutationFn: async ({
      name,
      symbol,
      tokenURI,
      initialBuyAmount = '0',
    }: CreateTokenParams): Promise<CreateTokenResult> => {
      const signer = await getSigner();
      if (!signer || !address) {
        throw new Error('Wallet not connected');
      }

      const core = new Contract(CONTRACTS.CORE, CORE_ABI, signer);

      // Calculate value to send (deploy fee + optional initial buy)
      const deployFee = BigInt(FEES.DEPLOY_FEE);
      const initialBuy = parseEther(initialBuyAmount);
      const totalValue = deployFee + initialBuy;

      const tx = await core.createCurve(
        address, // creator
        name,
        symbol,
        tokenURI,
        initialBuy,
        TOKEN_CONSTANTS.DEX_FEE_TIER,
        { value: totalValue }
      );

      const receipt = await tx.wait();

      // Parse events to get addresses
      const createEvent = receipt.logs.find(
        (log: { topics: string[] }) =>
          log.topics[0] === core.interface.getEvent('CreateCurve')?.topicHash
      );

      if (!createEvent) {
        throw new Error('CreateCurve event not found');
      }

      const parsed = core.interface.parseLog({
        topics: [...createEvent.topics],
        data: createEvent.data,
      });

      return {
        txHash: tx.hash,
        curveAddress: parsed?.args.curve,
        tokenAddress: parsed?.args.token,
      };
    },
    onSuccess: () => {
      // Invalidate token list to show new token
      queryClient.invalidateQueries({
        queryKey: queryKeys.tokens.all,
      });

      if (address) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.users.createdTokens(address),
        });
      }
    },
  });
}
