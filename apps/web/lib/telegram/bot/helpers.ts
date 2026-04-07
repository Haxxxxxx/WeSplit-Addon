/**
 * Shared bot helper utilities — escapeHtml, user lookup, MINI_APP_URL, deeplink builder
 */

import { getFirebaseAdmin } from '@/lib/firebase-admin';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MINI_APP_URL =
  process.env.NEXT_PUBLIC_MINI_APP_URL ?? 'https://t.me/WeSplitBot/app';

// ---------------------------------------------------------------------------
// HTML escaping for Telegram HTML parse_mode
// ---------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Deeplink URL builder
// ---------------------------------------------------------------------------

export function buildMiniAppUrl(startParam?: string): string {
  if (!startParam) return MINI_APP_URL;
  return `${MINI_APP_URL}#start_param=${startParam}`;
}

// ---------------------------------------------------------------------------
// User lookup by Telegram ID
// ---------------------------------------------------------------------------

/** Look up a WeSplit user by telegram_id. Returns full user doc or null. */
export async function lookupUserByTelegramId(
  telegramId: number,
): Promise<Record<string, unknown> | null> {
  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    // Check telegram_id field first
    const snap = await db
      .collection('users')
      .where('telegram_id', '==', telegramId)
      .limit(1)
      .get();

    if (!snap.empty) {
      return { id: snap.docs[0]!.id, ...snap.docs[0]!.data() };
    }

    // Fallback: check tg_ prefixed UID
    const tgDoc = await db.collection('users').doc(`tg_${telegramId}`).get();
    if (tgDoc.exists) {
      return { id: tgDoc.id, ...tgDoc.data() };
    }

    return null;
  } catch {
    return null;
  }
}

/** Look up just the WeSplit user ID by telegram ID. */
export async function lookupUserIdByTelegramId(
  telegramId: number,
): Promise<string | null> {
  const user = await lookupUserByTelegramId(telegramId);
  return user ? (user.id as string) : null;
}
