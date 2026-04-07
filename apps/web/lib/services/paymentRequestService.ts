/**
 * Payment Request Service
 *
 * Full parity with mobile app's firebasePaymentRequestService.ts
 * Handles payment requests between users with notification integration.
 *
 * Firestore Collection: paymentRequests
 *
 * Schema Notes:
 * - Mobile uses senderId/recipientId (single recipient)
 * - Web legacy used from_user/to_users (multi-recipient)
 * - This service supports BOTH for backward compatibility
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
  Timestamp,
  or,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FIRESTORE_COLLECTIONS, type PaymentRequestStatus } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Payment request document schema (mobile-compatible)
 */
export interface PaymentRequestDoc {
  id: string;
  // Mobile format (primary)
  senderId: string;
  recipientId: string;
  senderName?: string;
  recipientName?: string;
  // Legacy web format (for backward compatibility)
  from_user?: string;
  from_name?: string;
  to_users?: string[];
  // Shared fields
  amount: number;
  currency: string;
  description?: string;
  note?: string;
  groupId?: string;
  status: PaymentRequestStatus;
  created_at: string | Timestamp;
  updated_at?: string | Timestamp;
  // For multi-recipient requests (web legacy)
  amount_per_person?: number;
  paid_by?: string[];
}

/**
 * Clean payment request type (normalized)
 */
