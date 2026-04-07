import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Telegram → Firebase Auth Bridge
//
// Flow:
// 1. Client sends Telegram initData to /api/telegram/validate
// 2. Server validates HMAC, mints a Firebase custom token
// 3. Client calls signInWithCustomToken → Firebase Auth session
// 4. Firestore user doc created/synced on first login
// ---------------------------------------------------------------------------

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

interface ValidateResponse {
  firebaseToken: string;
  telegramUser: TelegramUser;
}

// ---------------------------------------------------------------------------
// Group Context — extracted from initDataUnsafe when Mini App is opened
// from a group chat (either via inline button or direct group link)
// ---------------------------------------------------------------------------

export interface TelegramGroupContext {
  /** Telegram chat ID (negative number for groups) */
  chatId: number | null;
  /** Chat type: 'private' | 'group' | 'supergroup' | 'channel' */
  chatType: 'private' | 'group' | 'supergroup' | 'channel' | null;
  /** Unique instance identifier for this specific open (changes per open) */
  chatInstance: string | null;
  /** Deeplink parameter from bot inline button (e.g. "split_abc123") */
  startParam: string | null;
  /** Chat title (if available) */
  chatTitle: string | null;
}

/**
 * Extract group context from Telegram's initDataUnsafe.
 * Called once on Mini App mount via TelegramProvider.
 *
 * Reads from window.Telegram.WebApp.initDataUnsafe (already parsed by SDK).
 * Also checks URL hash for start_param (set by deeplink handler).
 */
export function extractGroupContext(): TelegramGroupContext {
  const empty: TelegramGroupContext = {
    chatId: null,
    chatType: null,
    chatInstance: null,
    startParam: null,
    chatTitle: null,
  };

  if (typeof window === 'undefined') return empty;

  const webApp = window.Telegram?.WebApp;
  if (!webApp) return empty;

  const unsafe = webApp.initDataUnsafe as Record<string, unknown> | undefined;
  if (!unsafe) return empty;

  // Extract start_param (deeplink) — also check URL hash
  let startParam: string | null = (unsafe.start_param as string) ?? null;
  if (!startParam) {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const fromHash = hashParams.get('start_param');
    if (fromHash) startParam = decodeURIComponent(fromHash);
  }

  // Extract chat context (present when opened from a group)
  const chat = unsafe.chat as Record<string, unknown> | undefined;
  const chatType = (unsafe.chat_type as string | undefined) ?? null;

  return {
    chatId: chat?.id != null ? Number(chat.id) : null,
    chatType: (chatType as TelegramGroupContext['chatType']) ?? null,
    chatInstance: (unsafe.chat_instance as string) ?? null,
    startParam,
    chatTitle: (chat?.title as string) ?? null,
  };
}

/**
 * Validate Telegram initData server-side and sign into Firebase.
 * Returns the Telegram user profile for display purposes.
 */
export async function authenticateWithTelegram(
  initData: string,
): Promise<TelegramUser> {
  // Step 1: Validate initData + get Firebase custom token
  const res = await fetch('/api/telegram/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Validation failed' }));
    throw new Error(error.message || 'Telegram auth validation failed');
  }

  const { firebaseToken, telegramUser } = (await res.json()) as ValidateResponse;

  // Step 2: Sign into Firebase with the custom token
  await signInWithCustomToken(auth, firebaseToken);

  // Step 3: Ensure Firestore user doc exists
  await ensureUserDoc(telegramUser);

  return telegramUser;
}

/**
 * Create or update the Firestore user doc for a Telegram user.
 * Maps Telegram profile fields to WeSplit's user schema.
 */
async function ensureUserDoc(tgUser: TelegramUser): Promise<void> {
  const uid = `tg_${tgUser.id}`;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // First-time Telegram user — create doc
    await setDoc(userRef, {
      id: uid,
      name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
      email: '',
      wallet_address: '',
      avatar: tgUser.photo_url ?? '',
      telegram_id: tgUser.id,
      telegram_username: tgUser.username ?? '',
      hasCompletedOnboarding: false,
      status: 'active',
      devicePlatform: 'telegram',
      authMethod: 'telegram',
      created_at: serverTimestamp(),
    });
  } else {
    // Returning user — update avatar/name if changed
    const data = snap.data();
    const updates: Record<string, unknown> = {};

    const currentName = [tgUser.first_name, tgUser.last_name]
      .filter(Boolean)
      .join(' ');
    if (data.name !== currentName) updates.name = currentName;
    if (tgUser.photo_url && data.avatar !== tgUser.photo_url) {
      updates.avatar = tgUser.photo_url;
    }
    if (tgUser.username && data.telegram_username !== tgUser.username) {
      updates.telegram_username = tgUser.username;
    }

    if (Object.keys(updates).length > 0) {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(userRef, updates);
    }
  }
}
