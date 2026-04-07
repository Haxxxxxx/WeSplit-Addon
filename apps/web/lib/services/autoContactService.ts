/**
 * Auto Contact Service
 *
 * Automatically creates contacts when users interact with each other.
 * Mirrors mobile app's autoContactService.ts logic.
 *
 * Key behaviors:
 * - Silent operation — no alerts or notifications to users
 * - Caches contact existence to minimize Firestore reads
 * - Deduplicates by user ID, email, and wallet address
 * - Tracks interaction context (transaction, split, payment_request, shared_wallet)
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FIRESTORE_COLLECTIONS, type Contact, type User } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContactSource =
  | 'transaction'
  | 'split'
  | 'payment_request'
  | 'shared_wallet'
  | 'manual';

/** Cache entry for fast contact existence checks */
interface ContactExistenceCacheEntry {
  contactIds: Set<string>; // Set of contact user IDs
  contactEmails: Set<string>; // Set of contact emails (lowercase)
  contactWallets: Set<string>; // Set of contact wallet addresses
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Module-level cache (singleton by ESM design)
// ---------------------------------------------------------------------------

const contactExistenceCache = new Map<string, ContactExistenceCacheEntry>();
const CONTACT_EXISTENCE_CACHE_TTL = 10 * 60_000; // 10 minutes

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get or build contact existence cache for a user
 */
async function getContactExistenceCache(
  userId: string
): Promise<ContactExistenceCacheEntry | null> {
  const cached = contactExistenceCache.get(userId);
  const now = Date.now();

  if (cached && now - cached.timestamp < CONTACT_EXISTENCE_CACHE_TTL) {
    return cached;
  }

  // Cache miss — fetch contacts and build cache
  try {
    const contacts = await getContacts(userId);

    const contactIds = new Set<string>();
    const contactEmails = new Set<string>();
    const contactWallets = new Set<string>();

    contacts.forEach((contact) => {
      if (contact.contact_user_id) {
        contactIds.add(contact.contact_user_id);
      }
      if (contact.email) {
        contactEmails.add(contact.email.toLowerCase().trim());
      }
      if (contact.wallet_address) {
        contactWallets.add(contact.wallet_address.trim());
      }
    });

    const cacheEntry: ContactExistenceCacheEntry = {
      contactIds,
      contactEmails,
      contactWallets,
      timestamp: now,
    };

    contactExistenceCache.set(userId, cacheEntry);
    return cacheEntry;
  } catch (error) {
    console.warn('[AutoContactService] Failed to build contact existence cache:', error);
    return null;
  }
}

/**
 * Invalidate contact existence cache for a user
 */
export function invalidateContactExistenceCache(userId: string): void {
  contactExistenceCache.delete(userId);
}

// ---------------------------------------------------------------------------
// Contact CRUD (used internally and exported for other services)
// ---------------------------------------------------------------------------

/**
 * Get all contacts for a user
 */
export async function getContacts(userId: string): Promise<Contact[]> {
  try {
    // Query by both owner_id (web format) and user_id (mobile format)
    const ownerQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.CONTACTS),
      where('owner_id', '==', userId)
    );

    const userQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.CONTACTS),
      where('user_id', '==', userId)
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
        new Date(b.first_met_at).getTime() - new Date(a.first_met_at).getTime()
    );
  } catch (error) {
    console.error('[AutoContactService] Failed to get contacts:', error);
    return [];
  }
}

/**
 * Get a single contact by ID
 */
export async function getContactById(contactId: string): Promise<Contact | null> {
  try {
    const docSnap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.CONTACTS, contactId));
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      owner_id: data.owner_id || data.user_id || '',
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
      updated_at: data.updated_at?.toDate?.().toISOString() || data.updated_at,
    };
  } catch (error) {
    console.error('[AutoContactService] Failed to get contact by ID:', error);
    return null;
  }
}

/**
 * Create a new contact
 */
