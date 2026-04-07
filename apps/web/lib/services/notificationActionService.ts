/**
 * Notification Action Service
 *
 * Handles notification click actions and routing for the web app.
 * Ported from mobile's NotificationsScreen.tsx navigation logic.
 *
 * Key features:
 * - Route mapping for all 44+ notification types
 * - Action handlers for special notification types
 * - Notification grouping utilities
 * - Title/message generation from notification type
 */

import type { NotificationType, NotificationData } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Route configuration for notification navigation */
export interface NotificationRoute {
  /** Next.js route path */
  path: string;
  /** Query parameters for the route */
  params?: Record<string, string>;
}

/** Action result from handling a notification */
export interface NotificationActionResult {
  /** The route to navigate to, if any */
  route: NotificationRoute | null;
  /** Whether the notification requires special handling */
  requiresAction: boolean;
  /** Action type if special handling needed */
  actionType?: 'accept_split' | 'pay_request' | 'approve_withdrawal' | 'view_only';
  /** Error message if action failed */
  error?: string;
}

/** Notification group for display */
export interface NotificationGroup {
  date: string;
  dateLabel: string;
  notifications: NotificationData[];
}

// ---------------------------------------------------------------------------
// Route Mapping
// ---------------------------------------------------------------------------

/**
 * Get the navigation route for a notification.
 * Maps notification types to Next.js routes.
 *
 * @param notification - The notification to get the route for
 * @param platform - 'tg' to get Telegram Mini App routes (/tg/* prefix), 'web' (default) for web app routes
 */
export function getNotificationRoute(
  notification: NotificationData,
  platform: 'web' | 'tg' = 'web',
): NotificationRoute | null {
  if (platform === 'tg') return resolveTgRoute(notification);
  return resolveWebRoute(notification);
}

/**
 * Resolve the TG Mini App route for a notification.
 * TG routes differ from web routes in several ways:
 * - Shared wallets: /tg/wallets/[walletId] (not /shared-wallets)
 * - Splits: /tg/splits/[id] (not /splits/[splitId])
 * - Dashboard: /tg (not /tg/dashboard)
 * @internal
 */
function resolveTgRoute(notification: NotificationData): NotificationRoute | null {
  const type = notification.type;
  const data = notification.data || {};

  // Transaction notifications
  if (
    type === 'payment_sent' ||
    type === 'payment_received' ||
    type === 'money_sent' ||
    type === 'money_received'
  ) {
    const txId = (data.transactionId || data.tx_hash || data.signature) as string | undefined;
    if (txId) return { path: '/tg/transactions/[txId]', params: { txId } };
    return { path: '/tg/transactions' };
  }

  // Payment request → TG send page
  if (type === 'payment_request') {
    const requestId = (data.requestId || data.id) as string | undefined;
    if (requestId) {
      return {
        path: '/tg/send',
        params: {
          requestId,
          amount: String(data.amount || ''),
          recipientId: (data.senderId || data.fromUserId) as string || '',
        },
      };
    }
    return { path: '/tg/send' };
  }

  // Payment reminder → TG home or specific split
  if (type === 'payment_reminder') {
    const splitId = data.splitId as string | undefined;
    if (splitId) return { path: '/tg/splits/[id]', params: { id: splitId } };
    return { path: '/tg' };
  }

  // Split notifications — TG uses [id] not [splitId]
  if (
    type === 'split_invite' ||
    type === 'split_payment_required' ||
    type === 'split_completed' ||
    type === 'split_confirmed' ||
    type === 'split_accepted' ||
    type === 'split_paid' ||
    type === 'split_winner' ||
    type === 'split_loser' ||
    type === 'split_spin_available' ||
    type === 'split_lock_required' ||
    type === 'spend_payment_completed'
  ) {
    const splitId = data.splitId as string | undefined;
    if (splitId) return { path: '/tg/splits/[id]', params: { id: splitId } };
    return { path: '/tg/splits' };
  }

  // Shared wallet notifications — TG uses /tg/wallets not /tg/shared-wallets
  if (type.startsWith('shared_wallet_')) {
    const walletId = (data.sharedWalletId || data.walletId) as string | undefined;
    if (walletId) return { path: '/tg/wallets/[walletId]', params: { walletId } };
    return { path: '/tg/wallets' };
  }

  // Contact added
  if (type === 'contact_added') return { path: '/tg/contacts' };

  // Transaction signing request → TG home
  if (type === 'transaction_signing_request') return { path: '/tg' };

  // System notifications
  if (type === 'system_warning' || type === 'system_notification' || type === 'system') {
    return { path: '/tg/notifications' };
  }

  // Reward/referral
  if (type === 'reward' || type === 'referral') return { path: '/tg/rewards' };

  // Security
  if (type === 'security') return { path: '/tg/settings' };

  // Fallback
  return { path: '/tg/notifications' };
}

