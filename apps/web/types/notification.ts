/**
 * Notification-related types.
 */

// ---------------------------------------------------------------------------
// Notification Types — 44+ types from mobile
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'general'
  | 'payment_received'
  | 'payment_sent'
  | 'split_payment_required'
  | 'split_completed'
  | 'payment_request'
  | 'money_sent'
  | 'money_received'
  | 'split_spin_available'
  | 'split_loser'
  | 'split_winner'
  | 'system_warning'
  | 'payment_reminder'
  | 'split_invite'
  | 'system_notification'
  | 'split_lock_required'
  | 'contact_added'
  | 'split_accepted'
  | 'split_paid'
  | 'split_confirmed'
  | 'shared_wallet_invite'
  | 'shared_wallet_funding'
  | 'shared_wallet_withdrawal'
  | 'shared_wallet_goal_reached'
  | 'shared_wallet_permissions_updated'
  | 'shared_wallet_member_accepted'
  | 'shared_wallet_member_removed'
  | 'shared_wallet_settings_updated'
  | 'shared_wallet_role_changed'
  | 'shared_wallet_withdrawal_request'
  | 'shared_wallet_withdrawal_approved'
  | 'shared_wallet_withdrawal_rejected'
  | 'spend_payment_completed'
  | 'transaction_signing_request'
  | 'shared_wallet_expense_created'
  | 'shared_wallet_expense_topup_needed'
  | 'shared_wallet_degen_payout'
  | 'shared_wallet_expense_settled'
  // Legacy/generic types for backward compatibility
  | 'transaction'
  | 'shared_wallet'
  | 'system'
  | 'reward'
  | 'referral'
  | 'security'
  | 'withdrawal_request'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'member_joined'
  | 'member_removed'
  | 'settings_changed';

// Type guard for notification type validation
export function isNotificationType(type: string): type is NotificationType {
  const validTypes: NotificationType[] = [
    'general',
    'payment_received',
    'payment_sent',
    'split_payment_required',
    'split_completed',
    'payment_request',
    'money_sent',
    'money_received',
    'split_spin_available',
    'split_loser',
    'split_winner',
    'system_warning',
    'payment_reminder',
    'split_invite',
    'system_notification',
    'split_lock_required',
    'contact_added',
    'split_accepted',
    'split_paid',
    'split_confirmed',
    'shared_wallet_invite',
    'shared_wallet_funding',
    'shared_wallet_withdrawal',
    'shared_wallet_goal_reached',
    'shared_wallet_permissions_updated',
    'shared_wallet_member_accepted',
    'shared_wallet_member_removed',
    'shared_wallet_settings_updated',
    'shared_wallet_role_changed',
    'shared_wallet_withdrawal_request',
    'shared_wallet_withdrawal_approved',
    'shared_wallet_withdrawal_rejected',
    'spend_payment_completed',
    'transaction_signing_request',
    'shared_wallet_expense_created',
    'shared_wallet_expense_topup_needed',
    'shared_wallet_degen_payout',
    'shared_wallet_expense_settled',
    'transaction',
    'shared_wallet',
    'system',
    'reward',
    'referral',
    'security',
    'withdrawal_request',
    'withdrawal_approved',
    'withdrawal_rejected',
    'member_joined',
    'member_removed',
    'settings_changed',
  ];
  return validTypes.includes(type as NotificationType);
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export interface NotificationData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  body?: string; // Alias for message (legacy compatibility)
  user_id: string; // Legacy field for backward compatibility
  is_read: boolean;
  read?: boolean; // Legacy field
  read_at?: string;
  created_at: string;
  data?: Record<string, unknown>;
  action_url?: string;
  icon?: string;
  status?: 'pending' | 'paid' | 'cancelled'; // For payment request notifications
}

// Notification payload for creating notifications
export interface NotificationPayload {
  senderId?: string;
  senderName?: string;
  recipientId?: string;
  recipientName?: string;
  amount?: number;
  currency?: string;
  description?: string;
  requestId?: string;
  splitId?: string;
  transactionId?: string;
  signature?: string;
  status?: string;
  walletId?: string;
  [key: string]: unknown;
}
