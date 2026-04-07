'use client';

/**
 * Payment Request Hooks
 * TanStack Query hooks for payment request operations
 * Provides data fetching, mutations, and cache management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import {
  paymentRequestService,
  type PaymentRequest,
} from '@/lib/services/paymentRequestService';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const paymentRequestQueryKeys = {
  all: ['paymentRequests'] as const,
  lists: () => [...paymentRequestQueryKeys.all, 'list'] as const,
  received: (userId: string) => [...paymentRequestQueryKeys.lists(), 'received', userId] as const,
  sent: (userId: string) => [...paymentRequestQueryKeys.lists(), 'sent', userId] as const,
  details: () => [...paymentRequestQueryKeys.all, 'detail'] as const,
  detail: (requestId: string) => [...paymentRequestQueryKeys.details(), requestId] as const,
  pendingCount: (userId: string) => [...paymentRequestQueryKeys.all, 'pendingCount', userId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch payment requests received by the current user
 */
export function useReceivedPaymentRequests(options: { pendingOnly?: boolean } = {}) {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const { pendingOnly = true } = options;

  const result = useQuery({
    queryKey: paymentRequestQueryKeys.received(userId || ''),
    queryFn: async () => {
      const res = await paymentRequestService.getReceivedPaymentRequests(userId!, { pendingOnly });
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch received requests');
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
 * Fetch payment requests sent by the current user
 */
export function useSentPaymentRequests() {
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const result = useQuery({
    queryKey: paymentRequestQueryKeys.sent(userId || ''),
    queryFn: async () => {
      const res = await paymentRequestService.getSentPaymentRequests(userId!);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch sent requests');
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
 * Fetch a single payment request by ID
 */
export function usePaymentRequestDetail(requestId: string | undefined) {
  const result = useQuery({
    queryKey: paymentRequestQueryKeys.detail(requestId || ''),
    queryFn: async () => {
      const res = await paymentRequestService.getPaymentRequest(requestId!);
      if (!res.success || !res.request) {
        throw new Error(res.error || 'Payment request not found');
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
 * Fetch count of pending payment requests for badge display
 */
export function usePendingRequestsCount() {
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const result = useQuery({
    queryKey: paymentRequestQueryKeys.pendingCount(userId || ''),
    queryFn: () => paymentRequestService.getPendingRequestsCount(userId!),
    enabled: !!userId,
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

interface CreateRequestInput {
  recipientId: string;
  amount: number;
  currency?: string;
  description?: string;
  groupId?: string;
}

/**
 * Create a new payment request
 */
export function useCreatePaymentRequest() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async (input: CreateRequestInput) => {
      if (!currentUser?.id || !currentUser?.name) {
        throw new Error('User not authenticated');
      }

      const result = await paymentRequestService.createPaymentRequest({
        senderId: currentUser.id,
        senderName: currentUser.name,
        recipientId: input.recipientId,
        amount: input.amount,
        currency: input.currency || 'USDC',
        description: input.description,
        groupId: input.groupId,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create payment request');
      }

      return result.request!;
    },
    onSuccess: (request) => {
      // Invalidate sent requests list
      if (currentUser?.id) {
        queryClient.invalidateQueries({
          queryKey: paymentRequestQueryKeys.sent(currentUser.id),
        });
      }
      // Invalidate recipient's received requests (they may be viewing)
      queryClient.invalidateQueries({
        queryKey: paymentRequestQueryKeys.received(request.recipientId),
      });
      // Set the new request in cache
      queryClient.setQueryData(paymentRequestQueryKeys.detail(request.id), request);
    },
  });
}

/**
 * Accept a payment request
 */
export function useAcceptPaymentRequest() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const result = await paymentRequestService.acceptPaymentRequest(
        requestId,
        currentUser.id
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to accept payment request');
      }

      return result.request!;
    },
    onSuccess: (request) => {
      // Invalidate all related queries
      if (currentUser?.id) {
        queryClient.invalidateQueries({
          queryKey: paymentRequestQueryKeys.received(currentUser.id),
        });
        queryClient.invalidateQueries({
          queryKey: paymentRequestQueryKeys.pendingCount(currentUser.id),
        });
      }
      // Invalidate sender's sent requests
      queryClient.invalidateQueries({
        queryKey: paymentRequestQueryKeys.sent(request.senderId),
      });
      // Update cached detail
      queryClient.setQueryData(paymentRequestQueryKeys.detail(request.id), request);
    },
  });
}

/**
 * Reject a payment request
 */
export function useRejectPaymentRequest() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const result = await paymentRequestService.rejectPaymentRequest(
        requestId,
        currentUser.id,
        reason
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to reject payment request');
      }

      return result.request!;
    },
    onSuccess: (request) => {
      if (currentUser?.id) {
        queryClient.invalidateQueries({
          queryKey: paymentRequestQueryKeys.received(currentUser.id),
        });
        queryClient.invalidateQueries({
          queryKey: paymentRequestQueryKeys.pendingCount(currentUser.id),
        });
      }
      queryClient.invalidateQueries({
        queryKey: paymentRequestQueryKeys.sent(request.senderId),
      });
      queryClient.setQueryData(paymentRequestQueryKeys.detail(request.id), request);
    },
  });
}

/**
 * Cancel a payment request (sender only)
 */
export function useCancelPaymentRequest() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const result = await paymentRequestService.cancelPaymentRequest(
        requestId,
        currentUser.id
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel payment request');
      }

      return result.request!;
    },
    onSuccess: (request) => {
      if (currentUser?.id) {
        queryClient.invalidateQueries({
          queryKey: paymentRequestQueryKeys.sent(currentUser.id),
        });
      }
      // Invalidate recipient's received requests
      queryClient.invalidateQueries({
        queryKey: paymentRequestQueryKeys.received(request.recipientId),
      });
      queryClient.invalidateQueries({
        queryKey: paymentRequestQueryKeys.pendingCount(request.recipientId),
      });
      queryClient.setQueryData(paymentRequestQueryKeys.detail(request.id), request);
    },
  });
}

/**
 * Send a payment reminder for a pending request
 */
export function useSendPaymentReminder() {
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const result = await paymentRequestService.sendPaymentReminder(
        requestId,
        currentUser.id
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send reminder');
      }

      return result.request!;
    },
    // No cache invalidation needed - just sends a notification
  });
}

// ---------------------------------------------------------------------------
// Computed Helpers
// ---------------------------------------------------------------------------

/**
 * Check if current user is the sender of a payment request
 */
export function useIsRequestSender(request: PaymentRequest | undefined): boolean {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  if (!request || !userId) return false;
  return request.senderId === userId;
}

/**
 * Check if current user is the recipient of a payment request
 */
export function useIsRequestRecipient(request: PaymentRequest | undefined): boolean {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  if (!request || !userId) return false;
  return request.recipientId === userId;
}
