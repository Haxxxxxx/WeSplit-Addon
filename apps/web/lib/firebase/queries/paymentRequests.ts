/**
 * Payment request Firestore queries.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PaymentRequest } from '@/types';

// ---------------------------------------------------------------------------
// Payment Requests
// ---------------------------------------------------------------------------

export async function createPaymentRequest(params: {
  fromUserId: string;
  fromName: string;
  fromWallet: string;
  toUserIds: string[];
  amount: number;
  note?: string;
}): Promise<string> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const amountPerPerson = params.amount / params.toUserIds.length;

  const requestRef = doc(db, 'paymentRequests', requestId);
  await setDoc(requestRef, {
    id: requestId,
    // snake_case (web)
    from_user: params.fromUserId,
    from_name: params.fromName,
    from_wallet: params.fromWallet,
    to_users: params.toUserIds,
    amount_per_person: amountPerPerson,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    // camelCase (mobile) — mobile reads senderId/recipientId for single-recipient requests
    fromUser: params.fromUserId,
    fromName: params.fromName,
    fromWallet: params.fromWallet,
    toUsers: params.toUserIds,
    amountPerPerson: amountPerPerson,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // Mobile-compatible single-recipient fields (uses first toUserId)
    senderId: params.fromUserId,
    senderName: params.fromName,
    recipientId: params.toUserIds[0] ?? '',
    // shared
    amount: params.amount,
    currency: 'USDC',
    note: params.note ?? '',
    status: 'pending',
  });

  // Create a notification for each recipient
  await Promise.all(
    params.toUserIds.map((toUserId) => {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        // snake_case (web)
        notification_type: 'payment_request_received',
        user_id: toUserId,
        from_user: params.fromUserId,
        is_read: false,
        created_at: serverTimestamp(),
        // camelCase (mobile)
        notificationType: 'payment_request_received',
        userId: toUserId,
        fromUser: params.fromUserId,
        isRead: false,
        createdAt: serverTimestamp(),
        // shared
        type: 'payment_request_received',
        title: 'Payment Request',
        body: `${params.fromName} requested $${amountPerPerson.toFixed(2)} USDC`,
        read: false,
        data: {
          request_id: requestId,
          from_user: params.fromUserId,
          amount: amountPerPerson,
          currency: 'USDC',
        },
      });
    }),
  );

  return requestId;
}

export async function getReceivedPaymentRequests(
  userId: string,
  maxResults = 20,
): Promise<PaymentRequest[]> {
  const q = query(
    collection(db, 'paymentRequests'),
    where('to_users', 'array-contains', userId),
    orderBy('created_at', 'desc'),
    firestoreLimit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRequest));
}

export async function getSentPaymentRequests(
  userId: string,
  maxResults = 20,
): Promise<PaymentRequest[]> {
  const q = query(
    collection(db, 'paymentRequests'),
    where('from_user', '==', userId),
    orderBy('created_at', 'desc'),
    firestoreLimit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRequest));
}

export async function getPaymentRequestById(requestId: string): Promise<PaymentRequest | null> {
  const snap = await getDoc(doc(db, 'paymentRequests', requestId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PaymentRequest;
}

export async function updatePaymentRequestStatus(
  requestId: string,
  status: 'accepted' | 'rejected' | 'cancelled',
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'paymentRequests', requestId), {
    status,
    updated_at: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updated_at_iso: now,
  });
}
