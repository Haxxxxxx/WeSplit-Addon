'use client';

/**
 * Withdrawal Approval Hooks
 * TanStack Query hooks for withdrawal request operations
 * Provides data fetching, mutations, and cache management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import { withdrawalApprovalService } from '@/lib/services/withdrawalApprovalService';
import type { WithdrawalRequest } from '@/types';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const withdrawalQueryKeys = {
  all: ['withdrawalRequests'] as const,
  lists: () => [...withdrawalQueryKeys.all, 'list'] as const,
  wallet: (walletId: string) => [...withdrawalQueryKeys.lists(), 'wallet', walletId] as const,
  walletPending: (walletId: string) =>
    [...withdrawalQueryKeys.lists(), 'wallet', walletId, 'pending'] as const,
  user: (userId: string) => [...withdrawalQueryKeys.lists(), 'user', userId] as const,
  details: () => [...withdrawalQueryKeys.all, 'detail'] as const,
  detail: (requestId: string) => [...withdrawalQueryKeys.details(), requestId] as const,
  pendingCount: (walletId: string) =>
    [...withdrawalQueryKeys.all, 'pendingCount', walletId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all withdrawal requests for a shared wallet
 */
export function useWalletWithdrawalRequests(
  walletId: string | undefined,
  options: { pendingOnly?: boolean } = {}
) {
  const { pendingOnly = false } = options;

  const result = useQuery({
    queryKey: pendingOnly
      ? withdrawalQueryKeys.walletPending(walletId || '')
      : withdrawalQueryKeys.wallet(walletId || ''),
    queryFn: async () => {
      const res = await withdrawalApprovalService.getWalletWithdrawalRequests(walletId!, {
        pendingOnly,
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch withdrawal requests');
      }
      return res.requests || [];
    },
    enabled: !!walletId,
    staleTime: 30_000,
  });

  return {
    requests: result.data ?? [],
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Fetch withdrawal requests created by the current user
 */
export function useUserWithdrawalRequests() {
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const result = useQuery({
    queryKey: withdrawalQueryKeys.user(userId || ''),
    queryFn: async () => {
      const res = await withdrawalApprovalService.getUserWithdrawalRequests(userId!);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch user withdrawal requests');
      }
      return res.requests || [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  return {
    requests: result.data ?? [],
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Fetch a single withdrawal request by ID
 */
export function useWithdrawalRequestDetail(requestId: string | undefined) {
  const result = useQuery({
    queryKey: withdrawalQueryKeys.detail(requestId || ''),
    queryFn: async () => {
      const res = await withdrawalApprovalService.getWithdrawalRequest(requestId!);
      if (!res.success || !res.request) {
        throw new Error(res.error || 'Withdrawal request not found');
      }
      return res.request;
    },
    enabled: !!requestId,
    staleTime: 15_000,
  });

  return {
    request: result.data,
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Fetch count of pending withdrawal requests for badge display
 */
export function usePendingWithdrawalCount(walletId: string | undefined) {
  const result = useQuery({
    queryKey: withdrawalQueryKeys.pendingCount(walletId || ''),
    queryFn: () => withdrawalApprovalService.getPendingWithdrawalCount(walletId!),
    enabled: !!walletId,
    staleTime: 60_000, // 1 minute
  });

  return {
    count: result.data ?? 0,
    isLoading: result.isLoading,
    refetch: result.refetch,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

interface CreateWithdrawalRequestInput {
  walletId: string;
  walletFirebaseDocId?: string;
  amount: number;
  destinationAddress: string;
  currency?: string;
  memo?: string;
  fee?: number;
  netAmount?: number;
}

/**
 * Create a new withdrawal request
 */
export function useCreateWithdrawalRequest() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async (input: CreateWithdrawalRequestInput) => {
      if (!currentUser?.id || !currentUser?.name) {
        throw new Error('User not authenticated');
      }

      const result = await withdrawalApprovalService.createWithdrawalRequest({
        walletId: input.walletId,
        walletFirebaseDocId: input.walletFirebaseDocId,
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        amount: input.amount,
        currency: input.currency || 'USDC',
        destinationAddress: input.destinationAddress,
        memo: input.memo,
        fee: input.fee,
        netAmount: input.netAmount,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create withdrawal request');
      }

      return result.request!;
    },
    onSuccess: (request, variables) => {
      // Invalidate wallet's withdrawal requests
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.wallet(variables.walletId),
      });
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.walletPending(variables.walletId),
      });
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.pendingCount(variables.walletId),
      });
      // Invalidate user's requests
      if (currentUser?.id) {
        queryClient.invalidateQueries({
          queryKey: withdrawalQueryKeys.user(currentUser.id),
        });
      }
      // Set the new request in cache
      queryClient.setQueryData(withdrawalQueryKeys.detail(request.id), request);
    },
  });
}

/**
 * Approve a withdrawal request
 */
export function useApproveWithdrawalRequest() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async ({
      requestId,
      walletId,
    }: {
      requestId: string;
      walletId: string;
    }) => {
      if (!currentUser?.id || !currentUser?.name) {
        throw new Error('User not authenticated');
      }

      const result = await withdrawalApprovalService.approveWithdrawalRequest(
        requestId,
        currentUser.id,
        currentUser.name
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to approve withdrawal request');
      }

      return { request: result.request!, walletId };
    },
    onSuccess: ({ request, walletId }) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.wallet(walletId),
      });
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.walletPending(walletId),
      });
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.pendingCount(walletId),
      });
      // Update cached detail
      queryClient.setQueryData(withdrawalQueryKeys.detail(request.id), request);
    },
  });
}

