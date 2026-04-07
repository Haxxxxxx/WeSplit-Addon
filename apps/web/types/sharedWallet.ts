/**
 * Shared wallet types — wallets, members, permissions, transactions, withdrawals, expenses.
 */

// ---------------------------------------------------------------------------
// Shared Wallet
// ---------------------------------------------------------------------------

export interface SharedWallet {
  id: string;
  name: string;
  description?: string;
  wallet_address: string;
  creator_id: string;
  creatorId?: string; // camelCase alias written by mobile
  members: SharedWalletMember[];
  balance?: number;
  usdc_balance?: number;
  sol_balance?: number;
  currency: string;
  created_at: string;
  updated_at?: string;
  status: 'active' | 'archived' | 'frozen';
  settings?: SharedWalletSettings;
}

export interface SharedWalletMember {
  user_id: string;
  userId?: string; // camelCase alias written by mobile — prefer user_id
  role: 'creator' | 'admin' | 'member';
  permissions: SharedWalletPermissions;
  joined_at: string;
  joinedAt?: string; // camelCase alias written by mobile
  invited_by?: string;
  name?: string;
  email?: string;
  avatar?: string;
  wallet_address?: string;
}

export interface SharedWalletPermissions {
  canInviteMembers: boolean;
  canWithdraw: boolean;
  canFund: boolean;
  canManageSettings: boolean;
  canRemoveMembers: boolean;
  canViewTransactions: boolean;
}

export interface SharedWalletSettings {
  requireApprovalForWithdrawals?: boolean;
  approvalThreshold?: number;
  dailyWithdrawalLimit?: number;
  perTransactionLimit?: number;
  allowedCurrencies?: string[];
}

// ---------------------------------------------------------------------------
// Shared Wallet Transaction
// ---------------------------------------------------------------------------

export interface SharedWalletTransaction {
  id: string;
  wallet_id: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'fee';
  amount: number;
  currency: string;
  from_user?: string;
  to_user?: string;
  tx_hash?: string;
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  note?: string;
  created_at: string;
  updated_at?: string;
  initiated_by: string;
}

// ---------------------------------------------------------------------------
// Withdrawal Request
// ---------------------------------------------------------------------------

export interface WithdrawalRequest {
  id: string;
  wallet_id: string;
  requester_id: string;
  amount: number;
  currency: string;
  destination_address: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  approvals: string[];
  rejections: string[];
  created_at: string;
  updated_at?: string;
  executed_at?: string;
  tx_hash?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Shared Wallet Expenses
// ---------------------------------------------------------------------------

export interface ExpenseSplit {
  userId: string;
  userName: string;
  amount: number;
}

export interface SharedWalletExpense {
  id: string;
  sharedWalletId: string;
  name: string;
  date: string;
  amount: number;
  currency: string;
  amountInUSDC: number;
  splitMethod: 'equal' | 'custom';
  splitBetween: ExpenseSplit[];
  recordedById: string;
  recordedByName: string;
  fundingStatus: 'funded' | 'underfunded';
  status: 'active' | 'archived';
  receiptUrl?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
