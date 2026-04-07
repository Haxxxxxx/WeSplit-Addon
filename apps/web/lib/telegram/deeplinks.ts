/**
 * Telegram Mini App — Deeplink Router
 *
 * Parses `start_param` from bot inline keyboard buttons and routes
 * the Mini App to the correct page.
 *
 * Deeplink patterns (from bot's inline keyboard `start_param`):
 *   split_{splitId}         → /tg/splits/{splitId}
 *   pay_{splitId}           → /tg/splits/{splitId}?action=pay
 *   wallet_{walletId}       → /tg/wallets/{walletId}
 *   request_{requestId}     → /tg/request/{requestId}
 *   group_{chatId}          → /tg (dashboard with group context)
 *   tx_{txId}               → /tg/transactions/{txId}
 *
 * Usage in dashboard or layout:
 *   const { groupContext } = useTelegram();
 *   useDeeplink(groupContext.startParam);
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeeplinkRoute {
  path: string;
  params?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a start_param string into a route path.
 * Returns null if the param is not a recognized deeplink.
 */
export function parseDeeplink(startParam: string | null): DeeplinkRoute | null {
  if (!startParam) return null;

  // Sanitize: only allow alphanumeric, underscore, hyphen
  const safe = startParam.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return null;

  if (safe.startsWith('split_')) {
    const splitId = safe.slice('split_'.length);
    if (!splitId) return null;
    return { path: `/tg/splits/${splitId}` };
  }

  if (safe.startsWith('pay_')) {
    const splitId = safe.slice('pay_'.length);
    if (!splitId) return null;
    return { path: `/tg/splits/${splitId}`, params: { action: 'pay' } };
  }

  if (safe.startsWith('wallet_')) {
    const walletId = safe.slice('wallet_'.length);
    if (!walletId) return null;
    return { path: `/tg/wallets/${walletId}` };
  }

  if (safe.startsWith('request_')) {
    const requestId = safe.slice('request_'.length);
    if (!requestId) return null;
    return { path: `/tg/request/${requestId}` };
  }

  if (safe.startsWith('tx_')) {
    const txId = safe.slice('tx_'.length);
    if (!txId) return null;
    return { path: `/tg/transactions/${txId}` };
  }

  if (safe.startsWith('group_')) {
    // Group context — stay on dashboard but group context is already in TelegramProvider
    return { path: '/tg' };
  }

  return null;
}

/**
 * Build a URL string from a DeeplinkRoute.
 */
export function buildDeeplinkUrl(route: DeeplinkRoute): string {
  const params = route.params ? '?' + new URLSearchParams(route.params).toString() : '';
  return route.path + params;
}

// ---------------------------------------------------------------------------
// Hook — auto-route on mount if start_param exists
// ---------------------------------------------------------------------------

/**
 * Auto-routes to the correct page if a start_param is present.
 * Only fires once per mount (uses a ref guard).
 *
 * @param startParam — from `useTelegram().groupContext.startParam`
 * @param ready — set to true only after auth is complete (avoid routing before auth)
 */
export function useDeeplink(startParam: string | null, ready: boolean): void {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (!ready || handled.current || !startParam) return;

    const route = parseDeeplink(startParam);
    if (!route) return;

    handled.current = true;
    const url = buildDeeplinkUrl(route);

    // Small delay to let the dashboard render first (better UX than blank → redirect)
    const timer = setTimeout(() => {
      router.push(url);
    }, 100);

    return () => clearTimeout(timer);
  }, [startParam, ready, router]);
}
