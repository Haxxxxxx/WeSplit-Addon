'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { initTelegramSDK, isTelegramWebApp } from '@/lib/telegram/init';
import {
  authenticateWithTelegram,
  extractGroupContext,
  type TelegramUser,
  type TelegramGroupContext,
} from '@/lib/telegram/auth';
import { useAppStore } from '@/store';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Dev mock user — used when running outside actual Telegram
// ---------------------------------------------------------------------------

const DEV_MOCK_USER: TelegramUser = {
  id: 123456789,
  first_name: 'Charles',
  last_name: 'Dev',
  username: 'charlesdev',
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TelegramContextValue {
  telegramUser: TelegramUser | null;
  loading: boolean;
  error: string | null;
  isInTelegram: boolean;
  retry: () => void;
  /** Group context — non-null when Mini App was opened from a Telegram group */
  groupContext: TelegramGroupContext;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const EMPTY_GROUP_CONTEXT: TelegramGroupContext = {
  chatId: null,
  chatType: null,
  chatInstance: null,
  startParam: null,
  chatTitle: null,
};

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [groupContext, setGroupContext] = useState<TelegramGroupContext>(EMPTY_GROUP_CONTEXT);

  const authenticateUser = useAppStore((s) => s.authenticateUser);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncToStore = useCallback(
    (tgUser: TelegramUser) => {
      authenticateUser(
        {
          id: `tg_${tgUser.id}`,
          name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
          email: '',
          wallet_address: '',
          avatar: tgUser.photo_url ?? '',
          telegram_id: tgUser.id,
          telegram_username: tgUser.username ?? '',
        } as unknown as User,
        'telegram',
      );
    },
    [authenticateUser],
  );

  const initAndAuth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const isInTg = isTelegramWebApp();

      // -------------------------------------------------------------------
      // Dev mode outside Telegram: skip SDK entirely, use mock user.
      // The SDK requires real Telegram launch params to initialize.
      // Our hooks (MainButton, BackButton, haptic) already gracefully
      // degrade with try-catch when the SDK isn't available.
      // -------------------------------------------------------------------
      if (isDev && !isInTg) {
        console.log('[TelegramProvider] Dev mode — using mock user');
        setTelegramUser(DEV_MOCK_USER);
        syncToStore(DEV_MOCK_USER);
        setLoading(false);
        return;
      }

      // -------------------------------------------------------------------
      // Real Telegram environment (or dev inside TG via ngrok/HTTPS)
      // -------------------------------------------------------------------
      await initTelegramSDK({ debug: isDev });
      window.Telegram?.WebApp?.ready?.();

      const initDataStr =
        window.Telegram?.WebApp?.initData ||
        new URLSearchParams(window.location.hash.slice(1)).get('tgWebAppData') ||
        '';

      if (initDataStr) {
        const tgUser = await authenticateWithTelegram(initDataStr);
        setTelegramUser(tgUser);
        syncToStore(tgUser);
      }

      // Extract group context AFTER SDK init (initDataUnsafe is now populated)
      const ctx = extractGroupContext();
      setGroupContext(ctx);
    } catch (err) {
      console.error('[TelegramProvider] Init/auth failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setLoading(false);
    }
  }, [isDev, syncToStore]);

  useEffect(() => {
    if (mounted) {
      initAndAuth();
    }
  }, [mounted, initAndAuth]);

  const value = useMemo<TelegramContextValue>(
    () => ({
      telegramUser,
      loading,
      error,
      isInTelegram: typeof window !== 'undefined' && isTelegramWebApp(),
      retry: initAndAuth,
      groupContext,
    }),
    [telegramUser, loading, error, initAndAuth, groupContext],
  );

  if (!mounted) return null;

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTelegram(): TelegramContextValue {
  const ctx = useContext(TelegramContext);
  if (!ctx) {
    throw new Error('useTelegram must be used within a <TelegramProvider>');
  }
  return ctx;
}
