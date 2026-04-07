/**
 * BLE ECDH Key Exchange — Web Crypto API
 *
 * Implements the ECDH handshake used for the BLE wallet transfer transport layer.
 * This is the OUTER encryption layer — the wallet payload is ALREADY PIN-encrypted
 * by walletCrypto.ts before it reaches here. This adds a second layer for
 * in-transit protection over the BLE channel.
 *
 * All keys are EPHEMERAL — generated fresh per pairing session, never stored.
 *
 * Curve: P-256 (NIST — universally supported in Web Crypto + React Native)
 * KDF: HKDF-SHA-256 (shared secret → 256-bit AES key)
 * Cipher: AES-256-GCM (same as PIN encryption layer for consistency)
 *
 * Cross-platform compatibility:
 * The mobile side (lib/ble/bleCrypto.ts in RN) uses the same P-256 curve and
 * HKDF parameters. ECDH is symmetric by definition:
 *   web.derive(webPriv, mobilePub) === mobile.derive(mobilePriv, webPub)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** P-256 ECDH — also known as prime256v1 or secp256r1 */
const ECDH_CURVE = 'P-256';

/** HKDF info label — scopes the derived key to WeSplit BLE pairing */
const HKDF_INFO: Uint8Array<ArrayBuffer> = (() => {
  const bytes = new TextEncoder().encode('WeSplit BLE Wallet Pairing v1');
  // Copy to a plain ArrayBuffer-backed Uint8Array for Web Crypto API compatibility
  const buf = new Uint8Array(bytes.length);
  buf.set(bytes);
  return buf;
})();

/** AES-GCM IV size in bytes */
const AES_GCM_IV_BYTES = 12;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ECDHKeyPair {
  /** CryptoKey object for ECDH operations — private key stays in Web Crypto, never exported as raw bytes */
  privateKey: CryptoKey;
  /** Raw uncompressed P-256 public key (65 bytes: 0x04 || x || y) */
  publicKeyBytes: Uint8Array;
  /** Base64-encoded public key for wire transmission */
  publicKeyBase64: string;
}

export interface SharedSecret {
  /** Derived AES-256-GCM CryptoKey — ready for encrypt/decrypt */
  aesKey: CryptoKey;
}

// ---------------------------------------------------------------------------
// ECDH Key Generation
// ---------------------------------------------------------------------------

/**
 * Generate an ephemeral P-256 ECDH keypair.
 * Call this once per pairing session and discard afterwards.
 *
 * The private key is non-extractable by design — it stays inside Web Crypto
 * and is garbage-collected when no longer referenced.
 */
export async function generateECDHKeyPair(): Promise<ECDHKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: ECDH_CURVE },
    false, // private key is non-extractable
    ['deriveKey', 'deriveBits'],
  );

  // Export public key as raw uncompressed bytes (65 bytes: 0x04 || x || y)
  const pubKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBytes = new Uint8Array(pubKeyRaw);

  return {
    privateKey: keyPair.privateKey,
    publicKeyBytes,
    publicKeyBase64: uint8ToBase64(publicKeyBytes),
  };
}

// ---------------------------------------------------------------------------
// Shared Secret Derivation
// ---------------------------------------------------------------------------

/**
 * Derive a 256-bit AES-GCM key from our private key and the remote's public key.
 *
 * Uses HKDF-SHA-256 to expand the raw ECDH shared secret into a proper AES key.
 * Both sides derive the same key: ECDH(webPriv, mobilePub) === ECDH(mobilePriv, webPub)
 *
 * @param ourPrivateKey — Our ephemeral ECDH private key (from generateECDHKeyPair)
 * @param theirPublicKeyBase64 — Remote's uncompressed P-256 public key (base64)
 */
export async function deriveSharedSecret(
  ourPrivateKey: CryptoKey,
  theirPublicKeyBase64: string,
): Promise<SharedSecret> {
  const theirPubKeyBytes = base64ToUint8(theirPublicKeyBase64);

  // Import remote's raw public key as a CryptoKey for ECDH
  const theirPublicKey = await crypto.subtle.importKey(
    'raw',
    theirPubKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: ECDH_CURVE },
    false,
    [], // public key — no usages needed, just for ECDH
  );

  // Derive the raw ECDH shared secret bits
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublicKey },
    ourPrivateKey,
    256, // 32 bytes = 256 bits
  );

  // Import shared bits as HKDF key material
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey'],
  );

  // Expand via HKDF-SHA-256 → AES-256-GCM key
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32), // empty salt — session is already ephemeral
      info: HKDF_INFO,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );

  return { aesKey };
}

// ---------------------------------------------------------------------------
// AES-256-GCM Encrypt / Decrypt (ECDH transport layer)
// ---------------------------------------------------------------------------

/**
 * Encrypt data with the ECDH-derived AES key.
 * Wire format: base64(iv[12] || ciphertext)
 *
 * @param data — Plaintext bytes to encrypt (e.g., JSON.stringify(BLEWalletPayload))
 * @param secret — Shared secret from deriveSharedSecret()
 * @returns Base64-encoded IV + ciphertext
 */
export async function encryptWithSharedKey(
  data: Uint8Array | string,
  secret: SharedSecret,
): Promise<string> {
  const plaintext = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    secret.aesKey,
    plaintext.buffer as ArrayBuffer,
  );

  // Pack: iv || ciphertext
  const packed = new Uint8Array(AES_GCM_IV_BYTES + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), AES_GCM_IV_BYTES);

  return uint8ToBase64(packed);
}

/**
 * Decrypt data encrypted with encryptWithSharedKey().
 *
 * @param encryptedBase64 — Base64-encoded IV + ciphertext
 * @param secret — Shared secret from deriveSharedSecret()
 * @returns Decrypted string (plaintext)
 * @throws If the shared key is wrong (AES-GCM tag mismatch)
 */
export async function decryptWithSharedKey(
  encryptedBase64: string,
  secret: SharedSecret,
): Promise<string> {
  const packed = base64ToUint8(encryptedBase64);
  const iv = packed.slice(0, AES_GCM_IV_BYTES);
  const ciphertext = packed.slice(AES_GCM_IV_BYTES);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      secret.aesKey,
      ciphertext.buffer as ArrayBuffer,
    );
  } catch {
    throw new Error('ECDH decryption failed — possible man-in-the-middle or data corruption');
  }

  return new TextDecoder().decode(plaintext);
}

// ---------------------------------------------------------------------------
// Payload helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JSON notification received over BLE WALLET_DATA_CHAR_UUID.
 * Returns null if the bytes cannot be decoded as valid UTF-8 JSON.
 */
export function parseBLENotification(bytes: DataView): unknown | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Serialize a value as JSON bytes for writing to a BLE characteristic.
 */
export function serializeBLEMessage(value: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Base64 helpers (browser-native, no dependencies)
// ---------------------------------------------------------------------------

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
