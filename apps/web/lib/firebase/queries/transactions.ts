/**
 * Transaction-related Firestore queries.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction } from '@/types';

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function getUserTransactions(
  userId: string,
  maxResults = 50
): Promise<Transaction[]> {
  // Transactions where the user is either sender or receiver
  const sentQ = query(
    collection(db, 'transactions'),
    where('from_user', '==', userId),
    orderBy('created_at', 'desc'),
    firestoreLimit(maxResults)
  );

  const receivedQ = query(
    collection(db, 'transactions'),
    where('to_user', '==', userId),
    orderBy('created_at', 'desc'),
    firestoreLimit(maxResults)
  );

  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(sentQ),
    getDocs(receivedQ),
  ]);

  const txMap = new Map<string, Transaction>();

  for (const snap of [...sentSnap.docs, ...receivedSnap.docs]) {
    if (!txMap.has(snap.id)) {
      txMap.set(snap.id, { id: snap.id, ...snap.data() } as Transaction);
    }
  }

  // Sort merged results by created_at desc
  // Handle both Firestore Timestamp objects and ISO strings
  return Array.from(txMap.values()).sort((a, b) => {
    const toMs = (v: unknown): number => {
      if (!v) return 0;
      if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
        return (v as { toDate: () => Date }).toDate().getTime();
      }
      return new Date(v as string | number).getTime() || 0;
    };
    return toMs(b.created_at) - toMs(a.created_at);
  });
}

// ---------------------------------------------------------------------------
// Transaction Detail
// ---------------------------------------------------------------------------

export async function getTransactionById(
  txId: string,
): Promise<Transaction | null> {
  const snap = await getDoc(doc(db, 'transactions', txId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Transaction;
}
