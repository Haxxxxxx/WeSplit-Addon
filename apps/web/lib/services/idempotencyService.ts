/**
 * Idempotency Service
 *
 * Prevents duplicate transaction submissions across browser sessions.
 *
 * The in-memory transactionDeduplication module handles concurrent in-flight
 * requests (same tab/session). This service adds **cross-session** protection:
 * if the browser tab crashes or closes after a tx is submitted but before the
 * user sees confirmation, a retry on reload will find the completed result here
 * instead of sending a second on-chain transaction.
 *
 * Keys are deterministic from the transaction intent (userId + context +
 * recipient + amount + time-bucket) and stored in localStorage with a short TTL.
 *
 * Web Implementation Notes:
 * - Uses localStorage instead of MMKV (mobile) for persistence
 * - localStorage is synchronous, so reads don't need async wrappers
 * - Keys are prefixed with 'wesplit:idem:' to avoid collisions
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// TTL for completed idempotency records (5 minutes).
// Long enough to survive tab reload retries, short enough to allow
// legitimate repeat transactions (e.g., two payments to the same person).
const IDEMPOTENCY_TTL_MS = 5 * 60_000;

// Time-bucket width for key generation (5 minutes).
// Two intents within the same bucket with identical params get the same key.
const TIME_BUCKET_MS = 5 * 60_000;

// localStorage key prefix
const STORAGE_PREFIX = 'wesplit:idem:';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored in localStorage alongside the key. */
interface IdempotencyRecord {
  status: 'pending' | 'completed' | 'failed';
  signature?: string;
  txId?: string;
  createdAt: number;
  expiresAt: number;
}

/** Parameters used to generate idempotency keys */
export interface IdempotencyKeyParams {
  userId: string;
  context: string;
  amount: number;
  recipientAddress?: string;
  sharedWalletId?: string;
  splitWalletId?: string;
}

/** Result of an idempotency check */
export interface IdempotencyCheckResult {
  signature: string;
  txId?: string;
}

// ---------------------------------------------------------------------------
// Module-level state (in-memory cache)
// ---------------------------------------------------------------------------

// In-memory mirror of localStorage entries for fast access
// Avoids localStorage read on every check (sync I/O is fast but has overhead)
const cache = new Map<string, IdempotencyRecord>();

// ---------------------------------------------------------------------------
// Storage Helpers
// ---------------------------------------------------------------------------

/**
 * Check if localStorage is available (SSR safety)
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__wesplit_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a record from localStorage
 */
function readFromStorage(key: string): IdempotencyRecord | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as IdempotencyRecord;
  } catch {
    return null;
  }
}

/**
 * Write a record to localStorage
 */
function writeToStorage(key: string, record: IdempotencyRecord): void {
  if (!isStorageAvailable()) return;
  try {
    const ttl = record.expiresAt - Date.now();
    if (ttl <= 0) return;
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(record));
  } catch {
    // Storage quota exceeded or unavailable — in-memory cache still protects this session
    console.warn('[IdempotencyService] Failed to write to localStorage');
  }
}

/**
 * Remove a record from localStorage
 */
function removeFromStorage(key: string): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}

/**
 * Clean up expired entries from localStorage (runs on module load)
 */
function cleanupExpiredStorage(): void {
  if (!isStorageAvailable()) return;
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const record = JSON.parse(raw) as IdempotencyRecord;
            if (now > record.expiresAt) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Corrupted entry — remove it
          keysToRemove.push(key!);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore cleanup errors
  }
}

// Run cleanup on module load
if (typeof window !== 'undefined') {
  cleanupExpiredStorage();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a deterministic idempotency key from transaction parameters.
 * The key includes a time-bucket so that a legitimate repeat payment
 * (identical params, hours later) generates a fresh key.
 */
export function generateIdempotencyKey(params: IdempotencyKeyParams): string {
  const bucket = Math.floor(Date.now() / TIME_BUCKET_MS);
  const target =
    params.recipientAddress ||
    params.sharedWalletId ||
    params.splitWalletId ||
    'unknown';
  // Round amount to 6 decimals (USDC precision) to avoid floating-point drift
  const amt = Math.round(params.amount * 1e6);
  return `${params.userId}:${params.context}:${target}:${amt}:${bucket}`;
}

/**
 * Check whether a transaction with this key has already completed.
 * Returns the existing result if found, `null` otherwise.
 *
 * If `null` is returned the caller MUST later call `markCompleted` or
 * `markFailed` to update the record; otherwise the pending entry will
 * block retries until it expires.
 */
export function check(key: string): IdempotencyCheckResult | null {
  const now = Date.now();

  // 1. Check in-memory cache first (fastest)
  const cached = cache.get(key);
  if (cached) {
    if (now > cached.expiresAt) {
      cache.delete(key);
      removeFromStorage(key);
      return null;
    }
    if (cached.status === 'completed' && cached.signature) {
      if (process.env.NODE_ENV !== 'production') console.debug(`[IdempotencyService] Hit (in-memory): ${key.substring(0, 50)}...`);
      return { signature: cached.signature, txId: cached.txId };
    }
    // 'pending' from a previous crashed attempt — allow retry
    if (cached.status === 'pending') {
      cache.delete(key);
      removeFromStorage(key);
      return null;
    }
    // 'failed' — allow retry
    if (cached.status === 'failed') {
      cache.delete(key);
      removeFromStorage(key);
      return null;
    }
  }

  // 2. Check localStorage (cross-session)
  const stored = readFromStorage(key);
  if (stored) {
    if (now > stored.expiresAt) {
      removeFromStorage(key);
      return null;
    }
    if (stored.status === 'completed' && stored.signature) {
      // Populate in-memory cache for subsequent checks
      cache.set(key, stored);
      if (process.env.NODE_ENV !== 'production') console.debug(`[IdempotencyService] Hit (localStorage): ${key.substring(0, 50)}...`);
      return { signature: stored.signature, txId: stored.txId };
    }
    // pending/failed from prior session — treat as expired, allow retry
    removeFromStorage(key);
  }

  return null;
}

/**
 * Reserve the key as 'pending'. Called right before executing the tx.
 */
export function reserve(key: string): void {
  const now = Date.now();
  const record: IdempotencyRecord = {
    status: 'pending',
    createdAt: now,
    expiresAt: now + IDEMPOTENCY_TTL_MS,
  };
  cache.set(key, record);
  // Fire-and-forget storage write
  writeToStorage(key, record);
}

/**
 * Mark the key as successfully completed with a blockchain signature.
 */
export function markCompleted(key: string, signature: string, txId?: string): void {
  const now = Date.now();
  const record: IdempotencyRecord = {
    status: 'completed',
    signature,
    txId,
    createdAt: now,
    expiresAt: now + IDEMPOTENCY_TTL_MS,
  };
  cache.set(key, record);
  writeToStorage(key, record);
  if (process.env.NODE_ENV !== 'production') console.debug(
    `[IdempotencyService] Key completed: ${key.substring(0, 50)}... sig=${signature.substring(0, 16)}...`
  );
}

/**
 * Mark the key as failed — clears the reservation so a retry is allowed.
 */
export function markFailed(key: string): void {
  cache.delete(key);
  removeFromStorage(key);
}

/**
 * Clear all idempotency records (for testing or emergency cleanup).
 */
export function clearAll(): void {
  cache.clear();
  if (isStorageAvailable()) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}

// ---------------------------------------------------------------------------
// Export service object for convenient import
// ---------------------------------------------------------------------------

export const idempotencyService = {
  generateIdempotencyKey,
  check,
  reserve,
  markCompleted,
  markFailed,
  clearAll,
};