/**
 * Resolve the base web route for a notification (no platform prefix).
 * @internal
 */
function resolveWebRoute(notification: NotificationData): NotificationRoute | null {
  const type = notification.type;
  const data = notification.data || {};

  // Transaction notifications → Transaction detail
  if (
    type === 'payment_sent' ||
    type === 'payment_received' ||
    type === 'money_sent' ||
    type === 'money_received'
  ) {
    const txId = (data.transactionId || data.tx_hash || data.signature) as string | undefined;
    if (txId) {
      return { path: '/transactions/[txId]', params: { txId } };
    }
    return { path: '/transactions' };
  }

  // Payment request → Send page with prefilled data
  if (type === 'payment_request') {
    const requestId = (data.requestId || data.id) as string | undefined;
    if (requestId) {
      return {
        path: '/send',
        params: {
          requestId,
          amount: String(data.amount || ''),
          recipientId: (data.senderId || data.fromUserId) as string || '',
        },
      };
    }
    return { path: '/send' };
  }

  // Payment reminder → Dashboard or specific split
  if (type === 'payment_reminder') {
    const splitId = data.splitId as string | undefined;
    if (splitId) {
      return { path: '/splits/[splitId]', params: { splitId } };
    }
    return { path: '/dashboard' };
  }

  // Split notifications
  if (
    type === 'split_invite' ||
    type === 'split_payment_required' ||
    type === 'split_completed' ||
    type === 'split_confirmed' ||
    type === 'split_accepted' ||
    type === 'split_paid' ||
    type === 'split_winner' ||
    type === 'split_loser' ||
    type === 'split_spin_available' ||
    type === 'split_lock_required' ||
    type === 'spend_payment_completed'
  ) {
    const splitId = data.splitId as string | undefined;
    if (splitId) {
      return { path: '/splits/[splitId]', params: { splitId } };
    }
    return { path: '/splits' };
  }

  // Shared wallet notifications
  if (type.startsWith('shared_wallet_')) {
    const walletId = (data.sharedWalletId || data.walletId) as string | undefined;
    if (walletId) {
      return { path: '/shared-wallets/[walletId]', params: { walletId } };
    }
    return { path: '/shared-wallets' };
  }

  // Contact added → Contacts page
  if (type === 'contact_added') {
    return { path: '/contacts' };
  }

  // Transaction signing request → Dashboard (web browser handles this differently)
  if (type === 'transaction_signing_request') {
    return { path: '/dashboard' };
  }

  // System notifications
  if (type === 'system_warning' || type === 'system_notification' || type === 'system') {
    return { path: '/notifications' };
  }

  // Reward/referral notifications → Rewards page
  if (type === 'reward' || type === 'referral') {
    return { path: '/rewards' };
  }

  // Security notifications → Settings
  if (type === 'security') {
    return { path: '/settings' };
  }

  // Generic/fallback → Notifications page
  return { path: '/notifications' };
}

/**
 * Determine what action should happen when a notification is clicked.
 */
export function getNotificationAction(
  notification: NotificationData,
  platform: 'web' | 'tg' = 'web',
): NotificationActionResult {
  const type = notification.type;
  const data = notification.data || {};
  const route = getNotificationRoute(notification, platform);

  // Split invite requires acceptance action
  if (type === 'split_invite') {
    const splitId = data.splitId as string | undefined;
    if (splitId) {
      return {
        route,
        requiresAction: true,
        actionType: 'accept_split',
      };
    }
    return { route, requiresAction: false, error: 'Missing split ID' };
  }

  // Payment request → Route to send with prefilled data
  if (type === 'payment_request') {
    return {
      route,
      requiresAction: true,
      actionType: 'pay_request',
    };
  }

  // Withdrawal request (for admins) → May need approval
  if (type === 'shared_wallet_withdrawal_request') {
    return {
      route,
      requiresAction: true,
      actionType: 'approve_withdrawal',
    };
  }

  // All other notifications are view-only
  return {
    route,
    requiresAction: false,
    actionType: 'view_only',
  };
}

/**
 * Build the actual URL path from a notification route.
 */
export function buildNotificationUrl(route: NotificationRoute): string {
  let path = route.path;

  // Replace dynamic segments with actual params
  if (route.params) {
    for (const [key, value] of Object.entries(route.params)) {
      path = path.replace(`[${key}]`, encodeURIComponent(value));
    }
  }

  return path;
}

// ---------------------------------------------------------------------------
// Notification Titles & Messages
// ---------------------------------------------------------------------------

/**
 * Get a display title for a notification type.
 */
