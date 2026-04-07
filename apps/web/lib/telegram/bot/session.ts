/**
 * Telegram Bot — Firestore Session Adapter
 *
 * Implements grammY's StorageAdapter<T> interface backed by Firestore
 * collection `telegramBotSessions`. Each session key maps to a document
 * in that collection.
 *
 * Session key format (grammY default): `${chat_id}:${user_id}` for group
 * sessions, or just `${user_id}` for private chats.
 *
 * No dependency on `@grammyjs/storage-firestore` — uses firebase-admin
 * Firestore directly (same instance as other API routes).
 */
import type { StorageAdapter } from 'grammy';
import type { SessionData } from './types';

// ---------------------------------------------------------------------------
// Helper: get Firestore lazily (server-side only)
// ---------------------------------------------------------------------------

async function getDb() {
  const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
  const admin = await getFirebaseAdmin();
  return admin.firestore();
}

const SESSION_COLLECTION = 'telegramBotSessions';

// ---------------------------------------------------------------------------
// FirestoreSessionAdapter
// ---------------------------------------------------------------------------

export class FirestoreSessionAdapter implements StorageAdapter<SessionData> {
  async read(key: string): Promise<SessionData | undefined> {
    try {
      const db = await getDb();
      const doc = await db.collection(SESSION_COLLECTION).doc(encodeKey(key)).get();
      if (!doc.exists) return undefined;
      const data = doc.data();
      if (!data) return undefined;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _key, _updatedAt, ...sessionData } = data;
      return sessionData as SessionData;
    } catch (err) {
      console.error('[BotSession] read error:', err);
      return undefined;
    }
  }

  async write(key: string, value: SessionData): Promise<void> {
    try {
      const db = await getDb();
      await db.collection(SESSION_COLLECTION).doc(encodeKey(key)).set({
        ...value,
        _key: key,
        _updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[BotSession] write error:', err);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await getDb();
      await db.collection(SESSION_COLLECTION).doc(encodeKey(key)).delete();
    } catch (err) {
      console.error('[BotSession] delete error:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encode session key for Firestore doc ID.
 * Firestore doc IDs can't contain `/` so we replace with `__`.
 * grammY keys use `{chatId}:{userId}` which is safe, but just in case.
 */
function encodeKey(key: string): string {
  return key.replace(/\//g, '__').replace(/:/g, '_');
}
