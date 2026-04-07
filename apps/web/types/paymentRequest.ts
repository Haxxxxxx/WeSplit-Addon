/**
 * Payment request types.
 */

import type { PaymentRequestStatus } from './common';

// ---------------------------------------------------------------------------
// Payment Request (paymentRequests collection)
// ---------------------------------------------------------------------------

/**
 * Payment request from one user to one or more recipients.
 * Schema matches Firestore paymentRequests collection.
 *
 * Dual-format: mobile writes senderId/recipientId (single recipient);
 * legacy web writes from_user/to_users (multi-recipient). Both coexist.
 */
export interface PaymentRequest {
  id: string;
  // Modern format (mobile + new web)
  senderId?: string;
  recipientId?: string;
  senderName?: string;
  recipientName?: string;
  senderWallet?: string;
  recipientWallet?: string;
  // Legacy format (old web, kept for Firestore compatibility)
  from_user?: string;
  from_name?: string;
  from_wallet?: string;
  to_users?: string[];
  amount: number;
  amount_per_person?: number;
  currency: string;
  note?: string;
  status: PaymentRequestStatus;
  created_at: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  paid_by?: string[];
}

export interface PaymentRequestResult {
  success: boolean;
  request?: PaymentRequest;
  error?: string;
}
