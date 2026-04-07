/**
 * Shared Wallet Cryptography Utilities
 *
 * Platform-agnostic Ed25519 keypair generation, AES-256-GCM encryption/decryption,
 * PBKDF2 key derivation, and secure memory wipe.
 *
 * Used by both the Web wallet import and TG Mini App wallet.
 * All crypto ops use Web Crypto API (browser-native, no polyfills needed).
 * Keypair generation uses the standard Solana BIP44 HD derivation path
 * (m/44'/501'/0'/0') via ed25519-hd-key — identical to the mobile app.
 */

import { Keypair } from '@solana/web3.js';

// bip39 and ed25519-hd-key are loaded dynamically to keep them out of the
// initial bundle (~150KB+). They are only needed during wallet create/import.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** PBKDF2 iterations — 100k balances security vs mobile perf */
const PBKDF2_ITERATIONS = 100_000;
/** AES-GCM IV size in bytes */
const IV_BYTES = 12;
/** PBKDF2 salt size in bytes */
const SALT_BYTES = 16;
/** Standard Solana BIP44 derivation path — same as mobile app (derive.ts) */
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

// ---------------------------------------------------------------------------
// Keypair Generation
// ---------------------------------------------------------------------------

export interface GeneratedWallet {
  /** Ed25519 public key (32 bytes) */
  publicKey: Uint8Array;
  /** Ed25519 secret key (64 bytes — first 32 are the seed) */
  secretKey: Uint8Array;
  /** BIP39 mnemonic (12 words) for backup/recovery */
  mnemonic: string;
}

/**
 * Dynamically load bip39 and ed25519-hd-key to keep them out of the initial
 * bundle. Returns both modules so they can be used together in one await.
 */
async function loadBip39Deps() {
  const [bip39Mod, hdKeyMod] = await Promise.all([
    import('bip39'),
    import('ed25519-hd-key'),
  ]);
  return { bip39: bip39Mod, derivePath: hdKeyMod.derivePath };
}

/**
 * Derive a Solana Keypair from a BIP39 mnemonic using the standard
 * Solana BIP44 HD derivation path (m/44'/501'/0'/0').
 */
async function deriveKeypairFromMnemonic(mnemonic: string): Promise<Keypair> {
  const { bip39, derivePath } = await loadBip39Deps();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const { key } = derivePath(SOLANA_DERIVATION_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

/**
 * Generate a new Ed25519 keypair with a BIP39 mnemonic.
 * Uses the standard Solana BIP44 HD derivation so the same mnemonic
 * produces the same wallet on both the mobile app and TG Mini App.
 */
export async function generateWallet(): Promise<GeneratedWallet> {
  const { bip39 } = await loadBip39Deps();
  const mnemonic = bip39.generateMnemonic(128); // 12 words = 128 bits
  const keypair = await deriveKeypairFromMnemonic(mnemonic);

  return {
    publicKey: keypair.publicKey.toBytes(),
    secretKey: keypair.secretKey,
    mnemonic,
  };
}

/**
 * Validate a BIP39 mnemonic phrase.
 */
export async function validateMnemonic(mnemonic: string): Promise<boolean> {
  const { bip39 } = await loadBip39Deps();
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Restore a keypair from a BIP39 mnemonic.
 * Produces the exact same keypair as the mobile app for the same mnemonic.
 */
export async function walletFromMnemonic(mnemonic: string): Promise<Omit<GeneratedWallet, 'mnemonic'>> {
  const { bip39 } = await loadBip39Deps();
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }
  const keypair = await deriveKeypairFromMnemonic(mnemonic);
  return { publicKey: keypair.publicKey.toBytes(), secretKey: keypair.secretKey };
}

// ---------------------------------------------------------------------------
// PBKDF2 Key Derivation
// ---------------------------------------------------------------------------

/**
 * Derive a 256-bit AES key from a user PIN using PBKDF2-SHA256.
 */
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  const pinKey = await crypto.subtle.importKey(
    'raw',
    pinBytes.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    pinKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ---------------------------------------------------------------------------
// AES-256-GCM Encrypt / Decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a secret key with a user-chosen PIN.
 *
 * @param secretKey — raw Ed25519 secret key (64 bytes)
 * @param pin       — user-chosen PIN/passphrase
 * @returns Base64-encoded string: salt + iv + ciphertext
 */
export async function encryptSecretKey(secretKey: Uint8Array, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const aesKey = await deriveKey(pin, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    aesKey,
    secretKey.buffer as ArrayBuffer,
  );

  // Pack: salt || iv || ciphertext
  const packed = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.byteLength);
  packed.set(salt, 0);
  packed.set(iv, SALT_BYTES);
  packed.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES);

  return uint8ToBase64(packed);
}

/**
 * Decrypt a secret key using the user's PIN.
 *
 * @param encryptedBase64 — base64-encoded output from encryptSecretKey
 * @param pin             — user PIN used during encryption
 * @returns Raw Ed25519 secret key (64 bytes)
 * @throws If PIN is wrong (AES-GCM tag mismatch)
 */
export async function decryptSecretKey(encryptedBase64: string, pin: string): Promise<Uint8Array> {
  const packed = base64ToUint8(encryptedBase64);

  const salt = packed.slice(0, SALT_BYTES);
  const iv = packed.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = packed.slice(SALT_BYTES + IV_BYTES);

  const aesKey = await deriveKey(pin, salt);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      aesKey,
      ciphertext.buffer as ArrayBuffer,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error('Incorrect PIN or corrupted data');
  }
}

// ---------------------------------------------------------------------------
// Secure Memory Wipe
// ---------------------------------------------------------------------------

/**
 * Overwrite a Uint8Array with zeros to reduce key exposure in memory.
 * Note: JS engines may still hold copies — this is a best-effort measure.
 */
export function wipeBytes(arr: Uint8Array): void {
  arr.fill(0);
}

// ---------------------------------------------------------------------------
// Base64 helpers (browser-native, no dependencies)
// ---------------------------------------------------------------------------

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
