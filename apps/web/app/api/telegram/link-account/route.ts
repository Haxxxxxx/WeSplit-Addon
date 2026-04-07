import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/api/verifyAuth';
import { verifyTelegramAuth } from '@/lib/api/verifyTelegramAuth';
import { sendOtpEmail } from '@/lib/server/email';

// ---------------------------------------------------------------------------
// POST /api/telegram/link-account
//
// Links a Telegram user (tg_XXXXX) to an existing WeSplit mobile user.
//
// Methods:
//   1. "mnemonic" — derive address from mnemonic, match against existing user
//   2. "backup"   — verify cloud backup exists for the email/userId
//   3. "email"    — find user by email, send verification (future)
//
// On success: merges TG data into the existing user doc, creates a new
// Firebase custom token for the linked UID so the TG client can re-auth
// as the original user.
// ---------------------------------------------------------------------------

interface LinkRequest {
  /**
   * Telegram initData string from the Mini App SDK.
   * When provided, HMAC is validated server-side and telegramUserId/telegramId
   * are extracted from it — the client-provided values are ignored.
   */
  initData?: string;
  /** Current TG user ID (e.g. "tg_123456789") — overridden by initData if present */
  telegramUserId?: string;
  /** Telegram numeric ID — overridden by initData if present */
  telegramId?: number;
  /** Telegram username */
  telegramUsername?: string;
  /** Linking method */
  method: 'mnemonic' | 'backup' | 'email';
  /** For mnemonic method: the derived wallet address (client-side derived) */
  walletAddress?: string;
  /** For mnemonic method: base58-encoded signature proving key ownership */
  signature?: string;
  /** For email method: email to look up */
  email?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LinkRequest;
    const { method } = body;

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
      // Fallback: Firebase token auth
      const firebaseAuth = await verifyAuth(request);
      if (!firebaseAuth) {
        return NextResponse.json({ message: 'Unauthorized: provide initData or Firebase token' }, { status: 401 });
      }
      // Use client-provided TG values (trusted because Firebase auth passed)
      if (!body.telegramUserId || !body.telegramId) {
        return NextResponse.json({ message: 'Missing telegramUserId or telegramId' }, { status: 400 });
      }
      telegramUserId = body.telegramUserId;
      telegramId = body.telegramId;
      telegramUsername = body.telegramUsername;
    }

    if (!method) {
      return NextResponse.json(
        { message: 'Missing required field: method' },
        { status: 400 },
      );
    }

    const admin = await getFirebaseAdmin();
    const firestore = admin.firestore();

    // ----- Method: Mnemonic (address match + signature verification) -----
    if (method === 'mnemonic') {
      const { walletAddress, signature } = body;
      if (!walletAddress || !signature) {
        return NextResponse.json(
          { message: 'walletAddress and signature required for mnemonic method' },
          { status: 400 },
        );
      }

      // Verify the client actually holds the private key for this address
      // by checking a signed challenge message
      try {
        const { PublicKey } = await import('@solana/web3.js');
        const nacl = await import('tweetnacl');
        const bs58 = await import('bs58');

        const challengeMessage = `WeSplit account link: ${telegramUserId} -> ${walletAddress}`;
        const messageBytes = new TextEncoder().encode(challengeMessage);
        const signatureBytes = bs58.default.decode(signature);
        const publicKeyBytes = new PublicKey(walletAddress).toBytes();

        const isValid = nacl.default.sign.detached.verify(
          messageBytes,
          signatureBytes,
          publicKeyBytes,
        );

        if (!isValid) {
          return NextResponse.json(
            { message: 'Invalid signature — could not verify wallet ownership' },
            { status: 403 },
          );
        }
      } catch {
        return NextResponse.json(
          { message: 'Signature verification failed — invalid format' },
          { status: 400 },
        );
      }

      // Find existing user with this wallet address
      const usersSnap = await firestore
        .collection('users')
        .where('wallet_address', '==', walletAddress)
        .limit(1)
        .get();

      if (usersSnap.empty) {
        return NextResponse.json(
          { message: 'No WeSplit account found with this wallet address' },
          { status: 404 },
        );
      }

      const existingUser = usersSnap.docs[0]!;
      const existingUserId = existingUser.id;

      // Don't link to self
      if (existingUserId === telegramUserId) {
        return NextResponse.json(
          { message: 'Account is already linked' },
          { status: 400 },
        );
      }

      // Don't link if already linked to a different TG account
      const existingData = existingUser.data();
      if (existingData.telegram_id && existingData.telegram_id !== telegramId) {
        return NextResponse.json(
          { message: 'This account is already linked to a different Telegram user' },
          { status: 409 },
        );
      }

      // Merge: add Telegram fields to existing user
      await firestore.collection('users').doc(existingUserId).update({
        telegram_id: telegramId,
        telegram_username: telegramUsername ?? '',
        telegram_linked_at: new Date().toISOString(),
      });

      // Delete the temporary tg_ user doc (if it exists and isn't the same)
      const tgDocRef = firestore.collection('users').doc(telegramUserId);
      const tgDoc = await tgDocRef.get();
      if (tgDoc.exists) {
        await tgDocRef.delete();
      }

      // Mint a new Firebase custom token for the EXISTING user's UID
      // so the TG client can re-authenticate as that user
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
    }

    // ----- Method: Cloud Backup (find by email) -----
    if (method === 'backup') {
      const { email } = body;
      if (!email) {
        return NextResponse.json(
          { message: 'email required for backup method' },
          { status: 400 },
        );
      }

      // Find user by email
      const usersSnap = await firestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (usersSnap.empty) {
        return NextResponse.json(
          { message: 'No WeSplit account found with this email' },
          { status: 404 },
        );
      }

      const existingUser = usersSnap.docs[0]!;
      const existingUserId = existingUser.id;
      const existingData = existingUser.data();

      // Check if backup exists
      const backupsSnap = await firestore
        .collection('wallet_backups')
        .where('userId', '==', existingUserId)
        .limit(1)
        .get();

      if (backupsSnap.empty) {
        return NextResponse.json(
          { message: 'No cloud backup found for this account' },
          { status: 404 },
        );
      }

      // Don't link if already linked to a different TG account
      if (existingData.telegram_id && existingData.telegram_id !== telegramId) {
        return NextResponse.json(
          { message: 'This account is already linked to a different Telegram user' },
          { status: 409 },
        );
      }

      // Return backup metadata (not the encrypted data or sensitive fields)
      const backupDoc = backupsSnap.docs[0]!;
      return NextResponse.json({
        success: true,
        existingUserId,
        backupId: backupDoc.id,
        user: {
          id: existingUserId,
          name: existingData.name,
        },
      });
    }

    // ----- Method: Email verification -----
    if (method === 'email') {
      const { email } = body;
      if (!email) {
        return NextResponse.json(
          { message: 'email required for email method' },
          { status: 400 },
        );
      }

      // Find user by email
      const usersSnap = await firestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (usersSnap.empty) {
        return NextResponse.json(
          { message: 'No WeSplit account found with this email' },
          { status: 404 },
        );
      }

      const existingUser = usersSnap.docs[0]!;
      const existingUserId = existingUser.id;
      const existingData = existingUser.data();

      // Generate 6-digit OTP using cryptographically secure RNG
      const otp = randomInt(100000, 1000000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      await firestore.collection('account_link_otps').doc(telegramUserId).set({
        otp,
        expiresAt: otpExpiry,
        targetUserId: existingUserId,
        telegramId,
        telegramUsername: telegramUsername ?? '',
        createdAt: new Date().toISOString(),
      });

      // Send OTP via Resend (falls back to console.log if RESEND_API_KEY not set)
      const emailResult = await sendOtpEmail({
        to: email,
        otp,
        userName: existingData.name || undefined,
        expiryMinutes: 10,
      });

      if (!emailResult.success) {
        // Clean up the OTP doc if email delivery failed (don't leave dangling OTPs)
        await firestore.collection('account_link_otps').doc(telegramUserId).delete();
        return NextResponse.json(
          { message: 'Failed to send verification email. Please try again.' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email',
        existingUserId,
        maskedEmail: maskEmail(email),
        user: {
          name: existingData.name,
        },
        // Dev OTP: only in local development AND when email service is in dev mode
        ...(emailResult.devMode && process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
      });
    }

    return NextResponse.json(
      { message: 'Unknown method' },
      { status: 400 },
    );
  } catch (err) {
    console.error('[Link Account] Error:', err);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***.***';
  const masked = local.length <= 2
    ? '*'.repeat(local.length)
    : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}
