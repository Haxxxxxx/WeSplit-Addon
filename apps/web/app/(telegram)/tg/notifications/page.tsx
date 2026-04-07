'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellSlash,
  PaperPlaneTilt,
  Wallet,
  ShieldCheck,
  Gift,
  Users,
  Gear,
  CheckCircle,
  Trash,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate, toDate } from '@/lib/utils';
import { useTelegramBackButton, useTelegramHaptic, tgConfirm } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/lib/firebase/queries';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import type { NotificationData } from '@/types';
import {
  notificationActionService,
} from '@/lib/services/notificationActionService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNotificationIcon(type: string) {
  switch (type) {
    case 'transaction':
      return PaperPlaneTilt;
    case 'shared_wallet':
    case 'member_joined':
    case 'member_removed':
      return Users;
    case 'security':
      return ShieldCheck;
    case 'reward':
    case 'referral':
      return Gift;
    case 'withdrawal_request':
    case 'withdrawal_approved':
    case 'withdrawal_rejected':
      return Wallet;
    case 'settings_changed':
      return Gear;
    default:
      return Bell;
  }
}

function getNotificationColor(type: string): string {
  switch (type) {
    case 'transaction':
      return 'var(--color-primary)';
    case 'security':
      return 'var(--color-error)';
    case 'reward':
    case 'referral':
      return 'var(--color-warning)';
    case 'withdrawal_rejected':
      return 'var(--color-error)';
    case 'withdrawal_approved':
      return 'var(--color-success)';
    default:
      return 'var(--color-text-secondary)';
  }
}

// ---------------------------------------------------------------------------
// Notification → Route resolver
// ---------------------------------------------------------------------------

function getNotificationHref(notification: NotificationData): string | null {
  const route = notificationActionService.getRoute(notification, 'tg');
  if (!route) return null;
  return notificationActionService.buildUrl(route);
}

// ---------------------------------------------------------------------------
// Notification Row
// ---------------------------------------------------------------------------

function NotificationRow({
  notification,
  onRead,
  onNavigate,
  onDelete,
}: {
  notification: NotificationData;
  onRead: (id: string) => void;
  onNavigate: (href: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = getNotificationIcon(notification.type);
  const color = getNotificationColor(notification.type);
  const isRead = notification.is_read || notification.read;
  const haptic = useTelegramHaptic();
  const href = getNotificationHref(notification);

  function handleTap() {
    if (!isRead) {
      haptic?.impactOccurred('light');
      onRead(notification.id);
    }
    if (href) {
      onNavigate(href);
    }
  }

  return (
    <div className="flex items-start gap-0">
      <button
        type="button"
        onClick={handleTap}
        className="flex flex-1 items-start gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/[0.04]"
        style={{
          opacity: isRead ? 0.6 : 1,
        }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
        >
          <Icon size={16} weight="fill" style={{ color }} />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {notification.title}
            </span>
            {!isRead && (
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--color-primary)' }}
              />
            )}
          </div>
          <span
            className="text-xs line-clamp-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {notification.body}
          </span>
          <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {formatDate(toDate(notification.created_at), { format: 'relative' })}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          haptic?.impactOccurred('light');
          onDelete(notification.id);
        }}
        className="shrink-0 p-3 mt-3 rounded-lg transition-colors active:bg-white/[0.06]"
        style={{ color: 'var(--color-text-tertiary)' }}
        aria-label="Delete notification"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TelegramNotificationsPage() {
  const router = useRouter();
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const queryClient = useQueryClient();

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const [markingAll, setMarkingAll] = useState(false);

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getUserNotifications(userId!),
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const unreadCount = notifications.filter((n) => !n.is_read && !n.read).length;

  const handleMarkRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id);
      queryClient.setQueryData<NotificationData[]>(
        ['notifications', userId],
        (old) =>
          old?.map((n) =>
            n.id === id ? { ...n, is_read: true, read: true } : n,
          ),
      );
    },
    [queryClient, userId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await tgConfirm('Delete this notification?');
      if (!confirmed) return;
      // Optimistic removal
      queryClient.setQueryData<NotificationData[]>(
        ['notifications', userId],
        (old) => old?.filter((n) => n.id !== id),
      );
      await deleteNotification(id);
    },
    [queryClient, userId],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!userId || markingAll) return;
    setMarkingAll(true);
    haptic?.impactOccurred('medium');
    try {
      await markAllNotificationsRead(userId);
      queryClient.setQueryData<NotificationData[]>(
        ['notifications', userId],
        (old) => old?.map((n) => ({ ...n, is_read: true, read: true })),
      );
    } finally {
      setMarkingAll(false);
    }
  }, [userId, markingAll, haptic, queryClient]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 animate-fade-in">
        <div className="h-8 w-40 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-white-10)' }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
        ))}
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="font-bold"
              style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-h2)' }}
            >
              Notifications
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {unreadCount > 0
                ? `${unreadCount} unread`
                : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              onClick={handleMarkAllRead}
              leftIcon={<CheckCircle size={16} />}
              loading={markingAll}
              disabled={markingAll}
            >
              Read all
            </Button>
          )}
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <BellSlash size={40} color="var(--color-text-tertiary)" />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No notifications yet
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                You&apos;ll be notified about payments, requests, and wallet activity.
              </p>
            </div>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div
              className="flex flex-col divide-y"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onRead={handleMarkRead}
                  onNavigate={(href) => router.push(href)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </PullToRefresh>
  );
}