export function getNotificationTitle(type: NotificationType): string {
  const titles: Partial<Record<NotificationType, string>> = {
    general: 'Notification',
    payment_received: 'Payment Received',
    payment_sent: 'Payment Sent',
    money_sent: 'Money Sent',
    money_received: 'Money Received',
    split_payment_required: 'Payment Required',
    split_completed: 'Split Completed',
    payment_request: 'Payment Request',
    split_spin_available: 'Spin Available',
    split_loser: 'Split Result',
    split_winner: 'You Won!',
    system_warning: 'System Warning',
    payment_reminder: 'Payment Reminder',
    split_invite: 'Split Invitation',
    system_notification: 'System Notification',
    split_lock_required: 'Lock Required',
    contact_added: 'Contact Added',
    split_accepted: 'Split Accepted',
    split_paid: 'Split Paid',
    split_confirmed: 'Split Confirmed',
    shared_wallet_invite: 'Wallet Invitation',
    shared_wallet_funding: 'Wallet Funded',
    shared_wallet_withdrawal: 'Withdrawal Completed',
    shared_wallet_goal_reached: 'Goal Reached!',
    shared_wallet_permissions_updated: 'Permissions Updated',
    shared_wallet_member_accepted: 'Member Joined',
    shared_wallet_member_removed: 'Member Removed',
    shared_wallet_settings_updated: 'Settings Updated',
    shared_wallet_role_changed: 'Role Changed',
    shared_wallet_withdrawal_request: 'Withdrawal Request',
    shared_wallet_withdrawal_approved: 'Withdrawal Approved',
    shared_wallet_withdrawal_rejected: 'Withdrawal Rejected',
    spend_payment_completed: 'Payment Completed',
    transaction_signing_request: 'Transaction Approval',
    shared_wallet_expense_created: 'New Expense',
    shared_wallet_expense_topup_needed: 'Top Up Needed',
    shared_wallet_degen_payout: 'Degen Payout',
    shared_wallet_expense_settled: 'Expense Settled',
    transaction: 'Transaction',
    shared_wallet: 'Shared Wallet',
    system: 'System',
    reward: 'Reward',
    referral: 'Referral',
    security: 'Security Alert',
    withdrawal_request: 'Withdrawal Request',
    withdrawal_approved: 'Withdrawal Approved',
    withdrawal_rejected: 'Withdrawal Rejected',
    member_joined: 'Member Joined',
    member_removed: 'Member Removed',
    settings_changed: 'Settings Changed',
  };

  return titles[type] || 'Notification';
}

/**
 * Get a default message for a notification type with data substitution.
 */
export function getNotificationMessage(
  type: NotificationType,
  data: Record<string, unknown> = {}
): string {
  const amount = data.amount ? `${data.amount} ${data.currency || 'USDC'}` : 'funds';
  const senderName = (data.senderName || data.fromUserName || 'Someone') as string;
  const recipientName = (data.recipientName || data.toUserName || 'someone') as string;
  const walletName = (data.walletName || 'shared wallet') as string;
  const billName = (data.billName || data.splitName || 'Split') as string;
  const expenseName = (data.expenseName || 'Expense') as string;

  const messages: Partial<Record<NotificationType, string>> = {
    payment_received: `You received ${amount}`,
    payment_sent: `You sent ${amount} to ${recipientName}`,
    money_sent: `You sent ${amount} to ${recipientName}`,
    money_received: `You received ${amount} from ${senderName}`,
    split_payment_required: `You have a payment due for "${billName}"`,
    split_completed: `The split "${billName}" has been completed`,
    payment_request: `${senderName} requested ${amount}`,
    split_invite: `You're invited to split "${billName}"`,
    split_accepted: `${senderName} accepted the split "${billName}"`,
    split_paid: `${senderName} paid their share for "${billName}"`,
    split_confirmed: `The split "${billName}" is ready for payment`,
    shared_wallet_invite: `You've been invited to join "${walletName}"`,
    shared_wallet_funding: `${senderName} added ${amount} to "${walletName}"`,
    shared_wallet_withdrawal: `${amount} withdrawn from "${walletName}"`,
    shared_wallet_withdrawal_request: `${senderName} requested to withdraw ${amount} from "${walletName}"`,
    shared_wallet_withdrawal_approved: `Your withdrawal of ${amount} from "${walletName}" was approved`,
    shared_wallet_withdrawal_rejected: `Your withdrawal from "${walletName}" was rejected`,
    shared_wallet_expense_created: `New expense "${expenseName}" added to "${walletName}"`,
    shared_wallet_expense_topup_needed: `You need to top up for "${expenseName}" in "${walletName}"`,
    contact_added: `${senderName} added you as a contact`,
    payment_reminder: `Reminder: You have a pending payment of ${amount}`,
  };

  return messages[type] || data.message as string || 'You have a new notification';
}

