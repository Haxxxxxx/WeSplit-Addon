/**
 * Real-time Splits Hook
 *
 * Provides live updates for split data using Firebase onSnapshot.
 * Integrates with TanStack Query for cache updates.
 *
 * Mirrors mobile app's SplitRealtimeService.ts patterns.
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/firebase';
import {
  FIRESTORE_COLLECTIONS,
  type SplitStatus,
  type SplitStorageStatus,
} from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Split participant from Firestore (realtime listener shape — differs from canonical types/split.ts) */
export interface RealtimeSplitParticipant {
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  walletAddress?: string;
  amount: number;
  status: SplitStorageStatus;
  paidAt?: string;
  joinedAt?: string;
}

/** Split document from Firestore (realtime listener shape — differs from canonical types/split.ts) */
export interface RealtimeSplit {
  id: string;
  firebaseDocId?: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: string;
  creatorId: string;
  creatorName?: string;
  participants: RealtimeSplitParticipant[];
  status: SplitStatus;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  walletAddress?: string;
}

export interface SplitRealtimeUpdate {
  split: RealtimeSplit | null;
  participants: RealtimeSplitParticipant[];
  hasChanges: boolean;
  lastUpdated: string;
}

export interface UseRealtimeSplitOptions {
  /** Called when split data updates */
  onUpdate?: (update: SplitRealtimeUpdate) => void;
  /** Called when participant data changes */
  onParticipantUpdate?: (participants: RealtimeSplitParticipant[]) => void;
  /** Called on listener errors */
  onError?: (error: Error) => void;
  /** Whether to automatically update TanStack Query cache (default: true) */
  updateQueryCache?: boolean;
  /** Whether the listener is enabled (default: true) */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Query keys (must match useSplits)
// ---------------------------------------------------------------------------

const splitQueryKeys = {
  detail: (splitId: string) => ['split', splitId] as const,
  list: (userId: string) => ['splits', userId] as const,
};

// ---------------------------------------------------------------------------
// Hook: Single Split
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates for a single split.
 *
 * @param splitId - The split ID (not the Firestore doc ID)
 * @param options - Configuration options
 * @returns Object with isListening state and manual stop function
 *
 * @example
 * ```tsx
 * const { isListening } = useRealtimeSplit(splitId, {
 *   onUpdate: (update) => console.log('Split updated:', update.split?.status),
 *   onParticipantUpdate: (participants) => console.log('Participants:', participants.length),
 * });
 * ```
 */
export function useRealtimeSplit(
  splitId: string | undefined | null,
  options: UseRealtimeSplitOptions = {}
) {
  const {
    onUpdate,
    onParticipantUpdate,
    onError,
    updateQueryCache = true,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const isListeningRef = useRef(false);
  const firebaseDocIdRef = useRef<string | null>(null);

  // Store latest callbacks in refs — prevents re-subscribing when callers pass inline functions
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onParticipantUpdateRef = useRef(onParticipantUpdate);
  onParticipantUpdateRef.current = onParticipantUpdate;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Cleanup function
  const stopListening = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      isListeningRef.current = false;
      firebaseDocIdRef.current = null;
      if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSplit] Stopped listener for split:', splitId);
    }
  }, [splitId]);

  useEffect(() => {
    // Guard: don't start if disabled or no split ID
    if (!enabled || !splitId) {
      stopListening();
      return;
    }

    let isCancelled = false;

    const startListener = async () => {
      try {
        // Stop any existing listener
        stopListening();

        if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSplit] Starting listener for split:', splitId);

        // Find the Firestore document ID by querying the split ID field
        // (Mobile pattern: splits collection stores custom ID in 'id' field)
        const q = query(
          collection(db, FIRESTORE_COLLECTIONS.SPLITS),
          where('id', '==', splitId)
        );

        const querySnapshot = await getDocs(q);

        if (isCancelled) return;

        if (querySnapshot.empty) {
          console.warn('[useRealtimeSplit] No document found for split:', splitId);
          onError?.(new Error(`Split with ID ${splitId} not found`));
          return;
        }

        const firstDoc = querySnapshot.docs[0];
        if (!firstDoc) {
          console.warn('[useRealtimeSplit] No document found for split:', splitId);
          onError?.(new Error(`Split with ID ${splitId} not found`));
          return;
        }
        const firebaseDocId = firstDoc.id;
        firebaseDocIdRef.current = firebaseDocId;

        if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSplit] Found document with firebaseDocId:', firebaseDocId);

        const splitRef = doc(db, FIRESTORE_COLLECTIONS.SPLITS, firebaseDocId);

        const unsubscribe = onSnapshot(
          splitRef,
          (snapshot) => {
            try {
              if (snapshot.exists()) {
                const data = snapshot.data();

                const split: RealtimeSplit = {
                  id: data.id || splitId,
                  firebaseDocId: snapshot.id,
                  title: data.title || 'Untitled Split',
                  description: data.description,
                  totalAmount: data.totalAmount ?? data.total_amount ?? 0,
                  currency: data.currency || 'USDC',
                  creatorId: data.creatorId || data.creator_id || '',
                  creatorName: data.creatorName || data.creator_name,
                  participants: parseParticipants(data.participants || []),
                  status: data.status || 'pending',
                  createdAt: parseTimestamp(data.createdAt || data.created_at),
                  updatedAt: parseTimestamp(data.updatedAt || data.updated_at),
                  completedAt: data.completedAt || data.completed_at
                    ? parseTimestamp(data.completedAt || data.completed_at)
                    : undefined,
                  walletAddress: data.walletAddress || data.wallet_address,
                };

                const update: SplitRealtimeUpdate = {
                  split,
                  participants: split.participants,
                  hasChanges: true,
                  lastUpdated: new Date().toISOString(),
                };

                // Update TanStack Query cache
                if (updateQueryCache) {
                  queryClient.setQueryData(splitQueryKeys.detail(splitId), split);
                }

                // Call user callbacks
                onUpdateRef.current?.(update);
                onParticipantUpdateRef.current?.(split.participants);

                if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSplit] Split updated:', {
                  id: split.id,
                  title: split.title,
                  status: split.status,
                  participantsCount: split.participants.length,
                });
              } else {
                // Document deleted
                const update: SplitRealtimeUpdate = {
                  split: null,
                  participants: [],
                  hasChanges: true,
                  lastUpdated: new Date().toISOString(),
                };

                onUpdateRef.current?.(update);
                console.warn('[useRealtimeSplit] Split document not found:', splitId);
              }
            } catch (error) {
              console.error('[useRealtimeSplit] Error processing snapshot:', error);
              onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
            }
          },
          (error) => {
            console.error('[useRealtimeSplit] Listener error:', error);
            onErrorRef.current?.(error);
          }
        );

        unsubscribeRef.current = unsubscribe;
        isListeningRef.current = true;
      } catch (error) {
        console.error('[useRealtimeSplit] Failed to start listener:', error);
        onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    startListener();

    // Cleanup on unmount or dependency change
    return () => {
      isCancelled = true;
      stopListening();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitId, enabled, updateQueryCache, queryClient, stopListening]);
  // NOTE: onUpdate/onParticipantUpdate/onError intentionally omitted — stored in refs above

  return {
    isListening: isListeningRef.current,
    stopListening,
    firebaseDocId: firebaseDocIdRef.current,
  };
}

