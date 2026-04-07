import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// ---------------------------------------------------------------------------
// GET /api/auth/nonce
//
// Generates a one-time nonce for SIWS (Sign-In With Solana).
// Stored in Firestore `auth_nonces/{nonce}` with a 5-minute TTL.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    const nonce = randomBytes(16).toString('hex');

    // S4-1: Add expires_at for Firestore TTL policy (configure TTL on this field in Firebase Console)
    // Must match NONCE_TTL_MS in wallet/route.ts (5 minutes)
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 5 * 60 * 1000), // 5 minutes — aligned with wallet route TTL
    );

    await db.collection('auth_nonces').doc(nonce).set({
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      // expires_at: configure a Firestore TTL policy on this field to auto-delete expired nonces
      expires_at: expiresAt,
      used: false,
    });

    return NextResponse.json({ nonce });
  } catch (err) {
    console.error('[Nonce] Error generating nonce:', err);
    return NextResponse.json(
      { message: 'Failed to generate nonce' },
      { status: 500 },
    );
  }
}
