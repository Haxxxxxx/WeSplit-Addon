/**
 * WeSplit Type Definitions
 *
 * Central type definitions for the browser addon.
 * All shared types should be defined here and imported elsewhere.
 */

// ============================================
// User Types
// ============================================

/**
 * Basic user type for contacts and simple references
 */
export interface User {
  id: string;
  name: string;
  email?: string;
  wallet_address: string;
  phone?: string;
  points?: number;
  avatar?: string;
}

/**
 * Full user profile synced with mobile app and Firebase
 * This is the primary user type used throughout the app
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  wallet_address: string;
  wallet_public_key?: string;
  phone?: string;
  points?: number;
  total_points_earned?: number;
  avatar?: string;
  emailVerified?: boolean;
  created_at?: string;
  updated_at?: string;
  referral_code?: string;
  badges?: string[];
}

// ============================================
// Currency & Token Types
// ============================================

/**
 * Supported currencies for transactions
 */
export type Currency = 'USDC' | 'SOL';

/**
 * Token balance information
 */
export interface Token {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  icon: string;
  mint?: string;
}

// ============================================
// Transaction Types
// ============================================

export type TransactionType = 'send' | 'receive' | 'deposit' | 'withdraw' | 'swap';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  from_address: string;
  to_address: string;
  tx_hash?: string;
  status: TransactionStatus;
  created_at: string;
  description?: string;
  // For swap transactions
  swapFromAmount?: number;
  swapFromCurrency?: string;
  swapToAmount?: number;
  swapToCurrency?: string;
}

// ============================================
// Payment Request Types
// ============================================

export type PaymentRequestStatus = 'pending' | 'paid' | 'declined' | 'expired';

export interface PaymentRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromWalletAddress: string;
  toUserId: string;
  toUserName: string;
  toWalletAddress: string;
  amount: number;
  currency: Currency;
  message?: string;
  status: PaymentRequestStatus;
  createdAt: Date;
  paidAt?: Date;
  txHash?: string;
}

// ============================================
// Split Types (for future use)
// ============================================

export interface SplitParticipant {
  id: string;
  name: string;
  wallet_address: string;
  amount: number;
  paid: boolean;
}

export interface Split {
  id: string;
  name: string;
  total_amount: number;
  currency: string;
  participants: SplitParticipant[];
  created_at: string;
  status: 'active' | 'settled' | 'cancelled';
}

// ============================================
// Contact Types
// ============================================

export interface Contact {
  id: string;
  name: string;
  wallet_address: string;
  avatar?: string;
  isFavorite?: boolean;
}

// ============================================
// Wallet Types
// ============================================

export type WalletProvider =
  | 'phantom'
  | 'solflare'
  | 'backpack'
  | 'glow'
  | 'coinbase'
  | 'trust'
  | 'exodus'
  | 'brave'
  | 'none';

export interface WalletInfo {
  id: WalletProvider;
  name: string;
  icon: string;
  color: string;
  downloadUrl: string;
  detected: boolean;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: number;
  usdcBalance: number;
  provider: WalletProvider;
}

// ============================================
// Shared Wallet Types
// ============================================

export type SharedWalletStatus = 'active' | 'paused' | 'archived';
export type SharedWalletMemberRole = 'creator' | 'admin' | 'member';
export type SharedWalletMemberStatus = 'active' | 'invited' | 'left';

export interface SharedWalletMember {
  userId: string;
  name: string;
  walletAddress: string;
  role: SharedWalletMemberRole;
  totalContributed: number;
  totalWithdrawn: number;
  joinedAt: string;
  status: SharedWalletMemberStatus;
}

export interface SharedWallet {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  creatorName: string;
  walletAddress: string;
  totalBalance: number;
  currency: string;
  status: SharedWalletStatus;
  members: SharedWalletMember[];
  createdAt: string;
  updatedAt: string;
  customColor?: string;
  customLogo?: string;
}

// ============================================
// App Navigation Types
// ============================================

export type View =
  | 'dashboard'
  | 'send'
  | 'request'
  | 'sharedWallets'
  | 'history'
  | 'settings'
  | 'connect';
