import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// ---------------------------------------------------------------------------
// POST /api/auth/wallet
//
// SIWS (Sign-In With Solana) verification.
// 1. Validates the one-time nonce from Firestore
// 2. Verifies the ed25519 signature with tweetnacl
// 3. Validates the domain in the signed message
// 4. Resolves user identity (existing mobile user or new)
// 5. Mints a Firebase custom token
// ---------------------------------------------------------------------------

// S1-5: localhost only allowed in non-production environments
const ALLOWED_DOMAINS = [
  'wesplit.io',
  'www.wesplit.io',
  ...(process.env.NODE_ENV !== 'production' ? ['localhost', 'localhost:3000'] : []),
];
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signedMessage, signature, publicKey, nonce, domain, createNew } = body;

    // Basic validation
    if (!signedMessage || !signature || !publicKey || !nonce) {
      return NextResponse.json(
        { message: 'Missing required fields: signedMessage, signature, publicKey, nonce' },
        { status: 400 },
      );
    }

    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    // ------------------------------------------------------------------
    // 1. Validate nonce — atomic transaction to prevent replay races (S1-4)
    // ------------------------------------------------------------------
    const nonceRef = db.collection('auth_nonces').doc(nonce);

    try {
      await db.runTransaction(async (t) => {
        const nonceSnap = await t.get(nonceRef);

        if (!nonceSnap.exists) {
          throw new Error('INVALID_NONCE');
        }

        const nonceData = nonceSnap.data()!;

        if (nonceData.used) {
          throw new Error('NONCE_USED');
        }

        // Check expiry — created_at is a Firestore Timestamp
        const createdAt = nonceData.created_at?.toDate?.()
          ? nonceData.created_at.toDate().getTime()
          : Date.now();

        if (Date.now() - createdAt > NONCE_TTL_MS) {
          throw new Error('NONCE_EXPIRED');
        }

        // Atomically mark as used to prevent concurrent replay
        t.update(nonceRef, { used: true });
      });
    } catch (txErr) {
      const msg = txErr instanceof Error ? txErr.message : '';
      if (msg === 'INVALID_NONCE') {
        return NextResponse.json({ message: 'Invalid nonce' }, { status: 401 });
      }
      if (msg === 'NONCE_USED') {
        return NextResponse.json({ message: 'Nonce already used' }, { status: 401 });
      }
      if (msg === 'NONCE_EXPIRED') {
        return NextResponse.json({ message: 'Nonce expired' }, { status: 401 });
      }
      throw txErr; // re-throw unexpected errors
    }

    // ------------------------------------------------------------------
    // 2. Verify ed25519 signature
    // ------------------------------------------------------------------
    const messageBytes = new TextEncoder().encode(signedMessage);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );

    if (!isValid) {
      return NextResponse.json(
        { message: 'Invalid signature' },
        { status: 401 },
      );
    }

    // ------------------------------------------------------------------
    // 3. Validate domain — S1-6: always extract from signed message, not body
    // ------------------------------------------------------------------
    const requestDomain = extractDomainFromMessage(signedMessage);
    if (!requestDomain || !ALLOWED_DOMAINS.includes(requestDomain)) {
      return NextResponse.json(
        { message: 'Invalid or missing domain in signed message' },
        { status: 403 },
      );
    }

    // ------------------------------------------------------------------
    // 4. Resolve user identity — cascading lookup
    //
    // Mobile app stores wallet addresses in multiple fields depending
    // on how the user signed up:
    //   - wallet_address: primary wallet (app-generated, phantom SDK, or external)
    //   - phantom_wallet_address: preserved Phantom embedded wallet (may differ from primary)
    //   - mainWithdrawWalletAddress: user-chosen withdrawal target
    //   - web_wallet_address: browser wallet linked on web
    //
    // We check all fields to prevent duplicate accounts when a mobile
    // user connects on web with a different wallet (e.g. Phantom browser
    // extension vs Phantom SDK embedded wallet).
    // ------------------------------------------------------------------
    const usersRef = db.collection('users');

    let uid: string | null = null;
    let isNewUser = false;

    // Try each wallet field in priority order
    const walletFields = [
      'wallet_address',
      'phantom_wallet_address',
      'mainWithdrawWalletAddress',
      'web_wallet_address',
    ];

    for (const field of walletFields) {
      const query = await usersRef
        .where(field, '==', publicKey)
        .limit(1)
        .get();

      if (!query.empty) {
        uid = query.docs[0]!.id;
        break;
      }
    }

    if (!uid) {
      if (!createNew) {
        // No match found and user didn't explicitly opt to create —
        // return without a token so the client can offer choices:
        // "Create New Account" or "Link to Existing via Email"
        return NextResponse.json({
          firebaseToken: null,
          uid: null,
          isNewUser: true,
          noMatch: true,
        });
      }

      // User explicitly chose to create a new account
      uid = publicKey;
      isNewUser = true;
    }

    // ------------------------------------------------------------------
    // 5. Mint Firebase custom token
    // ------------------------------------------------------------------
    // uid is guaranteed non-null here: either found by cascading lookup
    // or set to publicKey when createNew is true (early return otherwise)
    const firebaseToken = await admin.auth().createCustomToken(uid as string, {
      wallet_address: publicKey,
      provider: 'solana_wallet',
    });

    return NextResponse.json({
      firebaseToken,
      uid,
      isNewUser,
      noMatch: false,
    });
  } catch (err) {
    console.error('[Wallet Auth] Error:', err);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDomainFromMessage(message: string): string | null {
  // SIWS message format contains "Domain: <domain>"
  const match = message.match(/Domain:\s*(.+)/i);
  return match?.[1]?.trim() ?? null;
}
