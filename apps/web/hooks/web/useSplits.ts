'use client';

/**
 * Split Wallet Hooks
 * TanStack Query hooks for split wallet operations
 * Provides data fetching, mutations, and cache management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import {
  SplitWalletService,
  createSplitWallet,
  getSplitWallet,
  getUserSplitWallets,
  updateParticipantStatus,
} from '@/lib/services/splitWalletService';
import {
  SplitPaymentService,
  recordParticipantPayment,
  getPaymentSummary,
  completeSplit,
  cancelSplit,
} from '@/lib/services/splitPaymentService';
import * as splitStorageService from '@/lib/services/splitStorageService';
import type {
  Split,
  SplitWallet,
  SplitResult,
  SplitWalletResult,
  PaymentResult,
  SplitStatus,
  ParticipantStatus,
} from '@/types';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const splitQueryKeys = {
  all: ['splits'] as const,
  lists: () => [...splitQueryKeys.all, 'list'] as const,
  list: (userId: string) => [...splitQueryKeys.lists(), userId] as const,
  details: () => [...splitQueryKeys.all, 'detail'] as const,
  detail: (splitId: string) => [...splitQueryKeys.details(), splitId] as const,
  wallets: () => [...splitQueryKeys.all, 'wallets'] as const,
  wallet: (walletId: string) => [...splitQueryKeys.wallets(), walletId] as const,
  walletByBill: (billId: string) => [...splitQueryKeys.wallets(), 'bill', billId] as const,
  userWallets: (userId: string) => [...splitQueryKeys.wallets(), 'user', userId] as const,
  paymentSummary: (walletId: string) => [...splitQueryKeys.wallets(), walletId, 'summary'] as const,
};

// ---------------------------------------------------------------------------
// Split Storage Queries (splits collection)
// ---------------------------------------------------------------------------

/**
 * Fetch all splits for the current user
 * Returns splits where user is creator OR participant
 */
