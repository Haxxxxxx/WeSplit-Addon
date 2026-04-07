/**
 * Withdrawal request Firestore queries.
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
import type { WithdrawalRequest } from '@/types';
import { getSharedWalletById } from './sharedWallets';

// ---------------------------------------------------------------------------
// Withdrawal Requests
// ---------------------------------------------------------------------------

export async function createWithdrawalRequest(params: {
  walletId: string;
  requesterId: string;
  requesterName: string;
  amount: number;
  destinationAddress: string;
  note?: string;
}): Promise<string> {
  const requestId = `wr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await setDoc(doc(db, 'sharedWalletWithdrawalRequests', requestId), {
    id: requestId,
    // snake_case (web)
    wallet_id: params.walletId,
    requester_id: params.requesterId,
    destination_address: params.destinationAddress,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    // camelCase (mobile)
    walletId: params.walletId,
    requesterId: params.requesterId,
    requesterName: params.requesterName,
    destinationAddress: params.destinationAddress,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // shared
    amount: params.amount,
    currency: 'USDC',
    status: 'pending',
    approvals: [],
    rejections: [],
    note: params.note ?? '',
  });

  // Notify admins/creator
  const wallet = await getSharedWalletById(params.walletId);
  if (wallet) {
    const admins = wallet.members.filter(
      (m) => (m.role === 'creator' || m.role === 'admin') && m.user_id !== params.requesterId,
    );
    await Promise.all(
      admins.map((m) => {
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          // snake_case (web)
          notification_type: 'withdrawal_request_created',
          user_id: m.user_id,
          from_user: params.requesterId,
          is_read: false,
          created_at: serverTimestamp(),
          // camelCase (mobile)
          notificationType: 'withdrawal_request_created',
          userId: m.user_id,
          fromUser: params.requesterId,
          isRead: false,
          createdAt: serverTimestamp(),
          // shared
          type: 'withdrawal_request_created',
          title: 'Withdrawal Request',
          body: `${params.requesterName} requested $${params.amount.toFixed(2)} from "${wallet.name}"`,
          read: false,
          data: {
            wallet_id: params.walletId,
            request_id: requestId,
            requester_id: params.requesterId,
            amount: params.amount,
          },
        });
      }),
    );
  }

  return requestId;
}

export async function getWalletWithdrawalRequests(
  walletId: string,
): Promise<WithdrawalRequest[]> {
  // Query both snake_case (web-created) and camelCase (mobile-created) field names
  const snakePromise = getDocs(query(
    collection(db, 'sharedWalletWithdrawalRequests'),
    where('wallet_id', '==', walletId),
    orderBy('created_at', 'desc'),
    firestoreLimit(20),
  )).catch(() => null);

  const camelPromise = getDocs(query(
    collection(db, 'sharedWalletWithdrawalRequests'),
    where('walletId', '==', walletId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(20),
  )).catch(() => null);

  const [snakeSnap, camelSnap] = await Promise.all([snakePromise, camelPromise]);

  // Merge and deduplicate by document ID
  const seen = new Set<string>();
  const results: WithdrawalRequest[] = [];
  const allDocs = [
    ...(snakeSnap?.docs ?? []),
    ...(camelSnap?.docs ?? []),
  ];
  for (const d of allDocs) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      results.push({ id: d.id, ...d.data() } as WithdrawalRequest);
    }
  }

  // Sort by created_at desc
  return results.sort((a, b) => {
    const aData = a as unknown as Record<string, { seconds?: number } | undefined>;
    const bData = b as unknown as Record<string, { seconds?: number } | undefined>;
    const aTime = aData.created_at?.seconds ?? aData.createdAt?.seconds ?? 0;
    const bTime = bData.created_at?.seconds ?? bData.createdAt?.seconds ?? 0;
    return bTime - aTime;
  });
}

export async function updateWithdrawalRequestStatus(
  requestId: string,
  userId: string,
  action: 'approve' | 'reject',
): Promise<void> {
  const ref = doc(db, 'sharedWalletWithdrawalRequests', requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Request not found');

  const data = snap.data();
  const approvals = [...(data.approvals || [])];
  const rejections = [...(data.rejections || [])];

  if (action === 'approve') {
    if (!approvals.includes(userId)) approvals.push(userId);
    await updateDoc(ref, {
      approvals,
      status: 'approved',
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
      resolved_by: userId,
      resolvedBy: userId,
      resolved_at: serverTimestamp(),
      resolvedAt: serverTimestamp(),
    });
  } else {
    if (!rejections.includes(userId)) rejections.push(userId);
    await updateDoc(ref, {
      rejections,
      status: 'rejected',
      updated_at: serverTimestamp(),
      updatedAt: serverTimestamp(),
      resolved_by: userId,
      resolvedBy: userId,
      resolved_at: serverTimestamp(),
      resolvedAt: serverTimestamp(),
    });
  }
}
