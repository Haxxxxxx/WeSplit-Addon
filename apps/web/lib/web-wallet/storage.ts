/**
 * Web Wallet — IndexedDB Encrypted Key Storage
 *
 * Uses IndexedDB (not localStorage) because:
 * - Survives storage pressure better than localStorage
 * - Binary-friendly (no manual base64 encoding needed for blobs)
 * - Same-origin sandboxed, no cross-tab race conditions with structured clone
 *
 * Schema: DB "wesplit-wallet" → store "encrypted_keys" → key = userId
 */

const DB_NAME = 'wesplit-wallet';
const STORE_NAME = 'encrypted_keys';
const DB_VERSION = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredWalletData {
  /** User's Firebase UID */
  userId: string;
  /** AES-256-GCM encrypted secret key (base64) */
  encryptedKey: string;
  /** Public key as base58 string */
  publicKey: string;
  /** Timestamp of when the wallet was imported */
  importedAt: string;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save an encrypted wallet key to IndexedDB.
 */
export async function saveEncryptedKey(data: StoredWalletData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Load an encrypted wallet key from IndexedDB.
 * Returns null if no wallet is stored for this user.
 */
export async function loadEncryptedKey(userId: string): Promise<StoredWalletData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(userId);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Delete a wallet key from IndexedDB.
 */
export async function deleteKey(userId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(userId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Check if a wallet exists in IndexedDB for this user.
 */
export async function hasStoredWallet(userId: string): Promise<boolean> {
  const data = await loadEncryptedKey(userId);
  return data !== null;
}
