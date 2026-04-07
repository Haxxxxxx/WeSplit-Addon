'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { Users, Plus } from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { formatCurrency, hexToRgba } from '@/lib/utils';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useSharedWallets } from '@/hooks';
import { WalletsListSkeleton } from '@/components/telegram/TelegramSkeletons';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WALLET_COLORS = ['#9B59B6', '#2ECC71', '#E67E22', '#3498DB', '#E74C3C', '#1ABC9C'];

// ---------------------------------------------------------------------------
// Telegram Shared Wallets Page
// ---------------------------------------------------------------------------

export default function TelegramWalletsPage() {
  const { goBack, prefetchData } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { wallets, isLoading, refetch } = useSharedWallets();

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const totalBalance = wallets.reduce(
    (sum, w) => sum + (w.usdc_balance ?? w.balance ?? 0),
    0,
  );

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (isLoading) return <WalletsListSkeleton />;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-24 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-bold" style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-h2)' }}>
          Shared Wallets
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} &middot;{' '}
          <span style={{ fontFamily: 'var(--font-family-number)' }}>
            {formatCurrency(totalBalance, 'USDC')}
          </span>{' '}
          total
        </p>
      </div>

      {/* Wallet list */}
      {wallets.length > 0 ? (
        <div className="flex flex-col gap-3">
          {wallets.map((sw, i) => {
            const color = WALLET_COLORS[i % WALLET_COLORS.length] ?? '#3498DB';
            const balance = sw.usdc_balance ?? sw.balance ?? 0;
            return (
              <Link
                key={sw.id}
                href={`/tg/wallets/${sw.id}`}
                onTouchStart={() => prefetchData(`/tg/wallets/${sw.id}`, { walletId: sw.id })}
                onClick={() => haptic?.impactOccurred('light')}
              >
                <Card className="flex items-center gap-3 p-4 transition-colors active:bg-white/[0.04]">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-semibold"
                    style={{
                      backgroundColor: hexToRgba(color, 0.13),
                      border: `1px solid ${hexToRgba(color, 0.2)}`,
                      color,
                    }}
                  >
                    {sw.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="truncate text-base font-medium" style={{ color: 'var(--color-text)' }}>
                      {sw.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Users size={11} className="inline mr-1" />
                      {sw.members?.length ?? 0} members
                    </span>
                  </div>
                  <span
                    className="text-base font-medium"
                    style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
                  >
                    {formatCurrency(balance, 'USDC')}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Users size={36} color="var(--color-text-tertiary)" />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No shared wallets yet
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Create one to start splitting expenses with friends
            </p>
          </div>
        </Card>
      )}

      {/* Create button */}
      <Link href="/tg/wallets/create" className="block">
        <div
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors active:opacity-80"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          <Plus size={16} weight="bold" />
          Create Shared Wallet
        </div>
      </Link>
    </div>
    </PullToRefresh>
  );
}
