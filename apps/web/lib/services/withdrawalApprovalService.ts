/**
 * Withdrawal Approval Service
 *
 * Handles withdrawal request creation, approval, and rejection for shared wallets.
 * Mirrors mobile app's WithdrawalRequestService.ts logic.
 *
 * Firestore Collection: sharedWalletWithdrawalRequests
 *
 * Schema:
 * - sharedWalletId: string (wallet ID)
 * - sharedWalletFirebaseDocId: string (Firestore doc ID for security rules)
 * - userId: string (requester)
 * - userName: string
 * - amount: number
 * - currency: string
 * - destinationAddress: string
 * - memo: string
 * - status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
 * - approvals: string[] (user IDs who approved)
 * - rejections: string[] (user IDs who rejected)
 * - createdAt: timestamp
 * - updatedAt: timestamp
 * - executedAt?: timestamp
 * - txHash?: string
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  FIRESTORE_COLLECTIONS,
  type WithdrawalRequest,
  type SharedWallet,
} from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateWithdrawalRequestParams {
  walletId: string;
  walletFirebaseDocId?: string;
  requesterId: string;
  requesterName: string;
  amount: number;
  currency?: string;
  destinationAddress: string;
  memo?: string;
  fee?: number;
  netAmount?: number;
}

export interface WithdrawalRequestResult {
  success: boolean;
  request?: WithdrawalRequest;
  requestId?: string;
  error?: string;
}

export interface WithdrawalRequestListResult {
  success: boolean;
  requests?: WithdrawalRequest[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Data Transformers
// ---------------------------------------------------------------------------

function firestoreToWithdrawalRequest(docSnapshot: DocumentSnapshot | Record<string, unknown>): WithdrawalRequest {
  const data = (docSnapshot as DocumentSnapshot).data?.() ?? (docSnapshot as Record<string, unknown>);
  const id = (docSnapshot as DocumentSnapshot).id ?? (data as Record<string, unknown>).id;

  const getISOString = (val: unknown): string => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    if (typeof val === 'string') return val;
    return new Date().toISOString();
  };

  return {
    id,
    // Web format
    wallet_id: data.wallet_id || data.sharedWalletId || '',
    requester_id: data.requester_id || data.userId || '',
    destination_address: data.destination_address || data.destinationAddress || '',
    // Shared fields
    amount: data.amount || 0,
    currency: data.currency || 'USDC',
    status: data.status || 'pending',
    approvals: data.approvals || [],
    rejections: data.rejections || [],
    note: data.note || data.memo || '',
    tx_hash: data.tx_hash || data.txHash,
    created_at: getISOString(data.created_at || data.createdAt),
    updated_at: getISOString(data.updated_at || data.updatedAt),
    executed_at: data.executed_at || data.executedAt
      ? getISOString(data.executed_at || data.executedAt)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Notification Helper
// ---------------------------------------------------------------------------

async function createWithdrawalNotification(
  recipientUserId: string,
  title: string,
  body: string,
  type: 'shared_wallet_withdrawal_request' | 'shared_wallet_withdrawal_approved' | 'shared_wallet_withdrawal_rejected',
  data: Record<string, any>
): Promise<void> {
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await addDoc(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), {
      id: notifId,
      // S3-3: include both `type` and `notification_type` for mobile compat
      type,
      notification_type: type,
      notificationType: type,
      title,
      body,
      message: body,
      user_id: recipientUserId,
      userId: recipientUserId,
      is_read: false,
      read: false,
      created_at: serverTimestamp(),
      createdAt: serverTimestamp(),
      data,
    });
  } catch (error) {
    console.warn('[WithdrawalApprovalService] Notification creation failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Create a new withdrawal request
 */