export interface PaymentRequest {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  amount: number;
  currency: string;
  description: string;
  groupId?: string;
  status: PaymentRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequestResult {
  success: boolean;
  request?: PaymentRequest;
  error?: string;
}

export interface PaymentRequestListResult {
  success: boolean;
  requests?: PaymentRequest[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Data Transformers
// ---------------------------------------------------------------------------

/**
 * Transform Firestore document to normalized PaymentRequest
 */
function firestoreToPaymentRequest(docSnapshot: DocumentSnapshot | Record<string, unknown>): PaymentRequest {
  const data = (docSnapshot as DocumentSnapshot).data?.() ?? (docSnapshot as Record<string, unknown>);
  const id = (docSnapshot as DocumentSnapshot).id ?? (data as Record<string, unknown>).id;

  // Handle timestamp conversion
  const getISOString = (val: unknown): string => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    if (typeof val === 'string') return val;
    return new Date().toISOString();
  };

  // Normalize sender/recipient from mobile OR legacy web format
  const senderId = data.senderId || data.from_user || '';
  const recipientId = data.recipientId || (data.to_users?.[0]) || '';
  const senderName = data.senderName || data.from_name || 'Unknown';
  const recipientName = data.recipientName || '';
  const amount = data.amount_per_person || data.amount || 0;

  return {
    id,
    senderId,
    recipientId,
    senderName,
    recipientName,
    amount,
    currency: data.currency || 'USDC',
    description: data.description || data.note || '',
    groupId: data.groupId || '',
    status: data.status || 'pending',
    created_at: getISOString(data.created_at || data.createdAt),
    updated_at: getISOString(data.updated_at || data.updatedAt || data.created_at),
  };
}

/**
 * Transform PaymentRequest to Firestore document data
 */
function paymentRequestToFirestore(
  request: Omit<PaymentRequest, 'id' | 'created_at' | 'updated_at'>
): Record<string, any> {
  return {
    // Mobile format (primary)
    senderId: request.senderId,
    recipientId: request.recipientId,
    senderName: request.senderName,
    recipientName: request.recipientName,
    // Web legacy format (backward compatibility)
    from_user: request.senderId,
    from_name: request.senderName,
    to_users: [request.recipientId],
    amount_per_person: request.amount,
    // Shared fields
    amount: request.amount,
    currency: request.currency,
    description: request.description,
    note: request.description,
    groupId: request.groupId || '',
    status: request.status,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
}

// ---------------------------------------------------------------------------
// Notification Helper
// ---------------------------------------------------------------------------

/**
 * Create notification for payment request events
 */
async function createPaymentRequestNotification(
  recipientUserId: string,
  title: string,
  body: string,
  type: 'payment_request_received' | 'payment_request_accepted' | 'payment_request_rejected' | 'payment_request_cancelled' | 'payment_request_reminder',
  data: Record<string, any>
): Promise<void> {
  try {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await addDoc(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), {
      id: notifId,
      // Dual-format notification type for mobile + web compatibility
      type,
      notification_type: type,
      notificationType: type,
      title,
      body,
      message: body,
      user_id: recipientUserId,
      userId: recipientUserId,
      is_read: false,
      isRead: false,
      read: false,
      created_at: serverTimestamp(),
      createdAt: serverTimestamp(),
      data,
    });
  } catch (error) {
    // Don't throw - notification failure shouldn't break main flow
    console.warn('[PaymentRequestService] Notification creation failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Create a new payment request
 */
export async function createPaymentRequest(params: {
  senderId: string;
  senderName: string;
  recipientId: string;
  amount: number;
  currency?: string;
  description?: string;
  groupId?: string;
}): Promise<PaymentRequestResult> {
  try {
    // Fetch recipient name if not provided
    let recipientName = 'Unknown';
    try {
      const recipientDoc = await getDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, params.recipientId));
      if (recipientDoc.exists()) {
        const data = recipientDoc.data();
        recipientName = data.name || data.email || 'Unknown';
      }
    } catch {
      // Ignore - use default name
    }

    const requestData = paymentRequestToFirestore({
      senderId: params.senderId,
      recipientId: params.recipientId,
      senderName: params.senderName,
      recipientName,
      amount: params.amount,
      currency: params.currency || 'USDC',
      description: params.description || '',
      groupId: params.groupId,
      status: 'pending',
    });

    const requestRef = await addDoc(
      collection(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS),
      requestData
    );

    // Fetch created document
    const createdDoc = await getDoc(requestRef);
    const paymentRequest = firestoreToPaymentRequest({ id: requestRef.id, ...createdDoc.data() });

    // Send notification to recipient
    const descText = params.description ? ` for ${params.description}` : '';
    await createPaymentRequestNotification(
      params.recipientId,
      'Payment Request',
      `${params.senderName} requested $${params.amount.toFixed(2)} ${params.currency || 'USDC'}${descText}`,
      'payment_request_received',
      {
        requestId: paymentRequest.id,
        senderId: params.senderId,
        senderName: params.senderName,
        amount: params.amount,
        currency: params.currency || 'USDC',
        description: params.description,
        status: 'pending',
      }
    );

    return { success: true, request: paymentRequest };
  } catch (error) {
    console.error('[PaymentRequestService] createPaymentRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment request',
    };
  }
}

/**
 * Get payment requests received by a user (pending only by default)
 */
export async function getReceivedPaymentRequests(
  userId: string,
  options: { pendingOnly?: boolean; limitCount?: number } = {}
): Promise<PaymentRequestListResult> {
  try {
    const { pendingOnly = true, limitCount = 50 } = options;

    // Query both mobile format (recipientId) and legacy web format (to_users)
    // Firestore doesn't support OR across different fields directly,
    // so we run two queries and merge
    const requestsRef = collection(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS);

    // Query 1: Mobile format (recipientId)
    const mobileQueryConstraints = [
      where('recipientId', '==', userId),
      ...(pendingOnly ? [where('status', '==', 'pending')] : []),
      orderBy('created_at', 'desc'),
      firestoreLimit(limitCount),
    ];
    const mobileQuery = query(requestsRef, ...mobileQueryConstraints);

    // Query 2: Legacy web format (to_users array-contains)
    const legacyQueryConstraints = [
      where('to_users', 'array-contains', userId),
      ...(pendingOnly ? [where('status', '==', 'pending')] : []),
      orderBy('created_at', 'desc'),
      firestoreLimit(limitCount),
    ];
    const legacyQuery = query(requestsRef, ...legacyQueryConstraints);

    const [mobileSnap, legacySnap] = await Promise.all([
      getDocs(mobileQuery).catch(() => ({ docs: [] })), // Graceful fallback
      getDocs(legacyQuery).catch(() => ({ docs: [] })),
    ]);

    // Merge and dedupe
    const requestMap = new Map<string, PaymentRequest>();
    for (const docSnap of [...mobileSnap.docs, ...legacySnap.docs]) {
      if (!requestMap.has(docSnap.id)) {
        requestMap.set(docSnap.id, firestoreToPaymentRequest(docSnap));
      }
    }

    // Sort by created_at desc and limit
    const requests = Array.from(requestMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limitCount);

    return { success: true, requests };
  } catch (error) {
    console.error('[PaymentRequestService] getReceivedPaymentRequests error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch received requests',
    };
  }
}

/**
 * Get payment requests sent by a user
 */
export async function getSentPaymentRequests(
  userId: string,
  options: { limitCount?: number } = {}
): Promise<PaymentRequestListResult> {
  try {
    const { limitCount = 50 } = options;
    const requestsRef = collection(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS);

    // Query both mobile format (senderId) and legacy web format (from_user)
    const mobileQuery = query(
      requestsRef,
      where('senderId', '==', userId),
      orderBy('created_at', 'desc'),
      firestoreLimit(limitCount)
    );

    const legacyQuery = query(
      requestsRef,
      where('from_user', '==', userId),
      orderBy('created_at', 'desc'),
      firestoreLimit(limitCount)
    );

    const [mobileSnap, legacySnap] = await Promise.all([
      getDocs(mobileQuery).catch(() => ({ docs: [] })),
      getDocs(legacyQuery).catch(() => ({ docs: [] })),
    ]);

    // Merge and dedupe
    const requestMap = new Map<string, PaymentRequest>();
    for (const docSnap of [...mobileSnap.docs, ...legacySnap.docs]) {
      if (!requestMap.has(docSnap.id)) {
        requestMap.set(docSnap.id, firestoreToPaymentRequest(docSnap));
      }
    }

    const requests = Array.from(requestMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limitCount);

    return { success: true, requests };
  } catch (error) {
    console.error('[PaymentRequestService] getSentPaymentRequests error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sent requests',
    };
  }
}

/**
 * Get a single payment request by ID
 */
export async function getPaymentRequest(requestId: string): Promise<PaymentRequestResult> {
  try {
    const docSnap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS, requestId));

    if (!docSnap.exists()) {
      return { success: false, error: 'Payment request not found' };
    }

    return { success: true, request: firestoreToPaymentRequest(docSnap) };
  } catch (error) {
    console.error('[PaymentRequestService] getPaymentRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payment request',
    };
  }
}

/**
 * Accept a payment request (marks as accepted, payment happens separately)
 */
export async function acceptPaymentRequest(
  requestId: string,
  recipientId: string
): Promise<PaymentRequestResult> {
  try {
    const requestRef = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS, requestId);
    const docSnap = await getDoc(requestRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Payment request not found' };
    }

    const data = docSnap.data();
    const isRecipient =
      data.recipientId === recipientId || data.to_users?.includes(recipientId);

    if (!isRecipient) {
      return { success: false, error: 'Not authorized to accept this request' };
    }

    if (data.status !== 'pending') {
      return { success: false, error: `Request is already ${data.status}` };
    }

    await updateDoc(requestRef, {
      status: 'accepted',
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const updatedDoc = await getDoc(requestRef);
    const paymentRequest = firestoreToPaymentRequest(updatedDoc);

    // Notify sender
    await createPaymentRequestNotification(
      paymentRequest.senderId,
      'Payment Request Accepted',
      `${paymentRequest.recipientName} accepted your request for $${paymentRequest.amount.toFixed(2)} ${paymentRequest.currency}`,
      'payment_request_accepted',
      {
        requestId,
        recipientId,
        recipientName: paymentRequest.recipientName,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        status: 'accepted',
      }
    );

    return { success: true, request: paymentRequest };
  } catch (error) {
    console.error('[PaymentRequestService] acceptPaymentRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept payment request',
    };
  }
}

/**
 * Reject a payment request
 */
export async function rejectPaymentRequest(
  requestId: string,
  recipientId: string,
  reason?: string
): Promise<PaymentRequestResult> {
  try {
    const requestRef = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS, requestId);
    const docSnap = await getDoc(requestRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Payment request not found' };
    }

    const data = docSnap.data();
    const isRecipient =
      data.recipientId === recipientId || data.to_users?.includes(recipientId);

    if (!isRecipient) {
      return { success: false, error: 'Not authorized to reject this request' };
    }

    if (data.status !== 'pending') {
      return { success: false, error: `Request is already ${data.status}` };
    }

    await updateDoc(requestRef, {
      status: 'rejected',
      rejection_reason: reason || '',
      rejectionReason: reason || '',
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const updatedDoc = await getDoc(requestRef);
    const paymentRequest = firestoreToPaymentRequest(updatedDoc);

    // Notify sender
    const reasonText = reason ? `: ${reason}` : '';
    await createPaymentRequestNotification(
      paymentRequest.senderId,
      'Payment Request Rejected',
      `${paymentRequest.recipientName} rejected your request for $${paymentRequest.amount.toFixed(2)} ${paymentRequest.currency}${reasonText}`,
      'payment_request_rejected',
      {
        requestId,
        recipientId,
        recipientName: paymentRequest.recipientName,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        status: 'rejected',
        reason,
      }
    );

    return { success: true, request: paymentRequest };
  } catch (error) {
    console.error('[PaymentRequestService] rejectPaymentRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject payment request',
    };
  }
}

/**
 * Cancel a payment request (sender only)
 */
export async function cancelPaymentRequest(
  requestId: string,
  senderId: string
): Promise<PaymentRequestResult> {
  try {
    const requestRef = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS, requestId);
    const docSnap = await getDoc(requestRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Payment request not found' };
    }

    const data = docSnap.data();
    const isSender = data.senderId === senderId || data.from_user === senderId;

    if (!isSender) {
      return { success: false, error: 'Only the sender can cancel this request' };
    }

    if (data.status !== 'pending') {
      return { success: false, error: `Request is already ${data.status}` };
    }

    await updateDoc(requestRef, {
      status: 'cancelled',
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const updatedDoc = await getDoc(requestRef);
    const paymentRequest = firestoreToPaymentRequest(updatedDoc);

    // Notify recipient
    await createPaymentRequestNotification(
      paymentRequest.recipientId,
      'Payment Request Cancelled',
      `${paymentRequest.senderName} cancelled their request for $${paymentRequest.amount.toFixed(2)} ${paymentRequest.currency}`,
      'payment_request_cancelled',
      {
        requestId,
        senderId,
        senderName: paymentRequest.senderName,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        status: 'cancelled',
      }
    );

    return { success: true, request: paymentRequest };
  } catch (error) {
    console.error('[PaymentRequestService] cancelPaymentRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel payment request',
    };
  }
}

/**
 * Send a payment reminder for a pending request
 */
export async function sendPaymentReminder(
  requestId: string,
  senderId: string
): Promise<PaymentRequestResult> {
  try {
    const requestRef = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS, requestId);
    const docSnap = await getDoc(requestRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Payment request not found' };
    }

    const data = docSnap.data();
    const isSender = data.senderId === senderId || data.from_user === senderId;

    if (!isSender) {
      return { success: false, error: 'Only the sender can send reminders' };
    }

    if (data.status !== 'pending') {
      return { success: false, error: 'Can only remind for pending requests' };
    }

    const paymentRequest = firestoreToPaymentRequest(docSnap);

    // Send reminder notification
    await createPaymentRequestNotification(
      paymentRequest.recipientId,
      'Payment Reminder',
      `${paymentRequest.senderName} reminded you about their request for $${paymentRequest.amount.toFixed(2)} ${paymentRequest.currency}`,
      'payment_request_reminder',
      {
        requestId,
        senderId,
        senderName: paymentRequest.senderName,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        description: paymentRequest.description,
      }
    );

    // Update last reminder timestamp
    await updateDoc(requestRef, {
      last_reminder_at: serverTimestamp(),
      reminder_count: (data.reminder_count || 0) + 1,
    });

    return { success: true, request: paymentRequest };
  } catch (error) {
    console.error('[PaymentRequestService] sendPaymentReminder error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reminder',
    };
  }
}

/**
 * Get count of pending payment requests for a user
 */
export async function getPendingRequestsCount(userId: string): Promise<number> {
  try {
    const requestsRef = collection(db, FIRESTORE_COLLECTIONS.PAYMENT_REQUESTS);

    // Count for mobile format
    const mobileQuery = query(
      requestsRef,
      where('recipientId', '==', userId),
      where('status', '==', 'pending')
    );

    // Count for legacy format
    const legacyQuery = query(
      requestsRef,
      where('to_users', 'array-contains', userId),
      where('status', '==', 'pending')
    );

    const [mobileSnap, legacySnap] = await Promise.all([
      getDocs(mobileQuery).catch(() => ({ docs: [] })),
      getDocs(legacyQuery).catch(() => ({ docs: [] })),
    ]);

    // Dedupe by ID
    const uniqueIds = new Set<string>();
    for (const doc of [...mobileSnap.docs, ...legacySnap.docs]) {
      uniqueIds.add(doc.id);
    }

    return uniqueIds.size;
  } catch (error) {
    console.error('[PaymentRequestService] getPendingRequestsCount error:', error);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Export Service Object
// ---------------------------------------------------------------------------

export const paymentRequestService = {
  createPaymentRequest,
  getReceivedPaymentRequests,
  getSentPaymentRequests,
  getPaymentRequest,
  acceptPaymentRequest,
  rejectPaymentRequest,
  cancelPaymentRequest,
  sendPaymentReminder,
  getPendingRequestsCount,
};