// ---------------------------------------------------------------------------
// Hook: Multiple Splits (User's splits)
// ---------------------------------------------------------------------------

export interface UseRealtimeSplitsListOptions {
  /** Called when any split in the list updates */
  onUpdate?: (splits: RealtimeSplit[]) => void;
  /** Called on listener errors */
  onError?: (error: Error) => void;
  /** Whether to automatically update TanStack Query cache (default: true) */
  updateQueryCache?: boolean;
  /** Whether the listener is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Subscribe to real-time updates for all splits where the user is a participant.
 *
 * @param userId - The user ID to filter splits by
 * @param options - Configuration options
 * @returns Object with isListening state, current splits, and stop function
 *
 * @example
 * ```tsx
 * const { splits, isListening } = useRealtimeSplitsList(userId, {
 *   onUpdate: (splits) => console.log('Splits updated:', splits.length),
 * });
 * ```
 */
export function useRealtimeSplitsList(
  userId: string | undefined | null,
  options: UseRealtimeSplitsListOptions = {}
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
  const splitsRef = useRef<RealtimeSplit[]>([]);

  // Store latest callbacks in refs — prevents re-subscribing when callers pass inline functions
  const onUpdateListRef = useRef(onUpdate);
  onUpdateListRef.current = onUpdate;
  const onErrorListRef = useRef(onError);
  onErrorListRef.current = onError;

  // Cleanup function
  const stopListening = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      isListeningRef.current = false;
      if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSplitsList] Stopped listener for user:', userId);
    }
  }, [userId]);

  useEffect(() => {
    // Guard: don't start if disabled or no user ID
    if (!enabled || !userId) {
      stopListening();
      return;
    }

    // Stop any existing listener
    stopListening();

    if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeSplitsList] Starting listener for user:', userId);

    // Query splits where user is the creator
    const creatorQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.SPLITS),
      where('creatorId', '==', userId)
    );

    // Query splits where user is a participant (using denormalized participantIds array, AR-A8)
    // NOTE: Requires Firestore composite index on participantIds
    const participantQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.SPLITS),
      where('participantIds', 'array-contains', userId)
    );

    // Shared state for merging results from both listeners
    const creatorSplitsMap = new Map<string, RealtimeSplit>();
    const participantSplitsMap = new Map<string, RealtimeSplit>();

    function mergeAndPublish() {
      // Merge, dedup by firebaseDocId — creator takes priority
      const merged = new Map<string, RealtimeSplit>();
      for (const [id, split] of participantSplitsMap) merged.set(id, split);
      for (const [id, split] of creatorSplitsMap) merged.set(id, split);
      const splits = Array.from(merged.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      splitsRef.current = splits;
      if (updateQueryCache && userId) {
        queryClient.setQueryData(splitQueryKeys.list(userId), splits);
      }
      onUpdateListRef.current?.(splits);
    }

    function docToSplit(docSnap: { id: string; data: () => Record<string, unknown> }): RealtimeSplit {
      const data = docSnap.data();
      return {
        id: (data.id as string) || docSnap.id,
        firebaseDocId: docSnap.id,
        title: (data.title as string) || 'Untitled Split',
        description: data.description as string | undefined,
        totalAmount: (data.totalAmount as number) ?? (data.total_amount as number) ?? 0,
        currency: (data.currency as string) || 'USDC',
        creatorId: (data.creatorId as string) || (data.creator_id as string) || '',
        creatorName: (data.creatorName as string) || (data.creator_name as string),
        participants: parseParticipants((data.participants as unknown[]) || []),
        status: (data.status as SplitStatus) || 'pending',
        createdAt: parseTimestamp(data.createdAt || data.created_at),
        updatedAt: parseTimestamp(data.updatedAt || data.updated_at),
        completedAt: data.completedAt || data.completed_at
          ? parseTimestamp(data.completedAt || data.completed_at)
          : undefined,
        walletAddress: (data.walletAddress as string) || (data.wallet_address as string),
      };
    }

    const unsubscribeCreator = onSnapshot(
      creatorQuery,
      (snapshot) => {
        try {
          creatorSplitsMap.clear();
          snapshot.docs.forEach((docSnap) => {
            creatorSplitsMap.set(docSnap.id, docToSplit(docSnap));
          });
          mergeAndPublish();
        } catch (error) {
          console.error('[useRealtimeSplitsList] Creator listener error:', error);
          onErrorListRef.current?.(error instanceof Error ? error : new Error(String(error)));
        }
      },
      (error) => {
        console.error('[useRealtimeSplitsList] Creator listener error:', error);
        onErrorListRef.current?.(error);
      }
    );

    // Participant listener — graceful if index missing
    const unsubscribeParticipant = onSnapshot(
      participantQuery,
      (snapshot) => {
        try {
          participantSplitsMap.clear();
          snapshot.docs.forEach((docSnap) => {
            participantSplitsMap.set(docSnap.id, docToSplit(docSnap));
          });
          mergeAndPublish();
        } catch (error) {
          onErrorListRef.current?.(error instanceof Error ? error : new Error(String(error)));
          console.error('[useRealtimeSplitsList] Participant listener error:', error);
        }
      },
      () => {
        // Index may not exist yet — silently degrade to creator-only
        console.warn('[useRealtimeSplitsList] Participant query failed — create Firestore index for participantIds');
      }
    );

    // Store combined unsubscribe
    unsubscribeRef.current = () => {
      unsubscribeCreator();
      unsubscribeParticipant();
    };
    isListeningRef.current = true;

    // Cleanup on unmount or dependency change
    return () => {
      stopListening();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, enabled, updateQueryCache, queryClient, stopListening]);
  // NOTE: onUpdate/onError intentionally omitted — stored in refs above

  return {
    splits: splitsRef.current,
    isListening: isListeningRef.current,
    stopListening,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseParticipants(participants: unknown[]): RealtimeSplitParticipant[] {
  if (!Array.isArray(participants)) return [];

  return participants.map((item) => {
    const p = item as Record<string, unknown>;
    return {
      userId: (p.userId || p.user_id || '') as string,
      name: (p.name || 'Unknown') as string,
      email: p.email as string | undefined,
      avatar: p.avatar as string | undefined,
      walletAddress: (p.walletAddress || p.wallet_address) as string | undefined,
      amount: (p.amount ?? 0) as number,
      status: (p.status || 'pending') as SplitStorageStatus,
      paidAt: p.paidAt || p.paid_at
        ? parseTimestamp(p.paidAt || p.paid_at)
        : undefined,
      joinedAt: p.joinedAt || p.joined_at
        ? parseTimestamp(p.joinedAt || p.joined_at)
        : undefined,
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

