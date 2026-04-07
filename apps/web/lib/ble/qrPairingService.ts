/**
 * QR Pairing Service — Firestore Relay Fallback
 *
 * Implements the QR-code-based wallet pairing flow for browsers that don't
 * support Web Bluetooth (Firefox, Safari). Uses Firestore `walletPairingSessions`
 * as an end-to-end encrypted relay — Firestore only ever sees ciphertext.
 *
 * Security model (identical to BLE flow):
 * - ECDH keys are ephemeral — generated fresh per session, never stored
 * - Wallet payload is double-encrypted: inner (PIN + AES-GCM) + outer (ECDH + AES-GCM)
 * - Firestore only receives ciphertext — the relay can't read the wallet credentials
 * - Sessions expire in 2 minutes
 * - Only the session creator (web) can read the result (authenticated Firestore access)
 *
 * Flow:
 * 1. Web generates ECDH keypair + session ID
 * 2. Web creates walletPairingSessions/{sessionId} with webECDHPubKey
 * 3. Web generates QR code containing: wesplit://wallet-pair?sessionId={id}
 * 4. Mobile scans QR → reads session → gets webECDHPubKey
 * 5. Mobile: generate ECDH keypair, derive shared secret, encrypt wallet data
 * 6. Mobile updates doc: { mobileECDHPubKey, encryptedPayload, status: 'completed' }
 * 7. Web onSnapshot fires → derive shared secret → decrypt payload → return result
 */

import QRCode from 'qrcode';
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  generateECDHKeyPair,
  deriveSharedSecret,
  decryptWithSharedKey,
  type ECDHKeyPair,
} from './crypto';
import type { BLEPairingResult } from './bleCentral';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = 'walletPairingSessions';

/** Session expires after 2 minutes */
const SESSION_TTL_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QRPairingStatus =
  | 'pending'
  | 'scanned'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'error';

export interface WalletPairingSession {
  sessionId: string;
  /** Web's ECDH public key (base64) — written when session is created */
  webECDHPubKey: string;
  /** Mobile's ECDH public key (base64) — written when mobile approves */
  mobileECDHPubKey?: string;
  /** ECDH-encrypted BLEWalletPayload (base64) — written when mobile approves */
  encryptedPayload?: string;
  status: 'pending' | 'scanned' | 'completed' | 'expired' | 'cancelled' | 'error';
  createdAt: unknown;
  expiresAt: unknown;
  /** Firebase UID of the user who received the wallet (written by mobile) */
  userId?: string;
}

export interface QRPairingSession {
  /** Firestore session document ID */
  sessionId: string;
  /** Deep link URL encoded in the QR code */
  deepLink: string;
  /** Base64 PNG data URL for the QR image — use as `<img src={qrDataUrl} />` */
  qrDataUrl: string;
  /** ISO 8601 expiry time for countdown display */
  expiresAt: string;
  /**
   * Promise that resolves when the mobile completes the transfer.
   * Rejects on timeout, cancel, or error.
   */
  waitForResult: Promise<BLEPairingResult>;
  /** Cancel this session */
  cancel: () => Promise<void>;
  /** Remaining seconds (use in UI via polling expiresAt) */
  ttlMs: number;
}

// ---------------------------------------------------------------------------
// In-memory session key store (private key can't leave Web Crypto)
// ---------------------------------------------------------------------------

/** Maps sessionId → ephemeral ECDH keypair (private key stays in Web Crypto) */
const _sessionKeys = new Map<string, ECDHKeyPair>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a QR wallet pairing session.
 *
 * Generates an ephemeral ECDH keypair, writes a Firestore session doc,
 * and returns the QR image + a Promise that resolves when mobile completes.
 *
 * @param userId — Firebase UID of the current web user (for doc association)
 */