// ---------------------------------------------------------------------------
// Notification Grouping
// ---------------------------------------------------------------------------

/**
 * Group notifications by date for display.
 */
export function groupNotificationsByDate(notifications: NotificationData[]): NotificationGroup[] {
  const groups = new Map<string, NotificationData[]>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().split('T')[0] ?? '';
  const yesterdayStr = yesterday.toISOString().split('T')[0] ?? '';

  for (const notification of notifications) {
    const createdAt = notification.created_at || new Date().toISOString();
    const dateStr = createdAt.split('T')[0] ?? '';

    if (!groups.has(dateStr)) {
      groups.set(dateStr, []);
    }
    groups.get(dateStr)!.push(notification);
  }

  // Convert to array and sort by date (newest first)
  const result: NotificationGroup[] = [];
  const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  for (const date of sortedDates) {
    let dateLabel: string;
    if (date === todayStr) {
      dateLabel = 'Today';
    } else if (date === yesterdayStr) {
      dateLabel = 'Yesterday';
    } else {
      // Format as "Jan 15, 2024"
      const d = new Date(date + 'T00:00:00');
      dateLabel = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    result.push({
      date,
      dateLabel,
      notifications: groups.get(date)!,
    });
  }

  return result;
}

/**
 * Group notifications by type category for filtering.
 */
export function groupNotificationsByCategory(
  notifications: NotificationData[]
): { payments: NotificationData[]; splits: NotificationData[]; wallets: NotificationData[]; contacts: NotificationData[]; system: NotificationData[]; other: NotificationData[] } {
  const categories = {
    payments: [] as NotificationData[],
    splits: [] as NotificationData[],
    wallets: [] as NotificationData[],
    contacts: [] as NotificationData[],
    system: [] as NotificationData[],
    other: [] as NotificationData[],
  };

  for (const notification of notifications) {
    const type = notification.type;

    // Payments
    if (
      type === 'payment_received' ||
      type === 'payment_sent' ||
      type === 'money_sent' ||
      type === 'money_received' ||
      type === 'payment_request' ||
      type === 'payment_reminder' ||
      type === 'transaction'
    ) {
      categories.payments.push(notification);
    }
    // Splits
    else if (
      type.startsWith('split_') ||
      type === 'spend_payment_completed'
    ) {
      categories.splits.push(notification);
    }
    // Shared wallets
    else if (
      type.startsWith('shared_wallet_') ||
      type === 'withdrawal_request' ||
      type === 'withdrawal_approved' ||
      type === 'withdrawal_rejected' ||
      type === 'member_joined' ||
      type === 'member_removed'
    ) {
      categories.wallets.push(notification);
    }
    // Contacts
    else if (type === 'contact_added') {
      categories.contacts.push(notification);
    }
    // System
    else if (
      type === 'system_warning' ||
      type === 'system_notification' ||
      type === 'system' ||
      type === 'security'
    ) {
      categories.system.push(notification);
    }
    // Other
    else {
      categories.other.push(notification);
    }
  }

  return categories;
}

// ---------------------------------------------------------------------------
// Notification Filtering
// ---------------------------------------------------------------------------

/** Filter options for notification list */
export type NotificationFilter = 'all' | 'unread' | 'payments' | 'splits' | 'wallets' | 'system';

/**
 * Filter notifications based on filter type.
 */
export function filterNotifications(
  notifications: NotificationData[],
  filter: NotificationFilter
): NotificationData[] {
  switch (filter) {
    case 'unread':
      return notifications.filter((n) => !n.is_read && !n.read);
    case 'payments':
      return notifications.filter((n) =>
        ['payment_received', 'payment_sent', 'money_sent', 'money_received', 'payment_request', 'payment_reminder', 'transaction'].includes(n.type)
      );
    case 'splits':
      return notifications.filter((n) =>
        n.type.startsWith('split_') || n.type === 'spend_payment_completed'
      );
    case 'wallets':
      return notifications.filter((n) =>
        n.type.startsWith('shared_wallet_') ||
        ['withdrawal_request', 'withdrawal_approved', 'withdrawal_rejected', 'member_joined', 'member_removed'].includes(n.type)
      );
    case 'system':
      return notifications.filter((n) =>
        ['system_warning', 'system_notification', 'system', 'security'].includes(n.type)
      );
    case 'all':
    default:
      return notifications;
  }
}

// ---------------------------------------------------------------------------
// Export Service Object
// ---------------------------------------------------------------------------

export const notificationActionService = {
  getRoute: getNotificationRoute,
  getAction: getNotificationAction,
  buildUrl: buildNotificationUrl,
  getTitle: getNotificationTitle,
  getMessage: getNotificationMessage,
  groupByDate: groupNotificationsByDate,
  groupByCategory: groupNotificationsByCategory,
  filter: filterNotifications,
};
