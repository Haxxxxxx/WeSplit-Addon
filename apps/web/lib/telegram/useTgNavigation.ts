'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store';
import {
  getUserTransactions,
  getUserSharedWallets,
  getSharedWalletById,
  getSharedWalletTransactions,
  getUserNotifications,
  getRecentContacts,
} from '@/lib/firebase/queries';

const TG_ROUTES = [
  '/tg/send',
  '/tg/request',
  '/tg/deposit',
  '/tg/withdraw',
  '/tg/transactions',
  '/tg/wallets',
  '/tg/wallets/create',
  '/tg/notifications',
  '/tg/link-account',
  '/tg/settings',
  '/tg/contacts',
  '/tg/rewards',
  '/tg/rewards/leaderboard',
  '/tg/rewards/quests',
  '/tg/rewards/referral',
  '/tg/rewards/history',
  '/tg/settings/security',
  '/tg/settings/about',
  '/tg/wallet/setup',
  '/tg/wallet/import',
  '/tg/wallet/details',
  '/tg/receive',
  '/tg/splits',
  '/tg/splits/create',
] as const;

/**
 * Centralized TG navigation logic:
 * - Smart back navigation (pop history when possible, push fallback for deep links)
 * - Route prefetching (pre-download JS bundles)
 * - Data prefetching (warm TanStack Query cache before navigation)
 */
export function useTgNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const depthRef = useRef(0);

  // Track navigation depth within the TG app
  useEffect(() => {
    depthRef.current += 1;
  }, [pathname]);

  /**
   * Navigate back. Uses router.back() when there's TG history to pop,
   * falls back to router.push(fallback) for deep-linked entries.
   */
  const goBack = useCallback(
    (fallback = '/tg') => {
      if (depthRef.current > 1) {
        router.back();
      } else {
        router.push(fallback);
      }
    },
    [router],
  );

  /**
   * Prefetch all TG sub-route JS bundles so navigation is instant.
   * Call once on dashboard mount.
   */
  const prefetchRoutes = useCallback(() => {
    for (const route of TG_ROUTES) {
      router.prefetch(route);
    }
  }, [router]);

  /**
   * Prefetch data for a target page to warm the TanStack Query cache
   * before the user actually navigates there.
   */
  const prefetchData = useCallback(
    (route: string, params?: { walletId?: string }) => {
      if (!userId) return;

      if (route === '/tg/transactions') {
        queryClient.prefetchQuery({
          queryKey: ['transactions', userId, 50],
          queryFn: () => getUserTransactions(userId, 50),
          staleTime: 30_000,
        });
      } else if (route === '/tg/wallets') {
        queryClient.prefetchQuery({
          queryKey: ['sharedWallets', userId],
          queryFn: () => getUserSharedWallets(userId),
          staleTime: 30_000,
        });
      } else if (route === '/tg/notifications') {
        queryClient.prefetchQuery({
          queryKey: ['notifications', userId],
          queryFn: () => getUserNotifications(userId),
          staleTime: 15_000,
        });
      } else if (route === '/tg/request' || route === '/tg/send' || route === '/tg/contacts') {
        queryClient.prefetchQuery({
          queryKey: ['recentContacts', userId],
          queryFn: () => getRecentContacts(userId, route === '/tg/contacts' ? 20 : 10),
          staleTime: 60_000,
        });
      } else if (route.startsWith('/tg/wallets/') && params?.walletId) {
        queryClient.prefetchQuery({
          queryKey: ['sharedWallet', params.walletId],
          queryFn: () => getSharedWalletById(params.walletId!),
          staleTime: 30_000,
        });
        queryClient.prefetchQuery({
          queryKey: ['sharedWalletTransactions', params.walletId],
          queryFn: () => getSharedWalletTransactions(params.walletId!),
          staleTime: 30_000,
        });
      }
    },
    [queryClient, userId],
  );

  const navigate = useCallback((path: string) => router.push(path), [router]);

  return { goBack, navigate, prefetchRoutes, prefetchData };
}
