/**
 * TG Mini App — Non-Custodial Wallet Service
 *
 * Manages the full wallet lifecycle for Telegram users:
 * - Create: generate Ed25519 keypair → encrypt with PIN → store in CloudStorage
 * - Load: read encrypted blob from CloudStorage → decrypt with PIN → return keypair
 * - Sign: decrypt key, sign a Solana transaction, wipe key from memory
 * - Export: reveal mnemonic for backup
 * - Change PIN: re-encrypt with a new PIN
 *
 * Storage layout in Telegram CloudStorage (per-bot, per-user):
 *   "ws_wallet_enc"   — AES-256-GCM encrypted secret key (base64)
 *   "ws_wallet_pub"   — public key as base58 string
 *   "ws_wallet_hint"  — optional PIN hint (user-provided)
 *   "ws_wallet_v"     — schema version for future migrations
 *
 * The mnemonic is shown ONCE during creation for the user to write down.
 * It is never stored in CloudStorage — only the encrypted secret key is.
 */

import { Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { cloudStorage } from '@tma.js/sdk';

import {
  generateWallet,
  walletFromMnemonic,
  encryptSecretKey,
  decryptSecretKey,
  wipeBytes,
} from './crypto';

// ---------------------------------------------------------------------------
// CloudStorage Keys
// ---------------------------------------------------------------------------

const STORAGE_KEYS = {
  ENCRYPTED_KEY: 'ws_wallet_enc',
  PUBLIC_KEY: 'ws_wallet_pub',
  PIN_HINT: 'ws_wallet_hint',
  VERSION: 'ws_wallet_v',
} as const;

const CURRENT_VERSION = '1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletInfo {
  /** Solana address (base58-encoded public key) */
  address: string;
  /** Whether the wallet exists in CloudStorage */
  exists: boolean;
}

export interface CreateWalletResult {
  /** Solana address */
  address: string;
  /** BIP39 mnemonic — show once, user must back it up */
  mnemonic: string;
}

export interface UnlockedWallet {
  /** Solana Keypair for signing */
  keypair: Keypair;
  /** Solana address */
  address: string;
}

// ---------------------------------------------------------------------------
// Dev-mode fallback for CloudStorage
// ---------------------------------------------------------------------------

/** In-memory fallback when running outside Telegram (dev mode). */
const devStore = new Map<string, string>();

function isCloudStorageAvailable(): boolean {
  try {
    return cloudStorage.isSupported();
  } catch {
    return false;
  }
}

async function storageGet(key: string): Promise<string | null> {
  if (isCloudStorageAvailable()) {
    const value = await cloudStorage.getItem(key);
    return value || null;
  }
  // S1-7: sessionStorage fallback is only allowed in non-production environments
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Telegram CloudStorage not available. Please open in Telegram.');
  }
  // Dev fallback: use sessionStorage (not localStorage — clears on tab close, safer) (AR-C2)
  if (typeof window !== 'undefined') {
    console.warn('[DEV] Wallet key read from sessionStorage — not for production');
    return sessionStorage.getItem(`tg_dev_${key}`);
  }
  return devStore.get(key) ?? null;
}

async function storageSet(key: string, value: string): Promise<void> {
  if (isCloudStorageAvailable()) {
    await cloudStorage.setItem(key, value);
    return;
  }
  // S1-7: sessionStorage fallback is only allowed in non-production environments
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Telegram CloudStorage not available. Please open in Telegram.');
  }
  // Dev fallback: use sessionStorage (not localStorage) (AR-C2)
  if (typeof window !== 'undefined') {
    console.warn('[DEV] Wallet key stored in sessionStorage — not for production');
    sessionStorage.setItem(`tg_dev_${key}`, value);
    return;
  }
  devStore.set(key, value);
}

async function storageDelete(keys: string[]): Promise<void> {
  if (isCloudStorageAvailable()) {
    await cloudStorage.deleteItem(keys);
    return;
  }
  // Dev fallback: use sessionStorage (AR-C2)
  for (const key of keys) {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`tg_dev_${key}`);
    }
    devStore.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Wallet Operations
// ---------------------------------------------------------------------------

/**
 * Check if the user already has a wallet stored in CloudStorage.
 * Returns the public address if found, or null.
 */
export async function getWalletInfo(): Promise<WalletInfo> {
  const pubKey = await storageGet(STORAGE_KEYS.PUBLIC_KEY);
  if (pubKey) {
    return { address: pubKey, exists: true };
  }
  return { address: '', exists: false };
}

/**
 * Create a new wallet: generate keypair, encrypt, store in CloudStorage.
 *
 * @param pin — user-chosen PIN for encryption (6+ digits recommended)
 * @param hint — optional PIN hint stored alongside
 * @returns The new address + mnemonic (show mnemonic ONCE for backup)
 */
