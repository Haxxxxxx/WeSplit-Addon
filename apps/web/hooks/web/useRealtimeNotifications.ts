/**
 * Real-time Notifications Hook
 *
 * Provides live updates for user notifications using Firebase onSnapshot.
 * Integrates with TanStack Query for cache updates.
 *
 * Features:
 * - Live notification feed with instant updates
 * - Unread count tracking
 * - Automatic cache synchronization
 * - Proper cleanup on unmount
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/firebase';
import { FIRESTORE_COLLECTIONS, type NotificationData, type NotificationType } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationRealtimeUpdate {
  notifications: NotificationData[];
  unreadCount: number;
  hasChanges: boolean;
  lastUpdated: string;
}

export interface UseRealtimeNotificationsOptions {
  /** Maximum number of notifications to fetch (default: 50) */
  maxNotifications?: number;
  /** Called when notifications update */
  onUpdate?: (update: NotificationRealtimeUpdate) => void;
  /** Called when a new notification arrives */
  onNewNotification?: (notification: NotificationData) => void;
  /** Called on listener errors */
  onError?: (error: Error) => void;
  /** Whether to automatically update TanStack Query cache (default: true) */
  updateQueryCache?: boolean;
  /** Whether the listener is enabled (default: true) */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const notificationQueryKeys = {
  list: (userId: string) => ['notifications', userId] as const,
  unreadCount: (userId: string) => ['notifications', 'unread', userId] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates for user notifications.
 *
 * @param userId - The user ID to fetch notifications for
 * @param options - Configuration options
 * @returns Object with notifications, unread count, and control functions
 *
 * @example
 * ```tsx
 * const { notifications, unreadCount, isListening } = useRealtimeNotifications(userId, {
 *   onNewNotification: (notification) => {
 *     toast.info(notification.title);
 *   },
 * });
 * ```
 */
export function useRealtimeNotifications(
  userId: string | undefined | null,
  options: UseRealtimeNotificationsOptions = {}
) {
  const {
    maxNotifications = 50,
    onUpdate,
    onNewNotification,
    onError,
    updateQueryCache = true,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const isListeningRef = useRef(false);
  const previousIdsRef = useRef<Set<string>>(new Set());

  // Store latest callbacks in refs so they never need to be in the effect dep array.
  // This prevents re-subscribing on every render when callers pass inline functions.
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onNewNotificationRef = useRef(onNewNotification);
  onNewNotificationRef.current = onNewNotification;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // State for reactive updates
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Cleanup function
  const stopListening = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      isListeningRef.current = false;
      if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeNotifications] Stopped listener for user:', userId);
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

    if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeNotifications] Starting listener for user:', userId);

    // Query notifications for this user, ordered by creation date (newest first)
    // Firestore supports both 'userId' and 'user_id' field naming conventions
    const notificationsQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      orderBy('created_at', 'desc'),
      limit(maxNotifications)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        try {
          const notificationList: NotificationData[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return parseNotification(docSnap.id, data);
          });

          // Calculate unread count
          const newUnreadCount = notificationList.filter((n) => !n.is_read && !n.read).length;

          // Detect new notifications (for onNewNotification callback)
          const currentIds = new Set(notificationList.map((n) => n.id));
          const previousIds = previousIdsRef.current;

          notificationList.forEach((notification) => {
            if (!previousIds.has(notification.id) && previousIds.size > 0) {
              // This is a new notification that wasn't in the previous snapshot
              onNewNotificationRef.current?.(notification);
            }
          });

          previousIdsRef.current = currentIds;

          // Update state
          setNotifications(notificationList);
          setUnreadCount(newUnreadCount);

          // Create update object
          const update: NotificationRealtimeUpdate = {
            notifications: notificationList,
            unreadCount: newUnreadCount,
            hasChanges: true,
            lastUpdated: new Date().toISOString(),
          };

          // Update TanStack Query cache
          if (updateQueryCache) {
            queryClient.setQueryData(notificationQueryKeys.list(userId), notificationList);
            queryClient.setQueryData(notificationQueryKeys.unreadCount(userId), newUnreadCount);
          }

          // Call user callback
          onUpdateRef.current?.(update);

          if (process.env.NODE_ENV !== 'production') console.debug('[useRealtimeNotifications] Notifications updated:', {
            count: notificationList.length,
            unread: newUnreadCount,
            userId,
          });
        } catch (error) {
          console.error('[useRealtimeNotifications] Error processing snapshot:', error);
          onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
        }
      },
      (error) => {
        // Handle permission errors gracefully (user might not have userId field indexed)
        if (error.code === 'failed-precondition') {
          console.warn('[useRealtimeNotifications] Index required, trying fallback query...');
          startFallbackListener();
        } else {
          console.error('[useRealtimeNotifications] Listener error:', error);
          onErrorRef.current?.(error);
        }
      }
    );

    unsubscribeRef.current = unsubscribe;
    isListeningRef.current = true;

    // Fallback listener using user_id field (legacy format)
    function startFallbackListener() {
      stopListening();

      const fallbackQuery = query(
        collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(maxNotifications)
      );

      const fallbackUnsubscribe = onSnapshot(
        fallbackQuery,
        (snapshot) => {
          try {
            const notificationList: NotificationData[] = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              return parseNotification(docSnap.id, data);
            });

            const newUnreadCount = notificationList.filter((n) => !n.is_read && !n.read).length;

            setNotifications(notificationList);
            setUnreadCount(newUnreadCount);

            const update: NotificationRealtimeUpdate = {
              notifications: notificationList,
              unreadCount: newUnreadCount,
              hasChanges: true,
              lastUpdated: new Date().toISOString(),
            };

            if (updateQueryCache && userId) {
              queryClient.setQueryData(notificationQueryKeys.list(userId), notificationList);
              queryClient.setQueryData(notificationQueryKeys.unreadCount(userId), newUnreadCount);
            }

            onUpdateRef.current?.(update);
          } catch (error) {
            console.error('[useRealtimeNotifications] Fallback error:', error);
            onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)));
          }
        },
        (error) => {
          console.error('[useRealtimeNotifications] Fallback listener error:', error);
          onErrorRef.current?.(error);
        }
      );

      unsubscribeRef.current = fallbackUnsubscribe;
      isListeningRef.current = true;
    }

    // Cleanup on unmount or dependency change
    return () => {
      stopListening();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, enabled, maxNotifications, updateQueryCache, queryClient, stopListening]);
  // NOTE: onUpdate/onNewNotification/onError are intentionally omitted — stored in refs above

  return {
    notifications,
    unreadCount,
    isListening: isListeningRef.current,
    stopListening,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNotification(docId: string, data: Record<string, unknown>): NotificationData {
  return {
    id: docId,
    userId: (data.userId || data.user_id || '') as string,
    user_id: (data.user_id || data.userId || '') as string,
    type: (data.type || 'general') as NotificationType,
    title: (data.title || '') as string,
    message: (data.message || data.body || '') as string,
    body: (data.body || data.message) as string | undefined,
    is_read: Boolean(data.is_read ?? data.read ?? false),
    read: Boolean(data.read ?? data.is_read ?? false),
    read_at: data.read_at as string | undefined,
    created_at: parseTimestamp(data.created_at || data.createdAt),
    data: data.data as Record<string, unknown> | undefined,
    action_url: data.action_url as string | undefined,
    icon: data.icon as string | undefined,
    status: data.status as 'pending' | 'paid' | 'cancelled' | undefined,
  };
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

