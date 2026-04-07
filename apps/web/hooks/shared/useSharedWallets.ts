'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import { getUserSharedWallets } from '@/lib/firebase/queries';

/**
 * Fetches shared wallets where the current user is a member.
 */
export function useSharedWallets() {
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const result = useQuery({
    queryKey: ['sharedWallets', userId],
    queryFn: () => getUserSharedWallets(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  return {
    wallets: result.data ?? [],
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}