/**
 * Reject a withdrawal request
 */
export function useRejectWithdrawalRequest() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async ({
      requestId,
      walletId,
      reason,
    }: {
      requestId: string;
      walletId: string;
      reason?: string;
    }) => {
      if (!currentUser?.id || !currentUser?.name) {
        throw new Error('User not authenticated');
      }

      const result = await withdrawalApprovalService.rejectWithdrawalRequest(
        requestId,
        currentUser.id,
        currentUser.name,
        reason
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to reject withdrawal request');
      }

      return { request: result.request!, walletId };
    },
    onSuccess: ({ request, walletId }) => {
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.wallet(walletId),
      });
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.walletPending(walletId),
      });
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.pendingCount(walletId),
      });
      queryClient.setQueryData(withdrawalQueryKeys.detail(request.id), request);
    },
  });
}

/**
 * Mark a withdrawal as executed (after on-chain tx)
 */
export function useMarkWithdrawalExecuted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      walletId,
      txHash,
    }: {
      requestId: string;
      walletId: string;
      txHash: string;
    }) => {
      const result = await withdrawalApprovalService.markWithdrawalExecuted(
        requestId,
        txHash
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to mark withdrawal as executed');
      }

      return { request: result.request!, walletId };
    },
    onSuccess: ({ request, walletId }) => {
      queryClient.invalidateQueries({
        queryKey: withdrawalQueryKeys.wallet(walletId),
      });
      queryClient.setQueryData(withdrawalQueryKeys.detail(request.id), request);
    },
  });
}

// ---------------------------------------------------------------------------
// Computed Helpers
// ---------------------------------------------------------------------------

/**
 * Check if current user is the requester of a withdrawal request
 */
export function useIsWithdrawalRequester(
  request: { requester_id: string } | undefined
): boolean {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  if (!request || !userId) return false;
  return request.requester_id === userId;
}

/**
 * Check if current user can approve/reject a withdrawal request
 * (user must be admin/creator of the wallet and not the requester)
 */
export function useCanApproveWithdrawal(
  request: { requester_id: string } | undefined,
  wallet: { members: Array<{ user_id: string; role: string }> } | undefined
): boolean {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  if (!request || !wallet || !userId) return false;

  // Can't approve own request
  if (request.requester_id === userId) return false;

  // Must be admin or creator
  const member = wallet.members.find((m) => m.user_id === userId);
  return member?.role === 'creator' || member?.role === 'admin';
}