export async function createPairingSession(userId: string): Promise<QRPairingSession> {
  // Generate ephemeral ECDH keypair for this session
  const keyPair = await generateECDHKeyPair();

  // Unique session ID with timestamp for easy debugging
  const sessionId = `qr_${userId}_${Date.now()}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const deepLink = `wesplit://wallet-pair?sessionId=${sessionId}`;

  // Store the private key in memory for when mobile responds
  _sessionKeys.set(sessionId, keyPair);

  // Create the Firestore session document
  const sessionRef = doc(db, COLLECTION, sessionId);
  await setDoc(sessionRef, {
    sessionId,
    webECDHPubKey: keyPair.publicKeyBase64,
    status: 'pending' as QRPairingStatus,
    userId, // Creator's UID — mobile will verify and echo this back
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    mobileECDHPubKey: null,
    encryptedPayload: null,
  });

  // Generate QR code PNG data URL
  const qrDataUrl = await QRCode.toDataURL(deepLink, {
    width: 256,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });

  // Session expiry timeout — auto-cancel in Firestore when TTL elapses
  const expiryTimer = setTimeout(async () => {
    _sessionKeys.delete(sessionId);
    try {
      await updateDoc(sessionRef, { status: 'expired' });
    } catch {
      // Session may already be completed/cancelled
    }
  }, SESSION_TTL_MS);

  // Cancel function
  const cancel = async (): Promise<void> => {
    clearTimeout(expiryTimer);
    _sessionKeys.delete(sessionId);
    try {
      await updateDoc(sessionRef, { status: 'cancelled' });
    } catch {
      // Best effort
    }
  };

  // Real-time listener Promise — resolves when mobile completes the transfer
  const waitForResult = new Promise<BLEPairingResult>((resolve, reject) => {
    const unsubscribe = onSnapshot(
      sessionRef,
      async (snap) => {
        if (!snap.exists()) {
          unsubscribe();
          reject(new Error('Pairing session not found'));
          return;
        }

        const data = snap.data() as WalletPairingSession;

        if (data.status === 'expired') {
          clearTimeout(expiryTimer);
          _sessionKeys.delete(sessionId);
          unsubscribe();
          reject(new Error('QR code expired. Please generate a new one.'));
          return;
        }

        if (data.status === 'cancelled') {
          clearTimeout(expiryTimer);
          _sessionKeys.delete(sessionId);
          unsubscribe();
          const err = new Error('Pairing cancelled');
          (err as Error & { name: string }).name = 'UserCancelledError';
          reject(err);
          return;
        }

        if (data.status === 'error') {
          clearTimeout(expiryTimer);
          _sessionKeys.delete(sessionId);
          unsubscribe();
          reject(new Error('Pairing failed on mobile. Please try again.'));
          return;
        }

        if (data.status === 'completed') {
          // Mobile has sent both the ECDH public key and encrypted payload
          if (!data.mobileECDHPubKey || !data.encryptedPayload || !data.userId) {
            unsubscribe();
            reject(new Error('Incomplete pairing data received from mobile'));
            return;
          }

          // Retrieve our private key
          const ourKeyPair = _sessionKeys.get(sessionId);
          if (!ourKeyPair) {
            unsubscribe();
            reject(new Error('Session key not found — session may have expired'));
            return;
          }

          try {
            // Derive ECDH shared secret from our private key + mobile's public key
            const sharedSecret = await deriveSharedSecret(
              ourKeyPair.privateKey,
              data.mobileECDHPubKey,
            );

            // Decrypt the wallet payload
            const decryptedJson = await decryptWithSharedKey(data.encryptedPayload, sharedSecret);
            const payload = JSON.parse(decryptedJson) as {
              publicKey: string;
              encryptedSecretKey: string;
              userId: string;
              timestamp: number;
            };

            // Freshness check
            const ageMs = Date.now() - payload.timestamp;
            if (ageMs > 5 * 60 * 1000) {
              throw new Error('Wallet payload is too old. Please try pairing again.');
            }

            clearTimeout(expiryTimer);
            _sessionKeys.delete(sessionId);
            unsubscribe();

            resolve({
              publicKey: payload.publicKey,
              encryptedSecretKey: payload.encryptedSecretKey,
              userId: payload.userId,
            });

          } catch (err) {
            clearTimeout(expiryTimer);
            _sessionKeys.delete(sessionId);
            unsubscribe();
            reject(err);
          }
        }

        // 'pending' or 'scanned' — keep listening
      },
      (error) => {
        clearTimeout(expiryTimer);
        _sessionKeys.delete(sessionId);
        reject(error);
      },
    );
  });

  return {
    sessionId,
    deepLink,
    qrDataUrl,
    expiresAt: expiresAt.toISOString(),
    waitForResult,
    cancel,
    ttlMs: SESSION_TTL_MS,
  };
}

/**
 * Cancel a QR pairing session by ID.
 * Idempotent — safe to call even if session is already complete.
 */
export async function cancelPairingSession(sessionId: string): Promise<void> {
  _sessionKeys.delete(sessionId);
  try {
    await updateDoc(doc(db, COLLECTION, sessionId), { status: 'cancelled' });
  } catch {
    // Best effort — session may already be gone
  }
}

/**
 * Get the deep link URL for a session (for re-generating QR or sharing).
 */
export function getSessionDeepLink(sessionId: string): string {
  return `wesplit://wallet-pair?sessionId=${sessionId}`;
}

/**
 * Calculate seconds remaining until session expiry.
 * Returns 0 if already expired.
 */
export function getSecondsRemaining(expiresAtIso: string): number {
  const remaining = Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
}
