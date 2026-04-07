import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// ---------------------------------------------------------------------------
// POST /api/telegram/validate
//
// Server-side validation of Telegram initData using HMAC-SHA256.
// Returns a Firebase custom token for the authenticated Telegram user.
//
// Security: This is the ONLY trusted path for Telegram auth.
// Never trust initData on the client without server validation.
//
// Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// ---------------------------------------------------------------------------

// NOTE: BOT_TOKEN is accessed inside the POST handler (not at module level)
// to avoid crashing the server at startup if the env var is missing.

// ---------------------------------------------------------------------------
// Validate initData HMAC
// ---------------------------------------------------------------------------

function validateInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  // Remove hash from the data to check
  params.delete('hash');

  // Sort params alphabetically and join with newlines
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // HMAC-SHA256 with secret derived from bot token
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks (AR-C1)
  const computedBuf = Buffer.from(computedHash, 'hex');
  const providedBuf = Buffer.from(hash, 'hex');
  if (computedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(computedBuf, providedBuf);
}

// ---------------------------------------------------------------------------
// Parse Telegram user from initData
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

function parseTelegramUser(initData: string): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const userJson = params.get('user');
  if (!userJson) return null;

  try {
    return JSON.parse(userJson) as TelegramUser;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Access bot token at request time (not module level) to avoid startup crashes (AR-C3)
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
      console.error('[TG Validate] TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json(
        { message: 'Telegram bot not configured' },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { initData } = body;

    if (!initData || typeof initData !== 'string') {
      return NextResponse.json(
        { message: 'Missing initData' },
        { status: 400 },
      );
    }

    // Step 1: Validate HMAC signature
    const isValid = validateInitData(initData, BOT_TOKEN);
    if (!isValid) {
      return NextResponse.json(
        { message: 'Invalid initData signature' },
        { status: 401 },
      );
    }

    // Step 2: Check auth_date isn't too old (5 minute window)
    const params = new URLSearchParams(initData);
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 300) {
      return NextResponse.json(
        { message: 'initData expired' },
        { status: 401 },
      );
    }

    // Step 3: Extract Telegram user
    const telegramUser = parseTelegramUser(initData);
    if (!telegramUser) {
      return NextResponse.json(
        { message: 'No user data in initData' },
        { status: 400 },
      );
    }

    // Step 4: Mint Firebase custom token
    const admin = await getFirebaseAdmin();
    const uid = `tg_${telegramUser.id}`;
    const firebaseToken = await admin.auth().createCustomToken(uid, {
      telegram_id: telegramUser.id,
      telegram_username: telegramUser.username || '',
      provider: 'telegram',
    });

    return NextResponse.json({
      firebaseToken,
      telegramUser,
    });
  } catch (err) {
    console.error('[TG Validate] Error:', err);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
