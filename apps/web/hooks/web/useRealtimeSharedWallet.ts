/**
 * Real-time Shared Wallet Hook
 *
 * Provides live updates for shared wallet data using Firebase onSnapshot.
 * Integrates with TanStack Query for cache updates.
 *
 * Mirrors mobile app's shared wallet real-time patterns from SharedWalletDetailsScreen.tsx
 */

import { useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/firebase';
import { FIRESTORE_COLLECTIONS, type SharedWallet, type SharedWalletMember } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharedWalletRealtimeUpdate {
  wallet: SharedWallet | null;
  members: SharedWalletMember[];
  hasChanges: boolean;
  lastUpdated: string;
}

export interface UseRealtimeSharedWalletOptions {
  /** Called when wallet data updates */
  onUpdate?: (update: SharedWalletRealtimeUpdate) => void;
  /** Called on listener errors */
  onError?: (error: Error) => void;
  /** Whether to automatically update TanStack Query cache (default: true) */
  updateQueryCache?: boolean;
  /** Whether the listener is enabled (default: true) */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Query keys (must match useSharedWalletDetail)
// ---------------------------------------------------------------------------

const sharedWalletQueryKeys = {
  detail: (walletId: string) => ['shared-wallet', walletId] as const,
  list: (userId: string) => ['shared-wallets', userId] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates for a shared wallet.
 *
 * @param walletFirebaseDocId - The Firestore document ID of the shared wallet
 * @param options - Configuration options
 * @returns Object with isListening state and manual stop function
 *
 * @example
 * ```tsx
 * const { isListening } = useRealtimeSharedWallet(wallet.firebaseDocId, {
 *   onUpdate: (update) => console.log('Wallet updated:', update.wallet),
 *   onError: (error) => console.error('Listener error:', error),
 * });
 * ```
 */
export function useRealtimeSharedWallet(
  walletFirebaseDocId: string | undefined | null,
  options: UseRealtimeSharedWalletOptions = {}
) {
  const {
    onUpdate,
    onError,
    updateQueryCache = true,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const isListeningRef = useRef(false);

  // Store latest callbacks in refs — prevents re-subscribing when callers pass inline functions
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Cleanup function
  const stopListening = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      isListeningRef.current = false;
      if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSharedWallet] Stopped listener for wallet:', walletFirebaseDocId);
    }
  }, [walletFirebaseDocId]);

  useEffect(() => {
    // Guard: don't start if disabled or no wallet ID
    if (!enabled || !walletFirebaseDocId) {
      stopListening();
      return;
    }

    // Stop any existing listener before starting new one
    stopListening();

    if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSharedWallet] Starting listener for wallet:', walletFirebaseDocId);

    const walletRef = doc(db, FIRESTORE_COLLECTIONS.SHARED_WALLETS, walletFirebaseDocId);

    const unsubscribe = onSnapshot(
      walletRef,
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const data = snapshot.data();

            // Parse shared wallet from Firestore data
            const wallet: SharedWallet = {
              id: data.id || snapshot.id,
              name: data.name || 'Unnamed Wallet',
              description: data.description,
              wallet_address: data.wallet_address || data.walletAddress || '',
              creator_id: data.creator_id || data.creatorId || '',
              members: parseMembers(data.members || []),
              balance: data.balance ?? data.totalBalance ?? 0,
              usdc_balance: data.usdc_balance ?? data.usdcBalance ?? data.balance ?? 0,
              sol_balance: data.sol_balance ?? data.solBalance ?? 0,
              currency: data.currency || 'USDC',
              created_at: parseTimestamp(data.created_at || data.createdAt),
              updated_at: parseTimestamp(data.updated_at || data.updatedAt),
              status: data.status || 'active',
              settings: data.settings,
            };

            const update: SharedWalletRealtimeUpdate = {
              wallet,
              members: wallet.members,
              hasChanges: true,
              lastUpdated: new Date().toISOString(),
            };

            // Update TanStack Query cache
            if (updateQueryCache) {
              queryClient.setQueryData(
                sharedWalletQueryKeys.detail(wallet.id),
                wallet
              );
            }

            // Call user callback
            onUpdateRef.current?.(update);

            if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSharedWallet] Wallet updated:', {
              id: wallet.id,
              name: wallet.name,
              balance: wallet.balance,
              memberCount: wallet.members.length,
            });
          } else {
            // Document doesn't exist
            const update: SharedWalletRealtimeUpdate = {
              wallet: null,
              members: [],
              hasChanges: true,
              lastUpdated: new Date().toISOString(),
            };

            onUpdateRef.current?.(update);
            console.warn('[useRealtimeSharedWallet] Wallet document not found:', walletFirebaseDocId);
          }
        } catch (error) {
          console.error('[useRealtimeSharedWallet] Error processing snapshot:', error);
          onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
        }
      },
      (error) => {
        console.error('[useRealtimeSharedWallet] Listener error:', error);
        onErrorRef.current?.(error);
      }
    );

    unsubscribeRef.current = unsubscribe;
    isListeningRef.current = true;

    // Cleanup on unmount or dependency change
    return () => {
      stopListening();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletFirebaseDocId, enabled, updateQueryCache, queryClient, stopListening]);
  // NOTE: onUpdate/onError intentionally omitted — stored in refs above

  return {
    isListening: isListeningRef.current,
    stopListening,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMembers(members: unknown[]): SharedWalletMember[] {
  if (!Array.isArray(members)) return [];

  return members.map((item) => {
    const m = item as Record<string, unknown>;
    const perms = (m.permissions || {}) as Record<string, unknown>;
    return {
      user_id: (m.user_id || m.userId || '') as string,
      role: (m.role || 'member') as 'creator' | 'admin' | 'member',
      permissions: {
        canInviteMembers: Boolean(perms.canInviteMembers ?? m.canInviteMembers ?? false),
        canWithdraw: Boolean(perms.canWithdraw ?? m.canWithdraw ?? false),
        canFund: Boolean(perms.canFund ?? m.canFund ?? true),
        canManageSettings: Boolean(perms.canManageSettings ?? m.canManageSettings ?? false),
        canRemoveMembers: Boolean(perms.canRemoveMembers ?? m.canRemoveMembers ?? false),
        canViewTransactions: Boolean(perms.canViewTransactions ?? m.canViewTransactions ?? true),
      },
      joined_at: parseTimestamp(m.joined_at || m.joinedAt),
      invited_by: (m.invited_by || m.invitedBy) as string | undefined,
      name: m.name as string | undefined,
      email: m.email as string | undefined,
      avatar: m.avatar as string | undefined,
      wallet_address: (m.wallet_address || m.walletAddress) as string | undefined,
    };
  });
}

function parseTimestamp(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

