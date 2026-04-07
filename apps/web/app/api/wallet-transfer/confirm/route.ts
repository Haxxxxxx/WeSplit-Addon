/**
 * Wallet Transfer API - Confirm Session
 *
 * POST /api/wallet-transfer/confirm
 * Confirms a wallet transfer session with a signed challenge.
 * Called by the mobile app after signing the challenge message.
 *
 * Request body:
 * - sessionId: string (required)
 * - walletAddress: string (required) - The wallet address that signed the challenge
 * - signature: string (required) - Base58 encoded ed25519 signature of the challenge
 *
 * GET /api/wallet-transfer/confirm?sessionId=xxx
 * Returns the challenge message that the mobile wallet must sign.
 *
 * Uses Firebase Admin SDK for all Firestore access (server-side, bypasses security rules).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api/verifyAuth';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const COLLECTION = 'wallet_transfer_sessions';
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Pure helpers (no Firestore SDK — safe to use on server)
// ---------------------------------------------------------------------------

function getChallengeMessage(sessionId: string, nonce: string): string {
  return `WeSplit Wallet Link\nSession: ${sessionId}\nNonce: ${nonce}`;
}

function verifyWalletSignature(
  sessionId: string,
  nonce: string,
  walletAddress: string,
  signature: string,
): boolean {
  try {
    const message = getChallengeMessage(sessionId, nonce);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKey = new PublicKey(walletAddress);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET — return challenge message for a pending session
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = new URL(request.url).searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const admin = await getFirebaseAdmin();
    const firestore = admin.firestore();
    const snap = await firestore.collection(COLLECTION).doc(sessionId).get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const data = snap.data()!;

    if (data.status !== 'pending') {
      return NextResponse.json({ error: `Session is ${data.status}` }, { status: 400 });
    }

    // Check expiry
    const expiresAt: Date =
      data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : new Date(data.expiresAt);

    const timeRemaining = Math.max(0, expiresAt.getTime() - Date.now());

    if (timeRemaining === 0) {
      await snap.ref.update({ status: 'expired' });
      return NextResponse.json({ error: 'Session has expired' }, { status: 400 });
    }

    return NextResponse.json({
      sessionId,
      nonce: data.nonce,
      challengeMessage: getChallengeMessage(sessionId, data.nonce),
      expiresAt: expiresAt.toISOString(),
      timeRemaining,
    });
  } catch (error) {
    console.error('[API] wallet-transfer/confirm GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — verify signature and confirm the session
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, walletAddress, signature } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }
    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'signature is required' }, { status: 400 });
    }

    // Validate wallet address format before hitting Firestore
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const admin = await getFirebaseAdmin();
    const firestore = admin.firestore();
    const sessionRef = firestore.collection(COLLECTION).doc(sessionId);
    const snap = await sessionRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = snap.data()!;

    // S2-2: Verify the session belongs to the authenticated caller
    if (session.userId && session.userId !== authResult.uid) {
      return NextResponse.json({ error: 'Forbidden: session belongs to a different user' }, { status: 403 });
    }

    // Guard against non-pending states
    if (session.status === 'expired') {
      return NextResponse.json({ error: 'Session has expired' }, { status: 400 });
    }
    if (session.status === 'confirmed') {
      return NextResponse.json({ error: 'Session already confirmed' }, { status: 400 });
    }
    if (session.status === 'cancelled') {
      return NextResponse.json({ error: 'Session was cancelled' }, { status: 400 });
    }

    // Check TTL
    const expiresAt: Date =
      session.expiresAt instanceof Timestamp
        ? session.expiresAt.toDate()
        : new Date(session.expiresAt);

    if (Date.now() > expiresAt.getTime()) {
      await sessionRef.update({ status: 'expired' });
      return NextResponse.json({ error: 'Session has expired' }, { status: 400 });
    }

    // Verify ed25519 signature
    if (!verifyWalletSignature(sessionId, session.nonce, walletAddress, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Mark session as confirmed
    await sessionRef.update({
      status: 'confirmed',
      walletAddress,
      walletPublicKey: walletAddress,
      signature,
      confirmedAt: FieldValue.serverTimestamp(),
    });

    // Update user doc if we have a userId tied to this session
    const userId: string | undefined = session.userId;
    if (userId) {
      try {
        // Only update web_wallet_address — NEVER overwrite wallet_address (mobile's canonical identity)
        await firestore.collection('users').doc(userId).update({
          web_wallet_address: walletAddress,
          web_wallet_linked_via: 'qr_transfer',
          web_wallet_linked_at: FieldValue.serverTimestamp(),
          // camelCase for mobile compat
          webWalletAddress: walletAddress,
          webWalletLinkedVia: 'qr_transfer',
          webWalletLinkedAt: FieldValue.serverTimestamp(),
        });
      } catch (userUpdateError) {
        // Log but don't fail — session is confirmed, wallet link is the critical part
        console.error('[API] wallet-transfer/confirm: failed to update user doc:', userUpdateError);
      }
    }

    return NextResponse.json({ success: true, walletAddress });
  } catch (error) {
    console.error('[API] wallet-transfer/confirm POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
