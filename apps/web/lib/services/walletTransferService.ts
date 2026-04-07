/**
 * Wallet Transfer Service
 *
 * Handles secure wallet linking from mobile app to web via QR code.
 *
 * Flow:
 * 1. Web generates a transfer session with unique nonce
 * 2. QR code contains session ID + nonce (NO private keys!)
 * 3. Mobile scans QR, signs a challenge with the wallet
 * 4. Mobile sends signed proof to confirm endpoint
 * 5. Web verifies signature and links wallet to user
 *
 * Security:
 * - Sessions expire after 5 minutes (TTL)
 * - Nonce prevents replay attacks
 * - Signature verification ensures wallet ownership
 * - No private keys transmitted over QR
 */

import { v4 as uuidv4 } from 'uuid';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransferSessionStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';

export interface WalletTransferSession {
  id: string;
  userId: string;
  nonce: string;
  status: TransferSessionStatus;
  walletAddress?: string;
  walletPublicKey?: string;
  createdAt: string;
  expiresAt: string;
  confirmedAt?: string;
  signature?: string;
}

export interface CreateSessionResult {
  success: boolean;
  session?: WalletTransferSession;
  qrPayload?: string;
  error?: string;
}

export interface ConfirmSessionResult {
  success: boolean;
  walletAddress?: string;
  error?: string;
}

export interface QRPayload {
  sessionId: string;
  nonce: string;
  userId: string;
  action: 'link_wallet';
  expiresAt: number; // Unix timestamp
  webAppUrl: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION_NAME = 'wallet_transfer_sessions';
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.wesplit.xyz';

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure nonce.
 */
function generateNonce(): string {
  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for server-side
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bs58.encode(randomBytes);
}

/**
 * Create a new wallet transfer session.
 */
export async function createTransferSession(userId: string): Promise<CreateSessionResult> {
  try {
    const sessionId = uuidv4();
    const nonce = generateNonce();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    const session: WalletTransferSession = {
      id: sessionId,
      userId,
      nonce,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Store session in Firestore
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);
    await setDoc(sessionRef, {
      ...session,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
    });

    // Generate QR payload
    const qrPayload: QRPayload = {
      sessionId,
      nonce,
      userId,
      action: 'link_wallet',
      expiresAt: expiresAt.getTime(),
      webAppUrl: WEB_APP_URL,
    };

    return {
      success: true,
      session,
      qrPayload: JSON.stringify(qrPayload),
    };
  } catch (error) {
    console.error('[WalletTransferService] Failed to create session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create transfer session',
    };
  }
}

/**
 * Get a transfer session by ID.
 */
export async function getTransferSession(sessionId: string): Promise<WalletTransferSession | null> {
  try {
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);
    const snapshot = await getDoc(sessionRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    // Parse timestamps
    const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt;
    const expiresAt = data.expiresAt?.toDate?.()?.toISOString() || data.expiresAt;
    const confirmedAt = data.confirmedAt?.toDate?.()?.toISOString() || data.confirmedAt;

    // Check if expired
    const now = new Date();
    const expiry = new Date(expiresAt);
    if (now > expiry && data.status === 'pending') {
      // Mark as expired
      await updateDoc(sessionRef, { status: 'expired' });
      return {
        ...data,
        id: sessionId,
        status: 'expired',
        createdAt,
        expiresAt,
        confirmedAt,
      } as WalletTransferSession;
    }

    return {
      ...data,
      id: sessionId,
      createdAt,
      expiresAt,
      confirmedAt,
    } as WalletTransferSession;
  } catch (error) {
    console.error('[WalletTransferService] Failed to get session:', error);
    return null;
  }
}

/**
 * Verify a wallet signature for the transfer challenge.
 * The challenge message is: "WeSplit Wallet Link\nSession: {sessionId}\nNonce: {nonce}"
 */
export function verifyWalletSignature(
  sessionId: string,
  nonce: string,
  walletAddress: string,
  signature: string
): boolean {
  try {
    // Construct the challenge message that the mobile app should have signed
    const message = `WeSplit Wallet Link\nSession: ${sessionId}\nNonce: ${nonce}`;
    const messageBytes = new TextEncoder().encode(message);

    // Decode the signature and public key
    const signatureBytes = bs58.decode(signature);
    const publicKey = new PublicKey(walletAddress);
    const publicKeyBytes = publicKey.toBytes();

    // Verify the signature using nacl
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    return isValid;
  } catch (error) {
    console.error('[WalletTransferService] Signature verification failed:', error);
    return false;
  }
}

/**
 * Confirm a wallet transfer session.
 * Called by the mobile app after signing the challenge.
 */
export async function confirmTransferSession(
  sessionId: string,
  walletAddress: string,
  signature: string
): Promise<ConfirmSessionResult> {
  try {
    // Get the session
    const session = await getTransferSession(sessionId);

    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'expired') {
      return { success: false, error: 'Session has expired' };
    }

    if (session.status === 'confirmed') {
      return { success: false, error: 'Session already confirmed' };
    }

    if (session.status === 'cancelled') {
      return { success: false, error: 'Session was cancelled' };
    }

    // Verify the signature
    const isValid = verifyWalletSignature(sessionId, session.nonce, walletAddress, signature);

    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    // Validate wallet address format
    try {
      new PublicKey(walletAddress);
    } catch {
      return { success: false, error: 'Invalid wallet address format' };
    }

    // Update the session
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);
    await updateDoc(sessionRef, {
      status: 'confirmed',
      walletAddress,
      walletPublicKey: walletAddress,
      signature,
      confirmedAt: serverTimestamp(),
    });