export async function createContact(params: {
  ownerId: string;
  contactUserId: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  walletAddress?: string;
  source?: ContactSource;
}): Promise<Contact | null> {
  try {
    const now = new Date().toISOString();
    const docData = {
      // Web format
      owner_id: params.ownerId,
      // Mobile format (backward compat)
      user_id: params.ownerId,
      // Shared
      contact_user_id: params.contactUserId,
      name: params.name,
      email: params.email || '',
      phone: params.phone || '',
      avatar: params.avatar || '',
      wallet_address: params.walletAddress || '',
      isFavorite: false,
      is_favorite: false,
      first_met_at: now,
      interaction_count: 1,
      source: params.source || 'manual',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(
      collection(db, FIRESTORE_COLLECTIONS.CONTACTS),
      docData
    );

    // Invalidate cache
    invalidateContactExistenceCache(params.ownerId);

    return {
      id: docRef.id,
      owner_id: params.ownerId,
      contact_user_id: params.contactUserId,
      name: params.name,
      email: params.email || '',
      phone: params.phone,
      avatar: params.avatar,
      wallet_address: params.walletAddress,
      isFavorite: false,
      first_met_at: now,
      interaction_count: 1,
      source: params.source,
      created_at: now,
    };
  } catch (error) {
    console.error('[AutoContactService] Failed to create contact:', error);
    return null;
  }
}

/**
 * Update contact's last interaction timestamp
 */
export async function updateContactInteraction(contactId: string): Promise<void> {
  try {
    const contactRef = doc(db, FIRESTORE_COLLECTIONS.CONTACTS, contactId);
    const docSnap = await getDoc(contactRef);

    if (docSnap.exists()) {
      const currentCount = docSnap.data().interaction_count || 0;
      await updateDoc(contactRef, {
        last_interaction_at: new Date().toISOString(),
        interaction_count: currentCount + 1,
        updated_at: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('[AutoContactService] Failed to update contact interaction:', error);
  }
}

/**
 * Toggle favorite status for a contact
 */
export async function toggleContactFavorite(
  contactId: string,
  isFavorite: boolean
): Promise<void> {
  try {
    const contactRef = doc(db, FIRESTORE_COLLECTIONS.CONTACTS, contactId);
    await updateDoc(contactRef, {
      isFavorite,
      is_favorite: isFavorite, // Mobile compat
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('[AutoContactService] Failed to toggle favorite:', error);
  }
}

// ---------------------------------------------------------------------------
// Main Auto-Contact Function
// ---------------------------------------------------------------------------

/**
 * Ensure a contact exists for a user, creating it silently if needed.
 *
 * @param userId - User who should have this contact
 * @param contactUser - The user to add as contact (must have id, email, name, wallet_address)
 * @param source - Context for the contact creation
 *
 * This function is SILENT — it never throws and doesn't create notifications.
 * It's designed to be called fire-and-forget from transaction/split/etc flows.
 */
export async function ensureContactExists(
  userId: string,
  contactUser: Partial<User> & { id: string },
  source?: ContactSource
): Promise<void> {
  try {
    // Skip if userId or contactUser.id are missing or same (don't add self as contact)
    if (!userId || !contactUser?.id || userId === contactUser.id) {
      return;
    }

    const contactUserEmail = contactUser.email?.toLowerCase().trim();
    const contactUserWallet = contactUser.wallet_address?.trim();
    const contactUserIdStr = contactUser.id;

    // Check existence using cached contact IDs (much faster than fetching all contacts)
    const existenceCache = await getContactExistenceCache(userId);

    if (existenceCache) {
      const existsById = existenceCache.contactIds.has(contactUserIdStr);
      const existsByEmail =
        contactUserEmail && existenceCache.contactEmails.has(contactUserEmail);
      const existsByWallet =
        contactUserWallet && existenceCache.contactWallets.has(contactUserWallet);

      if (existsById || existsByEmail || existsByWallet) {
        // Contact already exists — optionally update interaction timestamp
        // For now, we skip this to keep the operation lightweight
        return;
      }
    } else {
      // Cache miss — fallback to full contact fetch (should be rare)
      const existingContacts = await getContacts(userId);
      const existingContact = existingContacts.find((contact) => {
        if (contact.contact_user_id === contactUserIdStr) return true;
        if (contactUserEmail && contact.email?.toLowerCase().trim() === contactUserEmail)
          return true;
        if (
          contactUserWallet &&
          contact.wallet_address?.trim() === contactUserWallet
        )
          return true;
        return false;
      });

      if (existingContact) {
        return;
      }
    }

    // Contact doesn't exist — create it
    const contactName =
      contactUser.name ||
      contactUser.email?.split('@')[0] ||
      'Unknown User';

    await createContact({
      ownerId: userId,
      contactUserId: contactUserIdStr,
      name: contactName,
      email: contactUser.email,
      avatar: contactUser.avatar,
      walletAddress: contactUser.wallet_address,
      source,
    });

    if (process.env.NODE_ENV !== 'production') console.debug(
      `[AutoContactService] Contact created: ${contactName} for user ${userId} (source: ${source})`
    );
  } catch (error) {
    // Silent failure — never throw or show alerts
    if (process.env.NODE_ENV !== 'production') console.debug('[AutoContactService] Auto contact creation failed (silent):', error);
  }
}

/**
 * Ensure contacts exist for both parties in a transaction.
 * Call this after a successful transaction.
 *
 * @param senderUser - The user who sent the transaction
 * @param recipientUser - The user who received the transaction
 */
export async function ensureBidirectionalContacts(
  senderUser: Partial<User> & { id: string },
  recipientUser: Partial<User> & { id: string }
): Promise<void> {
  // Fire-and-forget — both operations run in parallel
  await Promise.all([
    ensureContactExists(senderUser.id, recipientUser, 'transaction'),
    ensureContactExists(recipientUser.id, senderUser, 'transaction'),
  ]).catch(() => {
    // Silent — don't affect calling code
  });
}

// ---------------------------------------------------------------------------
// Export service object
// ---------------------------------------------------------------------------

export const autoContactService = {
  getContacts,
  getContactById,
  createContact,
  updateContactInteraction,
  toggleContactFavorite,
  ensureContactExists,
  ensureBidirectionalContacts,
  invalidateContactExistenceCache,
};