export async function createWithdrawalRequest(
  params: CreateWithdrawalRequestParams
): Promise<WithdrawalRequestResult> {
  try {
    const now = new Date().toISOString();
    const docData = {
      // Mobile format
      sharedWalletId: params.walletId,
      sharedWalletFirebaseDocId: params.walletFirebaseDocId || params.walletId,
      userId: params.requesterId,
      userName: params.requesterName,
      destinationAddress: params.destinationAddress,
      memo: params.memo || '',
      // Web format (backward compatibility)
      wallet_id: params.walletId,
      requester_id: params.requesterId,
      destination_address: params.destinationAddress,
      note: params.memo || '',
      // Shared
      amount: params.amount,
      currency: params.currency || 'USDC',
      status: 'pending',
      approvals: [],
      rejections: [],
      created_at: serverTimestamp(),
      createdAt: serverTimestamp(),
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Optional fee fields
      ...(params.fee !== undefined && { fee: params.fee }),
      ...(params.netAmount !== undefined && { netAmount: params.netAmount }),
    };

    const docRef = await addDoc(
      collection(db, FIRESTORE_COLLECTIONS.SHARED_WALLET_WITHDRAWAL_REQUESTS),
      docData
    );

    // Get the wallet to notify admins
    const walletSnap = await getDoc(
      doc(db, FIRESTORE_COLLECTIONS.SHARED_WALLETS, params.walletId)
    );

    if (walletSnap.exists()) {
      const wallet = walletSnap.data() as SharedWallet;
      const admins = (wallet.members || []).filter(
        (m) =>
          (m.role === 'creator' || m.role === 'admin') &&
          m.user_id !== params.requesterId
      );

      // Notify each admin
      await Promise.all(
        admins.map((admin) =>
          createWithdrawalNotification(
            admin.user_id,
            'Withdrawal Request',
            `${params.requesterName} requested $${params.amount.toFixed(2)} ${params.currency || 'USDC'} from "${wallet.name}"`,
            'shared_wallet_withdrawal_request',
            {
              requestId: docRef.id,
              walletId: params.walletId,
              walletName: wallet.name,
              requesterId: params.requesterId,
              requesterName: params.requesterName,
              amount: params.amount,
              currency: params.currency || 'USDC',
              destinationAddress: params.destinationAddress,
            }
          )
        )
      );
    }

    const request = firestoreToWithdrawalRequest({
      id: docRef.id,
      ...docData,
      created_at: now,
      updated_at: now,
    });

    return { success: true, request, requestId: docRef.id };
  } catch (error) {
    console.error('[WithdrawalApprovalService] createWithdrawalRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create withdrawal request',
    };
  }
}

/**
 * Get all withdrawal requests for a shared wallet
 */
