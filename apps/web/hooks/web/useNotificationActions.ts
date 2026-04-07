/**
 * Notification Actions Hook
 *
 * React hook for handling notification clicks and navigation.
 * Integrates with Next.js router and TanStack Query for state updates.
 */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  notificationActionService,
  type NotificationRoute,
  type NotificationActionResult,
  type NotificationGroup,
  type NotificationFilter,
} from '@/lib/services/notificationActionService';
import { FIRESTORE_COLLECTIONS, type NotificationData } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseNotificationActionsReturn {
  /** Handle a notification click - marks as read and navigates */
  handleNotificationClick: (notification: NotificationData) => Promise<void>;
  /** Mark a notification as read without navigating */
  markAsRead: (notificationId: string) => Promise<void>;
  /** Mark multiple notifications as read */
  markMultipleAsRead: (notificationIds: string[]) => Promise<void>;
  /** Get the URL for a notification */
  getNotificationUrl: (notification: NotificationData) => string | null;
  /** Group notifications by date */
  groupByDate: (notifications: NotificationData[]) => NotificationGroup[];
  /** Filter notifications by category */
  filterNotifications: (notifications: NotificationData[], filter: NotificationFilter) => NotificationData[];
  /** Get display title for notification type */
  getTitle: (notification: NotificationData) => string;
  /** Get display message for notification */
  getMessage: (notification: NotificationData) => string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for handling notification actions.
 *
 * @param userId - Current user ID for cache invalidation
 * @returns Notification action handlers
 *
 * @example
 * ```tsx
 * const { handleNotificationClick, groupByDate } = useNotificationActions(userId);
 *
 * const groups = groupByDate(notifications);
 *
 * return groups.map(group => (
 *   <div key={group.date}>
 *     <h3>{group.dateLabel}</h3>
 *     {group.notifications.map(n => (
 *       <NotificationItem
 *         key={n.id}
 *         notification={n}
 *         onClick={() => handleNotificationClick(n)}
 *       />
 *     ))}
 *   </div>
 * ));
 * ```
 */
export function useNotificationActions(userId?: string | null): UseNotificationActionsReturn {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Invalidate notification queries after updates
  const invalidateNotifications = useCallback(() => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread', userId] });
    }
  }, [queryClient, userId]);

  // Mark a single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const notificationRef = doc(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS, notificationId);
        await updateDoc(notificationRef, {
          is_read: true,
          read: true,
          read_at: serverTimestamp(),
        });

        // Optimistically update the cache
        if (userId) {
          queryClient.setQueryData<NotificationData[]>(
            ['notifications', userId],
            (old) =>
              old?.map((n) =>
                n.id === notificationId ? { ...n, is_read: true, read: true } : n
              )
          );
        }

        invalidateNotifications();
      } catch (error) {
        console.error('[useNotificationActions] Failed to mark as read:', error);
      }
    },
    [userId, queryClient, invalidateNotifications]
  );

  // Mark multiple notifications as read
  const markMultipleAsRead = useCallback(
    async (notificationIds: string[]) => {
      try {
        const promises = notificationIds.map((id) => {
          const notificationRef = doc(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS, id);
          return updateDoc(notificationRef, {
            is_read: true,
            read: true,
            read_at: serverTimestamp(),
          });
        });

        await Promise.all(promises);

        // Optimistically update the cache
        if (userId) {
          const idsSet = new Set(notificationIds);
          queryClient.setQueryData<NotificationData[]>(
            ['notifications', userId],
            (old) =>
              old?.map((n) =>
                idsSet.has(n.id) ? { ...n, is_read: true, read: true } : n
              )
          );
        }

        invalidateNotifications();
      } catch (error) {
        console.error('[useNotificationActions] Failed to mark multiple as read:', error);
      }
    },
    [userId, queryClient, invalidateNotifications]
  );

  // Get URL for a notification
  const getNotificationUrl = useCallback((notification: NotificationData): string | null => {
    const route = notificationActionService.getRoute(notification);
    if (!route) return null;
    return notificationActionService.buildUrl(route);
  }, []);

  // Handle notification click - mark as read and navigate
  const handleNotificationClick = useCallback(
    async (notification: NotificationData) => {
      // Mark as read first
      if (!notification.is_read && !notification.read) {
        await markAsRead(notification.id);
      }

      // Get navigation route
      const url = getNotificationUrl(notification);
      if (url) {
        router.push(url);
      }
    },
    [markAsRead, getNotificationUrl, router]
  );

  // Memoized utility functions
  const groupByDate = useCallback(
    (notifications: NotificationData[]) => notificationActionService.groupByDate(notifications),
    []
  );

  const filterNotifications = useCallback(
    (notifications: NotificationData[], filter: NotificationFilter) =>
      notificationActionService.filter(notifications, filter),
    []
  );

  const getTitle = useCallback(
    (notification: NotificationData) =>
      notification.title || notificationActionService.getTitle(notification.type),
    []
  );

  const getMessage = useCallback(
    (notification: NotificationData) =>
      notification.message ||
      notificationActionService.getMessage(notification.type, notification.data || {}),
    []
  );

  return useMemo(
    () => ({
      handleNotificationClick,
      markAsRead,
      markMultipleAsRead,
      getNotificationUrl,
      groupByDate,
      filterNotifications,
      getTitle,
      getMessage,
    }),
    [
      handleNotificationClick,
      markAsRead,
      markMultipleAsRead,
      getNotificationUrl,
      groupByDate,
      filterNotifications,
      getTitle,
      getMessage,
    ]
  );
}

// ---------------------------------------------------------------------------
// Export types
// ---------------------------------------------------------------------------

export type { NotificationRoute, NotificationActionResult, NotificationGroup, NotificationFilter };
