/**
 * Web Wallet Service — Non-Custodial Imported Wallet
 *
 * Mirrors the TG wallet lifecycle:
 * - Import: mnemonic → derive keypair → encrypt with PIN → IndexedDB
 * - Unlock: PIN → decrypt → in-memory keypair (auto-locks after 5 min)
 * - Sign: sign transaction with in-memory keypair
 * - Lock: wipe keypair from memory
 *
 * The mnemonic is NEVER stored — only the encrypted secret key.
 */

import { Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  walletFromMnemonic,
  encryptSecretKey,
  decryptSecretKey,
  wipeBytes,
} from '@/lib/crypto/walletCrypto';
import {
  saveEncryptedKey,
  loadEncryptedKey,
  deleteKey,
  hasStoredWallet,
  type StoredWalletData,
} from './storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Auto-lock after 5 minutes of inactivity (matches TG behavior) */
const AUTO_LOCK_MS = 5 * 60 * 1000;

/** Max PIN attempts before lockout */
const MAX_PIN_ATTEMPTS = 5;

/** Lockout duration after max failed attempts (30 seconds) */
const PIN_LOCKOUT_MS = 30 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebWalletInfo {
  address: string;
  exists: boolean;
}

export interface UnlockedWebWallet {
  keypair: Keypair;
  address: string;
}

// ---------------------------------------------------------------------------
// Singleton state (module-scoped, never exported directly)
// ---------------------------------------------------------------------------

let _unlockedKeypair: Keypair | null = null;
let _autoLockTimer: ReturnType<typeof setTimeout> | null = null;
let _failedAttempts = 0;
let _lockoutUntil = 0;
let _onLockCallback: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Activity tracking — resets the auto-lock timer
// ---------------------------------------------------------------------------

function resetAutoLock() {
  if (_autoLockTimer) clearTimeout(_autoLockTimer);
  if (_unlockedKeypair) {
    _autoLockTimer = setTimeout(() => {
      lockWallet();
    }, AUTO_LOCK_MS);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a callback that fires when the wallet auto-locks.
 */
export function onLock(callback: () => void): () => void {
  _onLockCallback = callback;
  return () => {
    _onLockCallback = null;
  };
}

/**
 * Check if the user has an imported wallet in IndexedDB.
 */
export async function getWebWalletInfo(userId: string): Promise<WebWalletInfo> {
  const data = await loadEncryptedKey(userId);
  if (data) {
    return { address: data.publicKey, exists: true };
  }
  return { address: '', exists: false };
}

/**
 * Check if a stored wallet exists for this user.
 */
export { hasStoredWallet };

/**
 * Import a wallet from a BIP39 mnemonic. Derives the keypair,
 * encrypts the secret key with the PIN, and stores in IndexedDB.
 *
 * The mnemonic is wiped from the function scope after derivation.
 *
 * @returns The derived wallet address (base58)
 */
export async function importFromMnemonic(
  userId: string,
  mnemonic: string,
  pin: string,
): Promise<string> {
  const { publicKey, secretKey } = await walletFromMnemonic(mnemonic);
  const address = bs58.encode(publicKey);

  const encrypted = await encryptSecretKey(secretKey, pin);

  await saveEncryptedKey({
    userId,
    encryptedKey: encrypted,
    publicKey: address,
    importedAt: new Date().toISOString(),
  });

  // Wipe secret key from memory
  wipeBytes(secretKey);

  return address;
}

/**
 * Unlock the wallet by decrypting the secret key with the user's PIN.
 * Starts the auto-lock timer.
 *
 * @throws If PIN is wrong, wallet doesn't exist, or rate-limited
 */
export async function unlockWallet(userId: string, pin: string): Promise<UnlockedWebWallet> {
  // Rate limiting check
  if (_failedAttempts >= MAX_PIN_ATTEMPTS) {
    const now = Date.now();
    if (now < _lockoutUntil) {
      const remainingSec = Math.ceil((_lockoutUntil - now) / 1000);
      throw new Error(`Too many failed attempts. Try again in ${remainingSec}s.`);
    }
    // Lockout expired — reset
    _failedAttempts = 0;
    _lockoutUntil = 0;
  }

  const data = await loadEncryptedKey(userId);
  if (!data) {
    throw new Error('No imported wallet found. Import one first.');
  }

  try {
    const secretKey = await decryptSecretKey(data.encryptedKey, pin);
    const keypair = Keypair.fromSecretKey(secretKey);

    // Success — reset attempts and store keypair
    _failedAttempts = 0;
    _lockoutUntil = 0;
    _unlockedKeypair = keypair;
    resetAutoLock();

    return {
      keypair,
      address: keypair.publicKey.toBase58(),
    };
  } catch {
    _failedAttempts++;
    if (_failedAttempts >= MAX_PIN_ATTEMPTS) {
      _lockoutUntil = Date.now() + PIN_LOCKOUT_MS;
    }
    throw new Error('Incorrect PIN');
  }
}

/**
 * Sign a Solana transaction using the in-memory unlocked keypair.
 * Resets the auto-lock timer on each sign.
 *
 * @throws If wallet is locked
 */
export function signTransaction<T extends Transaction | VersionedTransaction>(
  transaction: T,
): T {
  if (!_unlockedKeypair) {
    throw new Error('Wallet is locked. Unlock with your PIN first.');
  }

  if (transaction instanceof Transaction) {
    transaction.sign(_unlockedKeypair);
  } else {
    transaction.sign([_unlockedKeypair]);
  }

  resetAutoLock();
  return transaction;
}

/**
 * Get the public key of the unlocked wallet, or null if locked.
 */
export function getUnlockedAddress(): string | null {
  return _unlockedKeypair?.publicKey.toBase58() ?? null;
}

/**
 * Check if the wallet is currently unlocked (keypair in memory).
 */
export function isUnlocked(): boolean {
  return _unlockedKeypair !== null;
}

/**
 * Lock the wallet — wipe the keypair from memory.
 */
export function lockWallet(): void {
  if (_unlockedKeypair) {
    // Wipe the secret key bytes
    wipeBytes(_unlockedKeypair.secretKey);
    _unlockedKeypair = null;
  }
  if (_autoLockTimer) {
    clearTimeout(_autoLockTimer);
    _autoLockTimer = null;
  }
  _onLockCallback?.();
}

/**
 * Delete the imported wallet from IndexedDB and lock.
 */
export async function deleteWebWallet(userId: string): Promise<void> {
  lockWallet();
  await deleteKey(userId);
}

/**
 * Change the PIN for an imported wallet. Decrypts with old PIN,
 * re-encrypts with new PIN.
 */
export async function changePin(
  userId: string,
  oldPin: string,
  newPin: string,
): Promise<void> {
  const data = await loadEncryptedKey(userId);
  if (!data) {
    throw new Error('No imported wallet found');
  }

  const secretKey = await decryptSecretKey(data.encryptedKey, oldPin);
  const newEncrypted = await encryptSecretKey(secretKey, newPin);

  await saveEncryptedKey({
    ...data,
    encryptedKey: newEncrypted,
  });

  wipeBytes(secretKey);
}