export async function createWallet(pin: string, hint?: string): Promise<CreateWalletResult> {
  // Don't overwrite an existing wallet
  const existing = await getWalletInfo();
  if (existing.exists) {
    throw new Error('Wallet already exists. Use importWallet to replace it.');
  }

  const { publicKey, secretKey, mnemonic } = await generateWallet();
  const address = bs58.encode(publicKey);

  // Encrypt and store
  const encrypted = await encryptSecretKey(secretKey, pin);
  await storageSet(STORAGE_KEYS.ENCRYPTED_KEY, encrypted);
  await storageSet(STORAGE_KEYS.PUBLIC_KEY, address);
  await storageSet(STORAGE_KEYS.VERSION, CURRENT_VERSION);
  if (hint) {
    await storageSet(STORAGE_KEYS.PIN_HINT, hint);
  }

  // Wipe secret key from memory
  wipeBytes(secretKey);

  return { address, mnemonic };
}

/**
 * Import (restore) a wallet from a BIP39 mnemonic.
 * Overwrites any existing wallet in CloudStorage.
 *
 * @param mnemonic — 12-word BIP39 phrase
 * @param pin — new PIN for encryption
 * @param hint — optional PIN hint
 */
export async function importWallet(
  mnemonic: string,
  pin: string,
  hint?: string,
): Promise<string> {
  const { publicKey, secretKey } = await walletFromMnemonic(mnemonic);
  const address = bs58.encode(publicKey);

  const encrypted = await encryptSecretKey(secretKey, pin);
  await storageSet(STORAGE_KEYS.ENCRYPTED_KEY, encrypted);
  await storageSet(STORAGE_KEYS.PUBLIC_KEY, address);
  await storageSet(STORAGE_KEYS.VERSION, CURRENT_VERSION);
  if (hint) {
    await storageSet(STORAGE_KEYS.PIN_HINT, hint);
  }

  wipeBytes(secretKey);
  return address;
}

/**
 * Unlock the wallet by decrypting the secret key with the user's PIN.
 *
 * @param pin — user's PIN
 * @returns An UnlockedWallet with a Solana Keypair ready for signing.
 *          IMPORTANT: Call `lockWallet()` when done to wipe the key.
 */
export async function unlockWallet(pin: string): Promise<UnlockedWallet> {
  const encrypted = await storageGet(STORAGE_KEYS.ENCRYPTED_KEY);
  if (!encrypted) {
    throw new Error('No wallet found. Create one first.');
  }

  const secretKey = await decryptSecretKey(encrypted, pin);
  const keypair = Keypair.fromSecretKey(secretKey);

  return {
    keypair,
    address: keypair.publicKey.toBase58(),
  };
}

/**
 * Sign a Solana transaction using the unlocked keypair.
 *
 * @param transaction — unsigned Transaction or VersionedTransaction
 * @param pin — user's PIN (decrypts key, signs, wipes)
 * @returns The signed transaction ready for sendRawTransaction
 */
export async function signTransaction<T extends Transaction | VersionedTransaction>(
  transaction: T,
  pin: string,
): Promise<T> {
  const encrypted = await storageGet(STORAGE_KEYS.ENCRYPTED_KEY);
  if (!encrypted) {
    throw new Error('No wallet found');
  }

  const secretKeyBytes = await decryptSecretKey(encrypted, pin);
  const keypair = Keypair.fromSecretKey(secretKeyBytes);

  if (transaction instanceof Transaction) {
    transaction.sign(keypair);
  } else {
    // VersionedTransaction
    transaction.sign([keypair]);
  }

  // Wipe secret key from memory immediately after signing
  wipeBytes(secretKeyBytes);

  return transaction;
}

/**
 * Change the wallet PIN. Decrypts with old PIN, re-encrypts with new PIN.
 */
export async function changePin(oldPin: string, newPin: string): Promise<void> {
  const encrypted = await storageGet(STORAGE_KEYS.ENCRYPTED_KEY);
  if (!encrypted) {
    throw new Error('No wallet found');
  }

  const secretKey = await decryptSecretKey(encrypted, oldPin);
  const newEncrypted = await encryptSecretKey(secretKey, newPin);
  await storageSet(STORAGE_KEYS.ENCRYPTED_KEY, newEncrypted);

  wipeBytes(secretKey);
}

/**
 * Get the stored PIN hint (if any).
 */
export async function getPinHint(): Promise<string | null> {
  return storageGet(STORAGE_KEYS.PIN_HINT);
}

/**
 * Delete the wallet from CloudStorage. IRREVERSIBLE.
 * User must have their mnemonic to recover.
 */
export async function deleteWallet(): Promise<void> {
  await storageDelete([
    STORAGE_KEYS.ENCRYPTED_KEY,
    STORAGE_KEYS.PUBLIC_KEY,
    STORAGE_KEYS.PIN_HINT,
    STORAGE_KEYS.VERSION,
  ]);
}
