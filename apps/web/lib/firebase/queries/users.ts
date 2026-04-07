/**
 * User-related Firestore queries.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, User } from '@/types';

// ---------------------------------------------------------------------------
// User CRUD
// ---------------------------------------------------------------------------

export async function getUserDoc(userId: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as User;
}

export async function updateUserProfile(
  userId: string,
  updates: { name?: string; email?: string },
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (updates.name !== undefined) {
    data.name = updates.name.trim();
    data.name_lowercase = updates.name.trim().toLowerCase();
  }
  if (updates.email !== undefined) data.email = updates.email.trim().toLowerCase();
  if (Object.keys(data).length === 0) return;
  await updateDoc(doc(db, 'users', userId), data);
}

// ---------------------------------------------------------------------------
// User Balance (from Firestore cache — the mobile app updates this)
// ---------------------------------------------------------------------------

export async function getUserBalance(
  userId: string
): Promise<{ usdc: number; sol: number }> {
  const user = await getUserDoc(userId);
  if (!user) return { usdc: 0, sol: 0 };

  return {
    usdc: user.usdc_balance ?? 0,
    sol: user.sol_balance ?? 0,
  };
}

// ---------------------------------------------------------------------------
// User Search (contact resolution)
// ---------------------------------------------------------------------------

/** Search users by name, email, or wallet address. Returns up to 10 results. */
export async function searchUsers(
  searchTerm: string,
  excludeUserId?: string,
): Promise<User[]> {
  const term = searchTerm.trim();
  if (!term) return [];

  const usersRef = collection(db, 'users');
  const results = new Map<string, User>();

  // 1. Exact match by wallet address (mobile, web, or telegram)
  if (term.length >= 32) {
    const addressFields = ['wallet_address', 'web_wallet_address', 'telegram_wallet_address'];
    const addressQueries = addressFields.map((field) =>
      getDocs(query(usersRef, where(field, '==', term), firestoreLimit(1))),
    );
    const snaps = await Promise.all(addressQueries);
    for (const snap of snaps) {
      for (const d of snap.docs) {
        results.set(d.id, { id: d.id, ...d.data() } as User);
      }
    }
  }

  // 2. Exact match by email
  if (term.includes('@')) {
    const q = query(usersRef, where('email', '==', term.toLowerCase()), firestoreLimit(1));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      results.set(d.id, { id: d.id, ...d.data() } as User);
    }
  }

  // 3. Name prefix search (Firestore range query trick)
  if (term.length >= 2) {
    const lower = term.toLowerCase();
    const upper = lower + '\uf8ff';
    const q = query(
      usersRef,
      where('name_lowercase', '>=', lower),
      where('name_lowercase', '<=', upper),
      firestoreLimit(10),
    );
    try {
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        results.set(d.id, { id: d.id, ...d.data() } as User);
      }
    } catch {
      // name_lowercase index might not exist — fall back to fetching by name
    }
  }

  // Exclude the searching user
  if (excludeUserId) results.delete(excludeUserId);

  return Array.from(results.values()).slice(0, 10);
}

/** Get users the current user has transacted with (recent contacts). */
export async function getRecentContacts(
  userId: string,
  maxResults = 10,
): Promise<User[]> {
  // Get recent outgoing transactions for unique recipient IDs
  const q = query(
    collection(db, 'transactions'),
    where('from_user', '==', userId),
    orderBy('created_at', 'desc'),
    firestoreLimit(30),
  );
  const snap = await getDocs(q);

  const seenIds = new Set<string>();
  const contactIds: string[] = [];

  for (const d of snap.docs) {
    const toUser = d.data().to_user as string;
    if (toUser && toUser !== userId && !seenIds.has(toUser)) {
      seenIds.add(toUser);
      contactIds.push(toUser);
      if (contactIds.length >= maxResults) break;
    }
  }

  if (contactIds.length === 0) return [];

  // Fetch user docs for those IDs
  const users = await Promise.all(contactIds.map((id) => getUserDoc(id)));
  return users.filter((u): u is User => u !== null);
}