    return {
      success: true,
      walletAddress,
    };
  } catch (error) {
    console.error('[WalletTransferService] Failed to confirm session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm transfer',
    };
  }
}

/**
 * Cancel a transfer session.
 */
export async function cancelTransferSession(sessionId: string, userId: string): Promise<boolean> {
  try {
    const session = await getTransferSession(sessionId);

    if (!session) {
      return false;
    }

    // Only the session owner can cancel
    if (session.userId !== userId) {
      return false;
    }

    // Only pending sessions can be cancelled
    if (session.status !== 'pending') {
      return false;
    }

    const sessionRef = doc(db, COLLECTION_NAME, sessionId);
    await updateDoc(sessionRef, { status: 'cancelled' });

    return true;
  } catch (error) {
    console.error('[WalletTransferService] Failed to cancel session:', error);
    return false;
  }
}

/**
 * Delete a transfer session (cleanup).
 */
export async function deleteTransferSession(sessionId: string): Promise<boolean> {
  try {
    const sessionRef = doc(db, COLLECTION_NAME, sessionId);
    await deleteDoc(sessionRef);
    return true;
  } catch (error) {
    console.error('[WalletTransferService] Failed to delete session:', error);
    return false;
  }
}

/**
 * Get the challenge message that needs to be signed by the mobile wallet.
 */
export function getChallengeMessage(sessionId: string, nonce: string): string {
  return `WeSplit Wallet Link\nSession: ${sessionId}\nNonce: ${nonce}`;
}

/**
 * Calculate remaining time until session expires.
 */
export function getSessionTimeRemaining(session: WalletTransferSession): number {
  const now = new Date().getTime();
  const expiresAt = new Date(session.expiresAt).getTime();
  return Math.max(0, expiresAt - now);
}

/**
 * Check if a session is still valid (not expired, not confirmed, not cancelled).
 */
export function isSessionValid(session: WalletTransferSession): boolean {
  if (session.status !== 'pending') {
    return false;
  }
  const timeRemaining = getSessionTimeRemaining(session);
  return timeRemaining > 0;
}

// ---------------------------------------------------------------------------
// Export Service Object
// ---------------------------------------------------------------------------

export const walletTransferService = {
  createSession: createTransferSession,
  getSession: getTransferSession,
  confirmSession: confirmTransferSession,
  cancelSession: cancelTransferSession,
  deleteSession: deleteTransferSession,
  verifySignature: verifyWalletSignature,
  getChallengeMessage,
  getTimeRemaining: getSessionTimeRemaining,
  isValid: isSessionValid,
  SESSION_TTL_MS,
};
