/**
 * Notifications State Slice
 * Manages notifications and notification-related state
 * Web adaptation — uses Firestore queries directly
 */

import { StateCreator } from 'zustand';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from 'firebase/firestore';
import type { NotificationData } from '@/types';
import type { NotificationsState, NotificationsActions, AppStore } from '../types';
import { db } from '@/lib/firebase';

// Helper: check if a notification is read (handles both is_read and read fields)
const isNotificationRead = (notification: NotificationData): boolean => {
  return notification.is_read !== undefined ? notification.is_read : (notification.read || false);
};

export const createNotificationsSlice: StateCreator<
  AppStore,
  [],
  [],
  NotificationsState & NotificationsActions
> = (set, get) => ({
  // Initial state
  notifications: [],
  isLoading: false,
  error: null,
  lastFetch: 0,
  unreadCount: 0,

  // Actions
  setNotifications: (notifications: NotificationData[]) => {
    const unreadCount = notifications.filter((n) => !isNotificationRead(n)).length;

    set((state) => ({
      notifications: {
        ...state.notifications,
        notifications,
        unreadCount,
        lastFetch: Date.now(),
        error: null,
      },
    }));
  },

  addNotification: (notification: NotificationData) => {
    set((state) => {
      const newNotifications = [notification, ...state.notifications.notifications];
      const unreadCount = newNotifications.filter((n) => !isNotificationRead(n)).length;

      return {
        notifications: {
          ...state.notifications,
          notifications: newNotifications,
          unreadCount,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[NotificationsSlice] Notification added', { notificationId: notification.id, type: notification.type });
  },

  updateNotification: (notificationId: string, updates: Partial<NotificationData>) => {
    set((state) => {
      const updatedNotifications = state.notifications.notifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, ...updates }
          : notification,
      );
      const unreadCount = updatedNotifications.filter((n) => !isNotificationRead(n)).length;

      return {
        notifications: {
          ...state.notifications,
          notifications: updatedNotifications,
          unreadCount,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[NotificationsSlice] Notification updated', { notificationId, updates: Object.keys(updates) });
  },

  removeNotification: (notificationId: string) => {
    set((state) => {
      const filteredNotifications = state.notifications.notifications.filter(
        (notification) => notification.id !== notificationId,
      );
      const unreadCount = filteredNotifications.filter((n) => !isNotificationRead(n)).length;

      return {
        notifications: {
          ...state.notifications,
          notifications: filteredNotifications,
          unreadCount,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[NotificationsSlice] Notification removed', { notificationId });
  },

  markAsRead: (notificationId: string) => {
    set((state) => {
      const updatedNotifications = state.notifications.notifications.map((notification) => {
        if (notification.id === notificationId) {
          return {
            ...notification,
            is_read: true,
            read_at: new Date().toISOString(),
          };
        }
        return notification;
      });
      const unreadCount = updatedNotifications.filter((n) => !isNotificationRead(n)).length;

      return {
        notifications: {
          ...state.notifications,
          notifications: updatedNotifications,
          unreadCount,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[NotificationsSlice] Notification marked as read', { notificationId });
  },

  markAllAsRead: () => {
    set((state) => {
      const updatedNotifications = state.notifications.notifications.map((notification) => ({
        ...notification,
        is_read: true,
        read_at: new Date().toISOString(),
      }));

      return {
        notifications: {
          ...state.notifications,
          notifications: updatedNotifications,
          unreadCount: 0,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[NotificationsSlice] All notifications marked as read');
  },

  setNotificationsLoading: (loading: boolean) => {
    set((state) => ({
      notifications: {
        ...state.notifications,
        isLoading: loading,
      },
    }));
  },

  setNotificationsError: (error: string | null) => {
    set((state) => ({
      notifications: {
        ...state.notifications,
        error,
      },
    }));
  },

  clearNotificationsError: () => {
    set((state) => ({
      notifications: {
        ...state.notifications,
        error: null,
      },
    }));
  },

  refreshNotifications: async () => {
    const currentUser = get().user.currentUser;
    if (!currentUser) {
      set((state) => ({
        notifications: {
          ...state.notifications,
          error: 'No user authenticated',
        },
      }));
      return;
    }

    set((state) => ({
      notifications: {
        ...state.notifications,
        isLoading: true,
        error: null,
      },
    }));

    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('user_id', '==', currentUser.id),
        orderBy('created_at', 'desc'),
        limit(50),
      );

      const snapshot = await getDocs(q);
      const notifications: NotificationData[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as NotificationData[];

      set((state) => ({
        notifications: {
          ...state.notifications,
          notifications,
          isLoading: false,
          error: null,
          lastFetch: Date.now(),
          unreadCount: notifications.filter((n) => !isNotificationRead(n)).length,
        },
      }));

      if (process.env.NODE_ENV !== 'production') console.log('[NotificationsSlice] Notifications refreshed', { userId: currentUser.id, count: notifications.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh notifications';

      set((state) => ({
        notifications: {
          ...state.notifications,
          isLoading: false,
          error: errorMessage,
        },
      }));

      console.error('[NotificationsSlice] Failed to refresh notifications', {
        userId: currentUser.id,
        error: errorMessage,
      });
    }
  },
});
