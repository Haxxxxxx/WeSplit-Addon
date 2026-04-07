/**
 * BLE Wallet Pairing Protocol — Constants & UUIDs
 *
 * Defines the custom GATT service and characteristic UUIDs used for
 * WeSplit's proximity wallet transfer feature (Web Central ↔ Mobile Peripheral).
 *
 * UUID namespace: 6e400001-b5a3-f393-e0a9-e50e24dcca9e
 * (Nordic UART Service namespace — widely allowlisted in BLE stacks)
 */

// ---------------------------------------------------------------------------
// BLE Service & Characteristic UUIDs
// ---------------------------------------------------------------------------

/** Primary GATT service UUID for WeSplit wallet pairing */
export const WESPLIT_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

/**
 * ECDH Public Key characteristic — Web writes its ephemeral P-256 public key here.
 * Mobile reads this to compute the ECDH shared secret.
 * Properties: Write (Central → Peripheral)
 */
export const ECDH_PUBKEY_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

/**
 * Wallet Data characteristic — Mobile sends two notifications over this:
 *   1. Mobile's ephemeral ECDH public key (65 bytes, uncompressed P-256)
 *   2. Encrypted wallet payload (see BLEWalletPayload)
 * Properties: Notify (Peripheral → Central)
 */
export const WALLET_DATA_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// ---------------------------------------------------------------------------
// Protocol Version
// ---------------------------------------------------------------------------

/** Protocol version byte prepended to all payloads for forward compatibility */
export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

/** How long the browser scans for nearby WeSplit devices (ms) */
export const BLE_SCAN_TIMEOUT_MS = 30_000;

/** Maximum time for the full pairing session from connect to receive (ms) */
export const BLE_SESSION_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

/**
 * The wallet credentials transferred from mobile → web over BLE.
 * The encryptedSecretKey is ALREADY PIN-encrypted (AES-256-GCM via walletCrypto.ts)
 * and is stored directly in IndexedDB without modification.
 *
 * The outer ECDH layer adds transport encryption — double-encrypted in transit:
 *   inner: PIN-derived AES-GCM (same key user uses to unlock)
 *   outer: ECDH-derived AES-GCM (ephemeral, discarded after pairing)
 */
export interface BLEWalletPayload {
  /** Solana public key in base58 */
  publicKey: string;
  /** PIN-encrypted secret key — output of encryptSecretKey() from walletCrypto.ts */
  encryptedSecretKey: string;
  /** Firebase UID of the wallet owner (for association on the web side) */
  userId: string;
  /** Unix timestamp (ms) for freshness check — reject if > 5 minutes old */
  timestamp: number;
}

/**
 * The first notification sent by mobile over WALLET_DATA_CHAR_UUID.
 * Carries the mobile's ephemeral ECDH public key for shared secret derivation.
 */
export interface BLEKeyExchangeMessage {
  type: 'key_exchange';
  version: number;
  /** Mobile's uncompressed P-256 ECDH public key (65 bytes, base64-encoded) */
  ecdhPublicKey: string;
}

/**
 * The second notification sent by mobile over WALLET_DATA_CHAR_UUID.
 * Carries the ECDH-encrypted wallet payload.
 */
export interface BLEEncryptedPayload {
  type: 'wallet_data';
  version: number;
  /**
   * AES-256-GCM encrypted BLEWalletPayload.
   * Encrypted with the ECDH-derived shared secret (see lib/ble/crypto.ts).
   * Format: base64(iv[12] || ciphertext)
   */
  encryptedData: string;
}

/** Discriminated union of messages received over WALLET_DATA_CHAR_UUID */
export type BLENotification = BLEKeyExchangeMessage | BLEEncryptedPayload;