export async function getWalletWithdrawalRequests(
  walletId: string,
  options: { pendingOnly?: boolean; limitCount?: number } = {}
): Promise<WithdrawalRequestListResult> {
  try {
    const { pendingOnly = false, limitCount = 50 } = options;
    const requestsRef = collection(db, FIRESTORE_COLLECTIONS.SHARED_WALLET_WITHDRAWAL_REQUESTS);

    // Query by both formats
    const webQuery = query(
      requestsRef,
      where('wallet_id', '==', walletId),
      ...(pendingOnly ? [where('status', '==', 'pending')] : []),
      orderBy('created_at', 'desc'),
      firestoreLimit(limitCount)
    );

    const mobileQuery = query(
      requestsRef,
      where('sharedWalletId', '==', walletId),
      ...(pendingOnly ? [where('status', '==', 'pending')] : []),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );

    const [webSnap, mobileSnap] = await Promise.all([
      getDocs(webQuery).catch(() => ({ docs: [] })),
      getDocs(mobileQuery).catch(() => ({ docs: [] })),
    ]);

    // Merge and dedupe
    const requestMap = new Map<string, WithdrawalRequest>();
    for (const docSnap of [...webSnap.docs, ...mobileSnap.docs]) {
      if (!requestMap.has(docSnap.id)) {
        requestMap.set(docSnap.id, firestoreToWithdrawalRequest(docSnap));
      }
    }

    const requests = Array.from(requestMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { success: true, requests };
  } catch (error) {
    console.error('[WithdrawalApprovalService] getWalletWithdrawalRequests error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch withdrawal requests',
    };
  }
}

/**
 * Get withdrawal requests created by a specific user
 */
export async function getUserWithdrawalRequests(
  userId: string,
  options: { limitCount?: number } = {}
): Promise<WithdrawalRequestListResult> {
  try {
    const { limitCount = 50 } = options;
    const requestsRef = collection(db, FIRESTORE_COLLECTIONS.SHARED_WALLET_WITHDRAWAL_REQUESTS);

    const webQuery = query(
      requestsRef,
      where('requester_id', '==', userId),
      orderBy('created_at', 'desc'),
      firestoreLimit(limitCount)
    );

    const mobileQuery = query(
      requestsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );

    const [webSnap, mobileSnap] = await Promise.all([
      getDocs(webQuery).catch(() => ({ docs: [] })),
      getDocs(mobileQuery).catch(() => ({ docs: [] })),
    ]);

    const requestMap = new Map<string, WithdrawalRequest>();
    for (const docSnap of [...webSnap.docs, ...mobileSnap.docs]) {
      if (!requestMap.has(docSnap.id)) {
        requestMap.set(docSnap.id, firestoreToWithdrawalRequest(docSnap));
      }
    }

    const requests = Array.from(requestMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { success: true, requests };
  } catch (error) {
    console.error('[WithdrawalApprovalService] getUserWithdrawalRequests error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user withdrawal requests',
    };
  }
}

/**
 * Get a single withdrawal request by ID
 */
export async function getWithdrawalRequest(
  requestId: string
): Promise<WithdrawalRequestResult> {
  try {
    const docSnap = await getDoc(
      doc(db, FIRESTORE_COLLECTIONS.SHARED_WALLET_WITHDRAWAL_REQUESTS, requestId)
    );

    if (!docSnap.exists()) {
      return { success: false, error: 'Withdrawal request not found' };
    }

    return { success: true, request: firestoreToWithdrawalRequest(docSnap) };
  } catch (error) {
    console.error('[WithdrawalApprovalService] getWithdrawalRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch withdrawal request',
    };
  }
}

/**
 * Approve a withdrawal request
 */
export async function approveWithdrawalRequest(
  requestId: string,
  approverId: string,
  approverName: string
): Promise<WithdrawalRequestResult> {
  try {
    const requestRef = doc(
      db,
      FIRESTORE_COLLECTIONS.SHARED_WALLET_WITHDRAWAL_REQUESTS,
      requestId
    );
    const docSnap = await getDoc(requestRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Withdrawal request not found' };
    }

    const data = docSnap.data();

    if (data.status !== 'pending') {
      return { success: false, error: `Request is already ${data.status}` };
    }

    const approvals = [...(data.approvals || [])];
    if (!approvals.includes(approverId)) {
      approvals.push(approverId);
    }

    await updateDoc(requestRef, {
      approvals,
      status: 'approved',
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify the requester
    const requesterId = data.requester_id || data.userId;
    const walletId = data.wallet_id || data.sharedWalletId;

    await createWithdrawalNotification(
      requesterId,
      'Withdrawal Approved',
      `${approverName} approved your withdrawal request for $${data.amount.toFixed(2)} ${data.currency || 'USDC'}`,
      'shared_wallet_withdrawal_approved',
      {
        requestId,
        walletId,
        approverId,
        approverName,
        amount: data.amount,
        currency: data.currency || 'USDC',
      }
    );

    const updatedSnap = await getDoc(requestRef);
    return { success: true, request: firestoreToWithdrawalRequest(updatedSnap) };
  } catch (error) {
    console.error('[WithdrawalApprovalService] approveWithdrawalRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve withdrawal request',
    };
  }
}

/**
 * Reject a withdrawal request
 */
export async function rejectWithdrawalRequest(
  requestId: string,
  rejecterId: string,
  rejecterName: string,
  reason?: string
): Promise<WithdrawalRequestResult> {
  try {
    const requestRef = doc(
      db,
      FIRESTORE_COLLECTIONS.SHARED_WALLET_WITHDRAWAL_REQUESTS,
      requestId
    );
    const docSnap = await getDoc(requestRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Withdrawal request not found' };
    }

    const data = docSnap.data();

    if (data.status !== 'pending') {
      return { success: false, error: `Request is already ${data.status}` };
    }

    const rejections = [...(data.rejections || [])];
    if (!rejections.includes(rejecterId)) {
      rejections.push(rejecterId);
    }

    await updateDoc(requestRef, {
      rejections,
      status: 'rejected',
      rejection_reason: reason || '',
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify the requester
    const requesterId = data.requester_id || data.userId;
    const walletId = data.wallet_id || data.sharedWalletId;
    const reasonText = reason ? `: ${reason}` : '';

    await createWithdrawalNotification(
      requesterId,
      'Withdrawal Rejected',
      `${rejecterName} rejected your withdrawal request for $${data.amount.toFixed(2)} ${data.currency || 'USDC'}${reasonText}`,
      'shared_wallet_withdrawal_rejected',
      {
        requestId,
        walletId,
        rejecterId,
        rejecterName,
        amount: data.amount,
        currency: data.currency || 'USDC',
        reason,
      }
    );

    const updatedSnap = await getDoc(requestRef);
    return { success: true, request: firestoreToWithdrawalRequest(updatedSnap) };
  } catch (error) {
    console.error('[WithdrawalApprovalService] rejectWithdrawalRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject withdrawal request',
    };
  }
}

/**
 * Mark a withdrawal request as executed (after on-chain tx)
 */
export async function markWithdrawalExecuted(
  requestId: string,
  txHash: string
): Promise<WithdrawalRequestResult> {
  try {
    const requestRef = doc(
      db,
      FIRESTORE_COLLECTIONS.SHARED_WALLET_WITHDRAWAL_REQUESTS,
      requestId
    );

    await updateDoc(requestRef, {
      status: 'executed',
      tx_hash: txHash,
      txHash,
      executed_at: serverTimestamp(),
      executedAt: serverTimestamp(),
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const updatedSnap = await getDoc(requestRef);
    return { success: true, request: firestoreToWithdrawalRequest(updatedSnap) };
  } catch (error) {
    console.error('[WithdrawalApprovalService] markWithdrawalExecuted error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark withdrawal as executed',
    };
  }
}

/**
 * Get count of pending withdrawal requests for a wallet (for badge display)
 */
export async function getPendingWithdrawalCount(walletId: string): Promise<number> {
  try {
    const result = await getWalletWithdrawalRequests(walletId, { pendingOnly: true });
    return result.requests?.length || 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Export service object
// ---------------------------------------------------------------------------

export const withdrawalApprovalService = {
  createWithdrawalRequest,
  getWalletWithdrawalRequests,
  getUserWithdrawalRequests,
  getWithdrawalRequest,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  markWithdrawalExecuted,
  getPendingWithdrawalCount,
};
