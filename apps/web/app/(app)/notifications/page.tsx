'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Bell,
  PaperPlaneTilt,
  HandCoins,
  UsersThree,
  Trophy,
  Check,
} from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton, SkeletonAvatar } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/firebase/queries';
import { useRealtimeNotifications } from '@/hooks/web/useRealtimeNotifications';
import {
  getNotificationRoute,
  buildNotificationUrl,
} from '@/lib/services/notificationActionService';
import { useAppStore } from '@/store';
import type { NotificationData } from '@/types';

// ---------------------------------------------------------------------------
// Internal display type (used for icon/color mapping)
// ---------------------------------------------------------------------------

type NotificationType = 'send' | 'receive' | 'request' | 'shared_wallet' | 'reward' | 'system';

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  send:          { icon: PaperPlaneTilt, color: 'var(--color-error)',   bg: 'var(--color-error-20)' },
  receive:       { icon: HandCoins,      color: 'var(--color-success)', bg: 'var(--color-success-20)' },
  request:       { icon: HandCoins,      color: 'var(--color-warning)', bg: 'var(--color-warning-20)' },
  shared_wallet: { icon: UsersThree,     color: 'var(--color-info)',    bg: 'var(--color-info-20)' },
  reward:        { icon: Trophy,         color: 'var(--color-primary)', bg: 'var(--color-primary-dim)' },
  system:        { icon: Bell,           color: 'var(--color-text-secondary)', bg: 'var(--color-white-10)' },
};

// ---------------------------------------------------------------------------
// Map Firestore NotificationData.type → internal display type
// ---------------------------------------------------------------------------

function resolveDisplayType(notif: NotificationData): NotificationType {
  const t = notif.type;

  if (t === 'shared_wallet' || t === 'member_joined' || t === 'member_removed' || t === 'settings_changed') {
    return 'shared_wallet';
  }
  if (t === 'reward' || t === 'referral') {
    return 'reward';
  }
  if (t === 'withdrawal_request' || t === 'withdrawal_approved' || t === 'withdrawal_rejected') {
    return 'shared_wallet';
  }
  if (t === 'security') {
    return 'system';
  }
  if (t === 'transaction') {
    // Distinguish send vs receive vs request using the data payload
    const txType = notif.data?.type as string | undefined;
    const action = notif.data?.action as string | undefined;

    if (action === 'request' || txType === 'request') return 'request';

    const fromUser = notif.data?.from_user as string | undefined;
    const toUser = notif.data?.to_user as string | undefined;

    // If the notification is on a user doc and from_user matches another user, it's a receive
    if (fromUser && fromUser !== notif.user_id) return 'receive';
    if (toUser && toUser !== notif.user_id) return 'send';

    // Fall back to title/body heuristic
    const lc = (notif.title + ' ' + notif.body).toLowerCase();
    if (lc.includes('received') || lc.includes('sent you')) return 'receive';
    if (lc.includes('requested')) return 'request';
    if (lc.includes('confirmed') || lc.includes('sent')) return 'send';

    return 'system';
  }

  return 'system';
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { notifications } = useRealtimeNotifications(userId);
  const isLoading = !userId;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    },
  });

  const unreadCount = notifications.filter(
    (n) => !(n.is_read ?? n.read ?? true)
  ).length;

  function SkeletonRow() {
    return (
      <div className="flex items-start gap-3 px-5 py-4">
        <SkeletonAvatar size={40} />
        <div className="flex-1 flex flex-col gap-2 pt-1">
          <div className="flex justify-between gap-2">
            <Skeleton height={14} width="45%" radius="sm" />
            <Skeleton height={12} width="15%" radius="sm" />
          </div>
          <Skeleton height={13} width="80%" radius="sm" />
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        rightElement={
          unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              leftIcon={<Check size={14} weight="bold" />}
              disabled={markAllReadMutation.isPending}
            >
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </Card>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Bell size={48} color="var(--color-text-tertiary)" />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            All caught up!
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Notifications about your transactions and activity will appear here
          </p>
        </div>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {notifications.map((notif) => {
              const displayType = resolveDisplayType(notif);
              const { icon: Icon, color, bg } = TYPE_CONFIG[displayType];
              const isRead = notif.is_read ?? notif.read ?? true;
              const date = notif.created_at
                ? new Date(
                    typeof notif.created_at === 'string'
                      ? notif.created_at
                      : (notif.created_at as unknown as { toDate?: () => Date }).toDate?.() ?? notif.created_at
                  )
                : new Date();

              return (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    if (!isRead) markReadMutation.mutate(notif.id);
                    const route = getNotificationRoute(notif);
                    if (route) router.push(buildNotificationUrl(route));
                  }}
                  className={cn(
                    'flex items-start gap-3 px-5 py-4 text-left w-full transition-colors hover:bg-white/[0.03]',
                    !isRead && 'bg-[var(--color-primary)]/[0.03]'
                  )}
                >
                  {/* Icon */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full mt-0.5"
                    style={{ backgroundColor: bg }}
                  >
                    <Icon size={18} color={color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {notif.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {formatDate(date, { format: 'relative' })}
                        </span>
                        {!isRead && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                          />
                        )}
                      </div>
                    </div>
                    <p className="text-sm leading-normal" style={{ color: 'var(--color-text-secondary)' }}>
                      {notif.body}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
