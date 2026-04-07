/**
 * Transaction Deduplication Service (Web — functional module)
 *
 * Ports the mobile TransactionDeduplicationService singleton to an ESM
 * functional module. The module itself IS the singleton — ESM guarantees a
 * single module instance per process, so no class is needed.
 *
 * Key behaviors:
 *  - In-flight dedup keyed on `userId:to:roundedAmount:timeWindow`
 *    where timeWindow = Math.floor(timestamp / 30_000) (30-second windows)
 *  - Dual-window registration (current + previous) to survive boundary crossings
 *  - 60-second timeout for in-flight entries
 *  - Per-user send lock that serializes concurrent sends (queue/chain pattern)
 *  - 60-second cleanup interval purges stale entries automatically
 */

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface InFlightEntry {
  key: string;
  userId: string;
  to: string;
  amount: number;
  timestamp: number;
  promise: Promise<any>;
}

// ---------------------------------------------------------------------------
// Module-level state (singleton by ESM design)
// ---------------------------------------------------------------------------

const TRANSACTION_TIMEOUT_MS = 60_000; // 60 seconds
const MAX_LOCK_AGE_MS = 120_000;       // 2 minutes
const CLEANUP_INTERVAL_MS = 60_000;    // 60 seconds

const inFlight = new Map<string, InFlightEntry>();
const userSendQueues = new Map<string, Promise<void>>();
const userSendLockTimestamps = new Map<string, number>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildKeys(
  userId: string,
  to: string,
  amount: number,
  timestamp: number
): { currentKey: string; previousKey: string } {
  const roundedAmount = Math.round(amount * 100) / 100;
  const currentWindow = Math.floor(timestamp / 30_000);
  const previousWindow = currentWindow - 1;
  return {
    currentKey: `${userId}:${to}:${roundedAmount}:${currentWindow}`,
    previousKey: `${userId}:${to}:${roundedAmount}:${previousWindow}`,
  };
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of inFlight.entries()) {
    if (now - entry.timestamp > TRANSACTION_TIMEOUT_MS) {
      inFlight.delete(key);
    }
  }
}

// Start the background cleanup interval immediately on module load.
// In Next.js server environments this runs per-process; on the client it runs
// until page unload — both are fine for this use-case.
setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Atomically check whether a matching transaction is already in-flight, and
 * register the new one if not.
 *
 * Checks BOTH the current and previous 30-second time windows so that
 * transactions registered just before a window boundary are still detected.
 *
 * @returns `existing` — the in-flight Promise if a duplicate was detected
 *          (caller should await it instead of sending again), or `null` if
 *          this is a fresh registration.
 *          `cleanup` — call this when the transaction settles (success or
 *          failure) to remove it from the registry.
 */
export function checkAndRegisterInFlight(
  userId: string,
  to: string,
  amount: number,
  promise: Promise<any>
): { existing: Promise<any> | null; cleanup: () => void } {
  const now = Date.now();
  const { currentKey, previousKey } = buildKeys(userId, to, amount, now);

  // Atomic check — both windows, synchronously
  const found = inFlight.get(currentKey) ?? inFlight.get(previousKey);

  if (found) {
    const age = Date.now() - found.timestamp;
    if (age < TRANSACTION_TIMEOUT_MS) {
      console.warn(
        `[transactionDeduplication] Duplicate transaction detected — returning existing promise. ` +
        `key=${found.key.substring(0, 50)}... age=${age}ms user=${userId} to=${to.substring(0, 8)}... amount=${amount}`
      );
      return { existing: found.promise, cleanup: () => {} };
    }
    // Expired — evict before registering the fresh one
    inFlight.delete(found.key);
  }

  const entry: InFlightEntry = {
    key: currentKey,
    userId,
    to,
    amount,
    timestamp: now,
    promise,
  };

  // Register in BOTH windows so boundary-crossing lookups always find it
  inFlight.set(currentKey, entry);
  inFlight.set(previousKey, entry);

  return {
    existing: null,
    cleanup: () => {
      inFlight.delete(currentKey);
      inFlight.delete(previousKey);
    },
  };
}

/**
 * Acquire a per-user send lock.
 *
 * If another send for this `userId` is already in-flight, the returned Promise
 * resolves only after that send completes, serialising concurrent sends from
 * the same user and preventing balance-check race conditions.
 *
 * Stale locks older than 2 minutes are skipped automatically.
 *
 * @returns A release function — **always call it** in a finally block to
 *          unblock the next queued send.
 *
 * @example
 * const release = await acquireUserSendLock(userId);
 * try {
 *   await sendTransaction(...);
 * } finally {
 *   release();
 * }
 */
export async function acquireUserSendLock(userId: string): Promise<() => void> {
  const previousPromise = userSendQueues.get(userId) ?? Promise.resolve();
  const previousTimestamp = userSendLockTimestamps.get(userId) ?? 0;

  const isStale =
    previousTimestamp > 0 &&
    Date.now() - previousTimestamp > MAX_LOCK_AGE_MS;

  let releaseLock!: () => void;
  const myPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  // Synchronously set this promise as the new tail BEFORE any await, so
  // subsequent callers see it immediately
  userSendQueues.set(userId, myPromise);
  userSendLockTimestamps.set(userId, Date.now());

  if (!isStale) {
    try {
      await previousPromise;
    } catch {
      // Previous send failed — that's fine, we still proceed
    }
  } else {
    console.warn(
      `[transactionDeduplication] Per-user send lock was stale, skipping wait. ` +
      `userId=${userId} lockAge=${Date.now() - previousTimestamp}ms maxAge=${MAX_LOCK_AGE_MS}ms`
    );
  }

  return () => {
    releaseLock();
    // Only clean up if we're still the tail (nobody else has queued behind us)
    if (userSendQueues.get(userId) === myPromise) {
      userSendQueues.delete(userId);
      userSendLockTimestamps.delete(userId);
    }
  };
}

/**
 * Wipe all module state. Intended for tests or emergency use — not for normal
 * production flows.
 */
export function clearAll(): void {
  inFlight.clear();
  userSendQueues.clear();
  userSendLockTimestamps.clear();
}
