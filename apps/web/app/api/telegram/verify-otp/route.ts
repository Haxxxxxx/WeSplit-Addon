import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api/verifyAuth';
import { verifyTelegramAuth } from '@/lib/api/verifyTelegramAuth';

// ---------------------------------------------------------------------------
// POST /api/telegram/verify-otp
//
// Verifies the email OTP for account linking and completes the merge.
// ---------------------------------------------------------------------------

const MAX_OTP_ATTEMPTS = 5;

interface VerifyRequest {
  /** Telegram initData string — preferred auth mechanism */
  initData?: string;
  /** Fallback: client-provided TG user ID (used when Firebase token auth is used) */
  telegramUserId?: string;
  telegramId?: number;
  telegramUsername?: string;
  otp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyRequest;
    const { otp } = body;

    if (!otp) {
      return NextResponse.json({ message: 'Missing required field: otp' }, { status: 400 });
    }

    // Auth: validate via initData HMAC (preferred for TG) or Firebase token (fallback)
    let telegramUserId: string;
    let telegramId: number;
    let telegramUsername: string | undefined;

    if (body.initData) {
      const tgAuth = verifyTelegramAuth(body.initData);
      if (!tgAuth) {
        return NextResponse.json({ message: 'Invalid or expired Telegram initData' }, { status: 401 });
      }
      telegramUserId = tgAuth.telegramUserId;
      telegramId = tgAuth.telegramId;
      telegramUsername = tgAuth.telegramUsername ?? body.telegramUsername;
    } else {
      const firebaseAuth = await verifyAuth(request);
      if (!firebaseAuth) {
        return NextResponse.json({ message: 'Unauthorized: provide initData or Firebase token' }, { status: 401 });
      }
      if (!body.telegramUserId || !body.telegramId) {
        return NextResponse.json({ message: 'Missing telegramUserId or telegramId' }, { status: 400 });
      }
      telegramUserId = body.telegramUserId;
      telegramId = body.telegramId;
      telegramUsername = body.telegramUsername;
    }

    const admin = await getFirebaseAdmin();
    const firestore = admin.firestore();

    // Get stored OTP
    const otpRef = firestore.collection('account_link_otps').doc(telegramUserId);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return NextResponse.json(
        { message: 'No pending verification found. Please start the linking process again.' },
        { status: 404 },
      );
    }

    const otpData = otpDoc.data()!;

    // S1-3: Check attempt counter — lockout after MAX_OTP_ATTEMPTS failures
    if ((otpData.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      await otpRef.delete();
      return NextResponse.json(
        { message: 'Too many attempts. Please request a new code.' },
        { status: 429 },
      );
    }

    // Check expiry
    if (new Date(otpData.expiresAt) < new Date()) {
      await otpRef.delete();
      return NextResponse.json(
        { message: 'Verification code expired. Please request a new one.' },
        { status: 410 },
      );
    }

    // S1-3: Timing-safe OTP comparison
    let otpMatch = false;
    try {
      const storedBuf = Buffer.from(otpData.otp, 'utf8');
      const providedBuf = Buffer.from(otp, 'utf8');
      otpMatch = storedBuf.length === providedBuf.length && timingSafeEqual(storedBuf, providedBuf);
    } catch {
      otpMatch = false;
    }

    if (!otpMatch) {
      // Increment attempt counter
      await otpRef.update({ attempts: (otpData.attempts ?? 0) + 1 });
      return NextResponse.json(
        { message: 'Incorrect verification code' },
        { status: 401 },
      );
    }

    // OTP valid — complete the merge
    const existingUserId = otpData.targetUserId;
    const existingDoc = await firestore.collection('users').doc(existingUserId).get();

    if (!existingDoc.exists) {
      return NextResponse.json(
        { message: 'Target account no longer exists' },
        { status: 404 },
      );
    }

    const existingData = existingDoc.data()!;

    // Merge: add Telegram fields to existing user
    await firestore.collection('users').doc(existingUserId).update({
      telegram_id: telegramId,
      telegram_username: telegramUsername ?? '',
      telegram_linked_at: new Date().toISOString(),
    });

    // Delete the temporary tg_ user doc
    const tgDocRef = firestore.collection('users').doc(telegramUserId);
    const tgDoc = await tgDocRef.get();
    if (tgDoc.exists) {
      await tgDocRef.delete();
    }

    // Clean up OTP doc
    await otpRef.delete();

    // Mint new Firebase token for the linked user
    const firebaseToken = await admin.auth().createCustomToken(existingUserId, {
      telegram_id: telegramId,
      telegram_username: telegramUsername || '',
      provider: 'telegram',
      linked: true,
    });

    return NextResponse.json({
      success: true,
      linkedUserId: existingUserId,
      firebaseToken,
      user: {
        id: existingUserId,
        name: existingData.name,
        email: existingData.email,
        wallet_address: existingData.wallet_address,
        avatar: existingData.avatar,
      },
    });
  } catch (err) {
    console.error('[Verify OTP] Error:', err);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
