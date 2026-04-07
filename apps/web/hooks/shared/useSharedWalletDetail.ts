'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getSharedWalletById,
  getSharedWalletTransactions,
} from '@/lib/firebase/queries';

/**
 * Fetches a single shared wallet by ID, plus its transaction history.
 */
export function useSharedWalletDetail(walletId: string) {
  const walletQuery = useQuery({
    queryKey: ['sharedWallet', walletId],
    queryFn: () => getSharedWalletById(walletId),
    enabled: !!walletId,
    staleTime: 30_000,
  });

  const txQuery = useQuery({
    queryKey: ['sharedWalletTransactions', walletId],
    queryFn: () => getSharedWalletTransactions(walletId),
    enabled: !!walletId,
    staleTime: 30_000,
  });

  return {
    wallet: walletQuery.data ?? null,
    transactions: txQuery.data ?? [],
    isLoading: walletQuery.isLoading || txQuery.isLoading,
    isRefetching: walletQuery.isRefetching || txQuery.isRefetching,
    error: walletQuery.error || txQuery.error,
    refetch: async () => {
      await Promise.all([walletQuery.refetch(), txQuery.refetch()]);
    },
  };
}