export function useSplits() {
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const result = useQuery({
    queryKey: splitQueryKeys.list(userId || ''),
    queryFn: async () => {
      const res = await splitStorageService.getUserSplits(userId!);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch splits');
      }
      return res.splits || [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  return {
    splits: result.data ?? [],
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Fetch a single split by ID
 */
export function useSplitDetail(splitId: string | undefined) {
  const result = useQuery({
    queryKey: splitQueryKeys.detail(splitId || ''),
    queryFn: async () => {
      const res = await splitStorageService.getSplit(splitId!);
      if (!res.success || !res.split) {
        throw new Error(res.error || 'Split not found');
      }
      return res.split;
    },
    enabled: !!splitId,
    staleTime: 15_000,
  });

  return {
    split: result.data,
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}

// ---------------------------------------------------------------------------
// Split Wallet Queries (splitWallets collection)
// ---------------------------------------------------------------------------

/**
 * Fetch all split wallets for the current user
 */
export function useSplitWallets() {
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const result = useQuery({
    queryKey: splitQueryKeys.userWallets(userId || ''),
    queryFn: async () => {
      const res = await getUserSplitWallets(userId!);
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch split wallets');
      }
      return res.wallets || [];
    },
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

/**
 * Fetch a single split wallet by ID
 */
export function useSplitWalletDetail(walletId: string | undefined) {
  const result = useQuery({
    queryKey: splitQueryKeys.wallet(walletId || ''),
    queryFn: async () => {
      const res = await getSplitWallet(walletId!);
      if (!res.success || !res.wallet) {
        throw new Error(res.error || 'Split wallet not found');
      }
      return res.wallet;
    },
    enabled: !!walletId,
    staleTime: 15_000,
  });

  return {
    wallet: result.data,
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}

/**
 * Fetch payment summary for a split wallet
 */
export function useSplitPaymentSummary(walletId: string | undefined) {
  const result = useQuery({
    queryKey: splitQueryKeys.paymentSummary(walletId || ''),
    queryFn: async () => {
      const res = await getPaymentSummary(walletId!);
      if (!res.success || !res.summary) {
        throw new Error(res.error || 'Failed to fetch payment summary');
      }
      return res.summary;
    },
    enabled: !!walletId,
    staleTime: 10_000, // Shorter stale time for payment data
  });

  return {
    summary: result.data,
    isLoading: result.isLoading,
    isRefetching: result.isRefetching,
    error: result.error,
    refetch: result.refetch,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

interface CreateSplitInput {
  title: string;
  description?: string;
  totalAmount: number;
  currency?: string;
  category?: string;
  splitMethod?: 'equal' | 'manual';
  participants: Array<{
    userId: string;
    name: string;
    email?: string;
    walletAddress: string;
    amountOwed: number;
  }>;
  items?: Array<{
    name: string;
    price: number;
    quantity?: number;
    participants: string[];
  }>;
  merchant?: {
    name: string;
    address?: string;
  };
}

/**
 * Generate a unique item ID
 */
function generateItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique bill ID
 */
function generateBillId(): string {
  return `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a new split with wallet
 */
export function useCreateSplit() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);
  // Prefer the live connected wallet address; fall back to saved web_wallet_address
  const connectedWalletAddress = useAppStore((s) => s.wallet.address);

  return useMutation({
    mutationFn: async (input: CreateSplitInput) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      // Resolve the wallet address: connected adapter > saved web_wallet_address > saved wallet_address
      const creatorWalletAddress =
        connectedWalletAddress ||
        currentUser.web_wallet_address ||
        currentUser.wallet_address;

      if (!creatorWalletAddress) {
        throw new Error(
          'No wallet connected. Please connect a Solana wallet to create a split.'
        );
      }

      // Generate a bill ID for this split
      const billId = generateBillId();

      // Create the split record first
      const splitResult = await splitStorageService.createSplit({
        billId,
        title: input.title,
        description: input.description,
        totalAmount: input.totalAmount,
        currency: input.currency || 'USDC',
        category: input.category,
        splitMethod: input.splitMethod || 'equal',
        creatorId: currentUser.id,
        creatorName: currentUser.name,
        participants: input.participants.map((p) => ({
          ...p,
          amountPaid: 0,
          status: 'pending' as const,
        })),
        // Generate IDs for items
        items: input.items?.map((item) => ({
          ...item,
          id: generateItemId(),
        })),
        merchant: input.merchant,
      });

      if (!splitResult.success || !splitResult.split) {
        throw new Error(splitResult.error || 'Failed to create split');
      }

      // Create the split wallet with a dedicated Solana keypair.
      // creatorWalletAddress = where the creator receives funds when the split completes.
      // The split wallet itself gets a freshly-generated keypair address (see splitWalletService).
      const walletResult = await createSplitWallet(
        splitResult.split.billId,
        currentUser.id,
        creatorWalletAddress,
        input.totalAmount,
        input.currency || 'USDC',
        input.participants.map((p) => ({
          userId: p.userId,
          name: p.name,
          walletAddress: p.walletAddress,
          amountOwed: p.amountOwed,
        }))
      );

      if (!walletResult.success) {
        // Split was created but wallet failed - log warning but return split
        console.warn('[useCreateSplit] Split wallet creation failed', walletResult.error);
      }

      return {
        split: splitResult.split,
        wallet: walletResult.wallet,
      };
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      if (currentUser?.id) {
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.list(currentUser.id) });
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.userWallets(currentUser.id) });
      }
      if (data.split) {
        queryClient.setQueryData(splitQueryKeys.detail(data.split.id), data.split);
      }
      if (data.wallet) {
        queryClient.setQueryData(splitQueryKeys.wallet(data.wallet.id), data.wallet);
      }
    },
  });
}

interface RecordPaymentInput {
  splitWalletId: string;
  amount: number;
  transactionSignature: string;
}

/**
 * Record a participant payment after wallet transaction
 */
export function useRecordSplitPayment() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const result = await recordParticipantPayment(
        input.splitWalletId,
        currentUser.id,
        input.amount,
        input.transactionSignature
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to record payment');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate wallet and summary queries
      queryClient.invalidateQueries({ queryKey: splitQueryKeys.wallet(variables.splitWalletId) });
      queryClient.invalidateQueries({
        queryKey: splitQueryKeys.paymentSummary(variables.splitWalletId),
      });
      if (currentUser?.id) {
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.list(currentUser.id) });
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.userWallets(currentUser.id) });
      }
    },
  });
}

/**
 * Complete a split (creator only)
 */
export function useCompleteSplit() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async (splitWalletId: string) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const result = await completeSplit(splitWalletId, currentUser.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete split');
      }

      return result;
    },
    onSuccess: (_, splitWalletId) => {
      queryClient.invalidateQueries({ queryKey: splitQueryKeys.wallet(splitWalletId) });
      queryClient.invalidateQueries({ queryKey: splitQueryKeys.paymentSummary(splitWalletId) });
      if (currentUser?.id) {
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.list(currentUser.id) });
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.userWallets(currentUser.id) });
      }
    },
  });
}

/**
 * Cancel a split (creator only, before any payments)
 */
export function useCancelSplit() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async (splitWalletId: string) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      const result = await cancelSplit(splitWalletId, currentUser.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel split');
      }

      return result;
    },
    onSuccess: (_, splitWalletId) => {
      queryClient.invalidateQueries({ queryKey: splitQueryKeys.wallet(splitWalletId) });
      if (currentUser?.id) {
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.list(currentUser.id) });
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.userWallets(currentUser.id) });
      }
    },
  });
}

/**
 * Update split status (for admin operations)
 */
export function useUpdateSplitStatus() {
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);

  return useMutation({
    mutationFn: async ({
      splitId,
      status,
    }: {
      splitId: string;
      status: SplitStatus;
    }) => {
      const result = await splitStorageService.updateSplitStatus(splitId, status);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update split status');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: splitQueryKeys.detail(variables.splitId) });
      if (currentUser?.id) {
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.list(currentUser.id) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Computed Helpers
// ---------------------------------------------------------------------------

/**
 * Check if current user is the creator of a split
 */
export function useIsSplitCreator(split: Split | undefined): boolean {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  if (!split || !userId) return false;
  return split.creatorId === userId;
}

/**
 * Check if current user is a participant in a split
 */
export function useIsSplitParticipant(split: Split | undefined): boolean {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  if (!split || !userId) return false;
  return split.participants.some((p) => p.userId === userId);
}

/**
 * Get current user's participant data from a split
 */
export function useCurrentUserSplitParticipant(split: Split | undefined) {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  if (!split || !userId) return undefined;
  return split.participants.find((p) => p.userId === userId);
}

/**
 * Get current user's participant data from a split wallet
 */
export function useCurrentUserWalletParticipant(wallet: SplitWallet | undefined) {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  if (!wallet || !userId) return undefined;
  return wallet.participants.find((p) => p.userId === userId);
}
