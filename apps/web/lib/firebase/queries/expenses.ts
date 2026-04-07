/**
 * Shared wallet expense Firestore queries.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SharedWalletExpense, ExpenseSplit } from '@/types';

// ---------------------------------------------------------------------------
// Shared Wallet Expenses
// ---------------------------------------------------------------------------

/** Fetch expenses for a shared wallet */
export async function getWalletExpenses(
  walletId: string,
  maxResults = 50,
): Promise<SharedWalletExpense[]> {
  // Query both camelCase (web-created: sharedWalletId) and snake_case (mobile-created: wallet_id)
  const camelPromise = getDocs(query(
    collection(db, 'sharedWalletExpenses'),
    where('sharedWalletId', '==', walletId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(maxResults),
  )).catch(() => null);

  const snakePromise = getDocs(query(
    collection(db, 'sharedWalletExpenses'),
    where('wallet_id', '==', walletId),
    where('status', '==', 'active'),
    orderBy('created_at', 'desc'),
    firestoreLimit(maxResults),
  )).catch(() => null);

  const [camelSnap, snakeSnap] = await Promise.all([camelPromise, snakePromise]);

  // Merge and deduplicate by document ID
  const seen = new Set<string>();
  const results: SharedWalletExpense[] = [];
  const allDocs = [
    ...(camelSnap?.docs ?? []),
    ...(snakeSnap?.docs ?? []),
  ];
  for (const d of allDocs) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      results.push({ id: d.id, ...d.data() } as SharedWalletExpense);
    }
  }

  // Sort by createdAt desc and limit
  return results
    .sort((a, b) => {
      const aAny = a as unknown as Record<string, { seconds?: number } | undefined>;
      const bAny = b as unknown as Record<string, { seconds?: number } | undefined>;
      const aTime = aAny.createdAt?.seconds ?? aAny.created_at?.seconds ?? 0;
      const bTime = bAny.createdAt?.seconds ?? bAny.created_at?.seconds ?? 0;
      return bTime - aTime;
    })
    .slice(0, maxResults);
}

/** Fetch a single expense by ID */
export async function getExpenseById(expenseId: string): Promise<SharedWalletExpense | null> {
  const snap = await getDoc(doc(db, 'sharedWalletExpenses', expenseId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SharedWalletExpense;
}

/** Create a new expense in a shared wallet */
export async function createExpense(params: {
  walletId: string;
  name: string;
  amount: number;
  date: string;
  splitMethod: 'equal' | 'custom';
  splitBetween: ExpenseSplit[];
  recordedById: string;
  recordedByName: string;
  note?: string;
  /** Optional receipt photo URL (from Firebase Storage) */
  receiptUrl?: string;
}): Promise<string> {
  // Pre-generate the doc ID so callers can use it for Storage paths
  const expenseRef = doc(collection(db, 'sharedWalletExpenses'));

  const data: Record<string, unknown> = {
    sharedWalletId: params.walletId,
    sharedWalletFirebaseDocId: params.walletId,
    name: params.name,
    amount: params.amount,
    currency: 'USDC',
    amountInUSDC: params.amount,
    exchangeRate: 1,
    date: params.date,
    splitMethod: params.splitMethod,
    splitBetween: params.splitBetween,
    recordedById: params.recordedById,
    recordedByName: params.recordedByName,
    // Dual-format for mobile compat
    payerId: params.recordedById,
    payerName: params.recordedByName,
    createdBy: params.recordedById,
    fundingStatus: 'funded',
    status: 'active',
    note: params.note ?? '',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // snake_case for mobile compat
    shared_wallet_id: params.walletId,
    wallet_id: params.walletId,
    split_method: params.splitMethod,
    recorded_by_id: params.recordedById,
    recorded_by_name: params.recordedByName,
    created_by: params.recordedById,
  };

  // Add receipt fields only when provided (dual-format for mobile compat)
  if (params.receiptUrl) {
    data.receipt_url = params.receiptUrl;
    data.receiptUrl = params.receiptUrl;
    data.has_receipt = true;
    data.hasReceipt = true;
  }

  await setDoc(expenseRef, data);
  return expenseRef.id;
}

/** Delete an expense (creator only) */
export async function deleteExpense(expenseId: string): Promise<void> {
  await deleteDoc(doc(db, 'sharedWalletExpenses', expenseId));
}
