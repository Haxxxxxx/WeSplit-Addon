/**
 * Split and split wallet types.
 */

// ---------------------------------------------------------------------------
// Split Status Enums
// ---------------------------------------------------------------------------

// Split wallet status (for splitWallets collection)
export const SPLIT_WALLET_STATUS = {
  ACTIVE: 'active',
  LOCKED: 'locked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CLOSED: 'closed',
} as const;
export type SplitWalletStatus = (typeof SPLIT_WALLET_STATUS)[keyof typeof SPLIT_WALLET_STATUS];

// Split participant status (for splitWallets collection participants)
export const PARTICIPANT_STATUS = {
  PENDING: 'pending',
  LOCKED: 'locked',
  PAID: 'paid',
  FAILED: 'failed',
} as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUS)[keyof typeof PARTICIPANT_STATUS];

// Split storage status (for splits collection participants) — different from wallet participants
export const SPLIT_STORAGE_STATUS = {
  PENDING: 'pending',
  INVITED: 'invited',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  PAID: 'paid',
  LOCKED: 'locked',
} as const;
export type SplitStorageStatus = (typeof SPLIT_STORAGE_STATUS)[keyof typeof SPLIT_STORAGE_STATUS];

// Split status (for splits collection)
export const SPLIT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  ACTIVE: 'active',
  LOCKED: 'locked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type SplitStatus = (typeof SPLIT_STATUS)[keyof typeof SPLIT_STATUS];

// ---------------------------------------------------------------------------
// Split (splits collection) — Bill splitting with multiple participants
// ---------------------------------------------------------------------------

export interface SplitItem {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  category?: string;
  participants: string[]; // Array of participant userIds who share this item
}

export interface SplitParticipant {
  userId: string;
  name: string;
  email?: string;
  walletAddress: string;
  amountOwed: number;
  amountPaid: number;
  status: SplitStorageStatus;
  joinedAt?: string;
  paidAt?: string;
  transactionSignature?: string;
  avatar?: string;
}

export interface Split {
  id: string;
  billId: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: string;
  category?: string; // trip, food, home, event, rocket
  splitType?: 'spend'; // Only spend splits supported (Fair/Degen removed)
  splitMethod?: 'equal' | 'manual';
  status: SplitStatus;
  creatorId: string;
  creatorName: string;
  participants: SplitParticipant[];
  items?: SplitItem[];
  merchant?: {
    name: string;
    address?: string;
    phone?: string;
  };
  date: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  firebaseDocId?: string;
  // OCR-extracted data
  subtotal?: number;
  tax?: number;
  receiptNumber?: string;
  // Wallet information
  walletId?: string;
  walletAddress?: string;
  // External payment integration
  externalSource?: string;
  externalInvoiceId?: string;
  externalMetadata?: {
    paymentMode?: 'personal' | 'merchant_gateway';
    treasuryWallet?: string;
    orderId?: string;
    paymentStatus?: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded';
    paymentTransactionSig?: string;
    idempotencyKey?: string;
  };
}

export interface SplitResult {
  success: boolean;
  split?: Split;
  error?: string;
}

export interface SplitListResult {
  success: boolean;
  splits?: Split[];
  error?: string;
  hasMore?: boolean;
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
}

// ---------------------------------------------------------------------------
// Split Wallet (splitWallets collection) — On-chain wallet for split payments
// ---------------------------------------------------------------------------

export interface SplitWalletParticipant {
  userId: string;
  name: string;
  walletAddress: string;
  amountOwed: number;
  amountPaid: number;
  status: ParticipantStatus;
  transactionSignature?: string;
  pendingSignature?: string;
  pendingSince?: string;
  pendingAmount?: number;
  paidAt?: string;
}

export interface SplitWallet {
  id: string;
  billId: string;
  creatorId: string;
  /** The dedicated split wallet address (generated keypair) — participants send funds here */
  walletAddress: string;
  publicKey: string;
  /** Creator's connected wallet address — funds are sent here when creator completes/withdraws */
  creatorReceivingAddress?: string;
  totalAmount: number;
  currency: string;
  status: SplitWalletStatus;
  participants: SplitWalletParticipant[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  firebaseDocId?: string;
}

export interface SplitWalletResult {
  success: boolean;
  wallet?: SplitWallet;
  error?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionSignature?: string;
  amount?: number;
  error?: string;
  message?: string;
  signature?: string;
}
