/**
 * Contact-related Firestore queries.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit as firestoreLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Contact } from '@/types';

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

/** Fetch all contacts for a user from the contacts collection */
export async function getUserContacts(
  userId: string,
  maxResults = 100,
): Promise<Contact[]> {
  // Query by both owner_id (web format) and user_id (mobile format)
  const ownerQuery = query(
    collection(db, 'contacts'),
    where('owner_id', '==', userId),
    firestoreLimit(maxResults),
  );

  const userQuery = query(
    collection(db, 'contacts'),
    where('user_id', '==', userId),
    firestoreLimit(maxResults),
  );

  const [ownerSnap, userSnap] = await Promise.all([
    getDocs(ownerQuery).catch(() => ({ docs: [] })),
    getDocs(userQuery).catch(() => ({ docs: [] })),
  ]);

  // Merge and dedupe by ID
  const contactMap = new Map<string, Contact>();
  for (const docSnap of [...ownerSnap.docs, ...userSnap.docs]) {
    if (!contactMap.has(docSnap.id)) {
      const data = docSnap.data();
      contactMap.set(docSnap.id, {
        id: docSnap.id,
        owner_id: data.owner_id || data.user_id || userId,
        contact_user_id: data.contact_user_id || '',
        name: data.name || 'Unknown',
        email: data.email || '',
        phone: data.phone || '',
        avatar: data.avatar || '',
        wallet_address: data.wallet_address || '',
        isFavorite: data.isFavorite ?? data.is_favorite ?? false,
        first_met_at:
          data.first_met_at?.toDate?.().toISOString() ||
          data.first_met_at ||
          new Date().toISOString(),
        last_interaction_at:
          data.last_interaction_at?.toDate?.().toISOString() ||
          data.last_interaction_at,
        interaction_count: data.interaction_count || 0,
        source: data.source,
        created_at:
          data.created_at?.toDate?.().toISOString() ||
          data.created_at ||
          new Date().toISOString(),
        updated_at:
          data.updated_at?.toDate?.().toISOString() || data.updated_at,
      });
    }
  }

  // Sort by first_met_at descending
  return Array.from(contactMap.values()).sort(
    (a, b) =>
      new Date(b.first_met_at).getTime() - new Date(a.first_met_at).getTime(),
  );
}

/** Get favorite contacts for a user */
export async function getFavoriteContacts(userId: string): Promise<Contact[]> {
  const contacts = await getUserContacts(userId);
  return contacts.filter((c) => c.isFavorite);
}

/** Create a new contact */
export async function createContact(params: {
  ownerId: string;
  contactUserId: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  walletAddress?: string;
  source?: Contact['source'];
}): Promise<string> {
  const now = new Date().toISOString();
  const docData = {
    owner_id: params.ownerId,
    user_id: params.ownerId, // Mobile compat
    contact_user_id: params.contactUserId,
    name: params.name,
    email: params.email || '',
    phone: params.phone || '',
    avatar: params.avatar || '',
    wallet_address: params.walletAddress || '',
    isFavorite: false,
    is_favorite: false, // Mobile compat
    first_met_at: now,
    interaction_count: 1,
    source: params.source || 'manual',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'contacts'), docData);
  return docRef.id;
}

/** Update a contact's favorite status */
export async function updateContactFavorite(
  contactId: string,
  isFavorite: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'contacts', contactId), {
    isFavorite,
    is_favorite: isFavorite, // Mobile compat
    updated_at: serverTimestamp(),
  });
}

/** Update a contact's last interaction timestamp */
export async function updateContactInteraction(contactId: string): Promise<void> {
  const contactRef = doc(db, 'contacts', contactId);
  const snap = await getDoc(contactRef);

  if (snap.exists()) {
    const currentCount = snap.data().interaction_count || 0;
    await updateDoc(contactRef, {
      last_interaction_at: new Date().toISOString(),
      interaction_count: currentCount + 1,
      updated_at: serverTimestamp(),
    });
  }
}

/** Delete a contact */
export async function deleteContact(contactId: string): Promise<void> {
  await deleteDoc(doc(db, 'contacts', contactId));
}
