/**
 * Remote Signing Service — Web
 *
 * Enables "Mobile as Remote Signer" for web transactions.
 * Writes a signing request to Firestore's `transactionSigningRequests`
 * collection, which the mobile app's RemoteSigningService already monitors.
 *
 * Flow:
 * 1. Web creates a signing request doc with the serialized transaction
 * 2. Mobile receives push notification / deep link opens approval screen
 * 3. Mobile signs and writes `signedTransaction` back to the doc
 * 4. Web polls (real-time listener) and retrieves the signed transaction
 *
 * Request doc schema (matches mobile's existing format):
 * {
 *   userId, transaction (base64), status: 'pending'|'approved'|'rejected'|'expired',
 *   signedTransaction (base64, set by mobile), createdAt, expiresAt (5 min)
 * }
 */

import {
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { Transaction } from '@solana/web3.js';
import { db } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = 'transactionSigningRequests';

/** Request expires after 5 minutes */
const EXPIRY_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SigningRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface SigningRequestResult {
  status: SigningRequestStatus;
  signedTransaction: string | null;
  requestId: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a signing request in Firestore for the mobile app to approve.
 *
 * @param transaction — unsigned Transaction to be signed by mobile
 * @param userId — Firebase UID of the requesting user
 * @returns The request document ID
 */
export async function createSigningRequest(
  transaction: Transaction,
  userId: string,
): Promise<string> {
  // Serialize the transaction to base64
  const serialized = Buffer.from(
    transaction.serialize({ requireAllSignatures: false }),
  ).toString('base64');

  const requestId = `sr_${userId}_${Date.now()}`;
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + EXPIRY_MS));

  const requestRef = doc(db, COLLECTION, requestId);
  await setDoc(requestRef, {
    // Core fields
    userId,
    requesterId: userId, // Required by security rules (P2-5 anti-spoofing)
    transaction: serialized,
    status: 'pending' as SigningRequestStatus,
    signedTransaction: null,

    // Timestamps
    createdAt: serverTimestamp(),
    expiresAt,

    // Metadata
    platform: 'web',
    requestId,

    // Deep link for push notification
    deepLink: `wesplit://transaction-approval?requestId=${requestId}`,
  });

  return requestId;
}

/**
 * Poll for the signing result using a Firestore real-time listener.
 * Resolves when the request is approved, rejected, expired, or cancelled.
 * Automatically expires after 5 minutes.
 *
 * @param requestId — The signing request document ID
 * @returns The result including status and optional signed transaction
 */
export function pollForResult(requestId: string): Promise<SigningRequestResult> {
  return new Promise((resolve, reject) => {
    const requestRef = doc(db, COLLECTION, requestId);

    // Expiry timeout
    const timeout = setTimeout(() => {
      unsubscribe();
      // Mark as expired in Firestore
      updateDoc(requestRef, { status: 'expired' }).catch(() => {});
      resolve({
        status: 'expired',
        signedTransaction: null,
        requestId,
      });
    }, EXPIRY_MS);

    const unsubscribe = onSnapshot(
      requestRef,
      (snap) => {
        if (!snap.exists()) {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error('Signing request not found'));
          return;
        }

        const data = snap.data();
        const status = data.status as SigningRequestStatus;

        if (status === 'approved' || status === 'rejected' || status === 'expired' || status === 'cancelled') {
          clearTimeout(timeout);
          unsubscribe();
          resolve({
            status,
            signedTransaction: data.signedTransaction ?? null,
            requestId,
          });
        }
        // 'pending' — keep listening
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      },
    );
  });
}

/**
 * Cancel a pending signing request.
 */
export async function cancelRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, COLLECTION, requestId);
  await updateDoc(requestRef, { status: 'cancelled' });
}

/**
 * Generate the deep link URL for a signing request.
 */
export function getDeepLink(requestId: string): string {
  return `wesplit://transaction-approval?requestId=${requestId}`;
}
