/**
 * Server-side Telegram initData HMAC validation helper.
 *
 * Use in TG API routes as an alternative auth mechanism when the caller
 * may not yet have a Firebase token (pre-auth TG users).
 *
 * Validates the HMAC signature and extracts the verified telegramUserId.
 * NEVER trust the client-provided telegramUserId — always use the value
 * returned from this function.
 *
 * Returns null if validation fails (wrong HMAC, expired, missing bot token, etc.)
 */

import { createHmac, timingSafeEqual } from 'crypto';

export interface ValidatedTelegramAuth {
  /** e.g. "tg_123456789" — safe to use as Firestore doc ID */
  telegramUserId: string;
  /** Raw numeric Telegram ID */
  telegramId: number;
  telegramUsername?: string;
}

/** Maximum age of initData before it's considered expired (5 minutes) */
const MAX_AUTH_AGE_SECONDS = 300;

export function verifyTelegramAuth(initData: string): ValidatedTelegramAuth | null {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('[verifyTelegramAuth] TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // Build data-check string (exclude hash, sort alphabetically)
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // HMAC-SHA256 with key derived from bot token
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Timing-safe comparison
  const computedBuf = Buffer.from(computedHash, 'hex');
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(hash, 'hex');
  } catch {
    return null;
  }
  if (computedBuf.length !== providedBuf.length) return null;
  if (!timingSafeEqual(computedBuf, providedBuf)) return null;

  // Check auth_date freshness
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_AUTH_AGE_SECONDS) return null;

  // Parse Telegram user from validated data
  const userJson = params.get('user');
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson) as { id: number; username?: string };
    return {
      telegramUserId: `tg_${user.id}`,
      telegramId: user.id,
      telegramUsername: user.username,
    };
  } catch {
    return null;
  }
}
