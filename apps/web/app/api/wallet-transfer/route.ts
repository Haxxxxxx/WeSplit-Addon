/**
 * Wallet Transfer API - Create Session
 *
 * POST /api/wallet-transfer
 * Creates a new wallet transfer session for QR code linking.
 *
 * Request body:
 * - userId: string (required) - The user ID to link the wallet to
 *
 * Response:
 * - sessionId: string - The session ID
 * - qrPayload: string - JSON payload to encode in QR code
 * - expiresAt: string - ISO timestamp when session expires
 *
 * GET /api/wallet-transfer?sessionId=xxx
 * Returns session status + walletAddress if confirmed.
 *
 * DELETE /api/wallet-transfer?sessionId=xxx&userId=xxx
 * Cancels a pending session.
 *
 * Uses Firebase Admin SDK for all Firestore access (server-side, bypasses security rules).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api/verifyAuth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import bs58 from 'bs58';
import { v4 as uuidv4 } from 'uuid';

const COLLECTION = 'wallet_transfer_sessions';
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.wesplit.xyz';

function generateNonce(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return bs58.encode(randomBytes);
}

// ---------------------------------------------------------------------------
// POST — create a new session
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Ensure the requester can only create sessions for themselves
    if (userId !== authResult.uid) {
      return NextResponse.json({ error: 'Forbidden: userId must match authenticated user' }, { status: 403 });
    }

    const admin = await getFirebaseAdmin();
    const firestore = admin.firestore();

    const sessionId = uuidv4();
    const nonce = generateNonce();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    const sessionData = {
      id: sessionId,
      userId,
      nonce,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
    };

    await firestore.collection(COLLECTION).doc(sessionId).set(sessionData);

    const qrPayload = JSON.stringify({
      sessionId,
      nonce,
      userId,
      action: 'link_wallet',
      expiresAt: expiresAt.getTime(),
      webAppUrl: WEB_APP_URL,
    });

    return NextResponse.json({
      sessionId,
      qrPayload,
      expiresAt: expiresAt.toISOString(),
      nonce,
    });
  } catch (error) {
    console.error('[API] wallet-transfer POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET — poll session status
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

    // Verify session belongs to the authenticated caller
    if (data.userId && data.userId !== authResult.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const expiresAt: Date =
      data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : new Date(data.expiresAt);

    let status = data.status;
    const timeRemaining = Math.max(0, expiresAt.getTime() - Date.now());

    // Auto-expire if past TTL
    if (status === 'pending' && timeRemaining === 0) {
      await snap.ref.update({ status: 'expired' });
      status = 'expired';
    }

    return NextResponse.json({
      sessionId,
      status,
      walletAddress: data.walletAddress || null,
      expiresAt: expiresAt.toISOString(),
      timeRemaining,
    });
  } catch (error) {
    console.error('[API] wallet-transfer GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — cancel a pending session
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const admin = await getFirebaseAdmin();
    const firestore = admin.firestore();
    const sessionRef = firestore.collection(COLLECTION).doc(sessionId);
    const snap = await sessionRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const data = snap.data()!;

    // Verify session belongs to the authenticated caller (not a query param)
    if (data.userId !== authResult.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (data.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot cancel session with status: ${data.status}` },
        { status: 400 }
      );
    }

    await sessionRef.update({ status: 'cancelled' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] wallet-transfer DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
