/**
 * Common types, constants, and enums shared across domains.
 */

// ---------------------------------------------------------------------------
// Firestore Collection Constants
// ---------------------------------------------------------------------------

export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  TRANSACTIONS: 'transactions',
  SHARED_WALLETS: 'sharedWallets',
  SHARED_WALLET_TRANSACTIONS: 'sharedWalletTransactions',
  SHARED_WALLET_WITHDRAWAL_REQUESTS: 'sharedWalletWithdrawalRequests',
  SHARED_WALLET_EXPENSES: 'sharedWalletExpenses',
  SPLIT_WALLETS: 'splitWallets',
  SPLIT_WALLET_PRIVATE_KEYS: 'splitWalletPrivateKeys',
  SPLITS: 'splits',
  CONTACTS: 'contacts',
  NOTIFICATIONS: 'notifications',
  BADGES: 'badges',
  LEADERBOARD: 'leaderboard',
  PAYMENT_REQUESTS: 'paymentRequests',
  POINTS_TRANSACTIONS: 'pointsTransactions',
} as const;

// ---------------------------------------------------------------------------
// Status Enums
// ---------------------------------------------------------------------------

// Wallet status — tracks wallet health state
export type WalletStatus = 'healthy' | 'needs_fix' | 'no_wallet' | 'fixing' | 'error' | 'migrating';

// Wallet type — how the wallet was created/connected
export type WalletType = 'app-generated' | 'external' | 'migrated' | 'mwa' | 'phantom';

// Shared wallet member role
export type MemberRole = 'creator' | 'admin' | 'member';

// Shared wallet member status
export type MemberStatus = 'active' | 'invited' | 'left' | 'removed';

// Payment request status
export type PaymentRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

export interface Currency {
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId?: string;
  color?: string;
}
