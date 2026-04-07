'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import { getUserTransactions } from '@/lib/firebase/queries';

/**
 * Fetches the current user's transactions from Firestore.
 * Returns TanStack Query state — use `isLoading` for skeletons,
 * `refetch` for pull-to-refresh.
 */
export function useTransactions(maxResults = 50) {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey: ['transactions', userId, maxResults],
    queryFn: () => getUserTransactions(userId!, maxResults),
    enabled: !!userId,
    staleTime: 30_000, // 30s
  });

  return {
    transactions: result.data ?? [],
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}
