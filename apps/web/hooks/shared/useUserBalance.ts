'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import { getUserBalance } from '@/lib/firebase/queries';

/**
 * Fetches the current user's USDC and SOL balance.
 * Falls back to the Zustand store's wallet balance if Firestore has none.
 */
export function useUserBalance() {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const storeBalance = useAppStore((s) => s.wallet.balance);

  const result = useQuery({
    queryKey: ['userBalance', userId],
    queryFn: () => getUserBalance(userId!),
    enabled: !!userId,
    staleTime: 15_000, // balance is more time-sensitive
    refetchInterval: 30_000, // auto-refresh every 30s
  });

  const usdc = result.data?.usdc ?? storeBalance ?? 0;
  const sol = result.data?.sol ?? 0;

  return {
    usdc,
    sol,
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    refetch: result.refetch,
  };
}
