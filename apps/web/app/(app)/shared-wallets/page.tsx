'use client';

import Link from 'next/link';
import { Plus, Users, Wallet, Clock } from '@phosphor-icons/react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AvatarGroup } from '@/components/ui/Avatar';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/lib/utils';
import { getUserSharedWallets } from '@/lib/firebase/queries';
import { useAppStore } from '@/store';
import { withdrawalApprovalService } from '@/lib/services/withdrawalApprovalService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic color from a string — picks from a fixed palette */
const PALETTE = [
  'var(--color-wallet-purple)',
  'var(--color-wallet-green)',
  'var(--color-wallet-orange)',
  'var(--color-wallet-blue)',
  'var(--color-wallet-red)',
  'var(--color-wallet-teal)',
  'var(--color-wallet-yellow)',
  'var(--color-wallet-pink)',
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

// ---------------------------------------------------------------------------
// Skeleton placeholder for loading state
// ---------------------------------------------------------------------------

function SharedWalletSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Skeleton width={48} height={48} radius="xl" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton height={16} width="60%" radius="sm" />
            <Skeleton height={12} width="30%" radius="sm" />
          </div>
        </div>
        {/* Balance label + value */}
        <div className="flex flex-col gap-1.5">
          <Skeleton height={10} width="25%" radius="sm" />
          <Skeleton height={28} width="50%" radius="sm" />
        </div>
        {/* Members row */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={24} height={24} radius="full" />
            ))}
          </div>
          <Skeleton height={12} width={32} radius="sm" />
        </div>
      </div>
    </SkeletonCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SharedWalletsPage() {
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const { data: wallets = [], isLoading } = useQuery({
    queryKey: ['sharedWallets', userId],
    queryFn: () => getUserSharedWallets(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch pending withdrawal counts for all wallets (for admin/creator badges)
  const pendingCountQueries = useQueries({
    queries: wallets.map((wallet) => ({
      queryKey: ['withdrawalRequests', 'pendingCount', wallet.id],
      queryFn: () => withdrawalApprovalService.getPendingWithdrawalCount(wallet.id),
      enabled: !!wallet.id,
      staleTime: 60_000, // 1 minute
    })),
  });

  // Create a map of walletId -> pending count
  const pendingCountMap = new Map<string, number>();
  wallets.forEach((wallet, index) => {
    const query = pendingCountQueries[index];
    if (query?.data !== undefined) {
      pendingCountMap.set(wallet.id, query.data);
    }
  });

  return (
    <PageContainer>
      <PageHeader
        title="Shared Wallets"
        subtitle="Collaborative wallets for groups"
        rightElement={
          <Link href="/shared-wallets/create">
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} weight="bold" />}>
              Create
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        /* Loading state — 4 skeleton cards in the same grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <SharedWalletSkeleton key={i} />
          ))}
        </div>
      ) : wallets.length === 0 ? (
        /* Empty state */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
            style={{ backgroundColor: 'var(--color-white-5)' }}
          >
            👥
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>No shared wallets yet</p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Create one to start splitting expenses with friends</p>
          </div>
          <Link href="/shared-wallets/create">
            <Button variant="primary" leftIcon={<Plus size={18} weight="bold" />}>
              Create Shared Wallet
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {wallets.map((sw) => {
            const balance = sw.balance ?? sw.usdc_balance ?? 0;
            const memberCount = sw.members?.length ?? 0;
            const userMember = sw.members?.find(
              (m) => m.user_id === userId || m.userId === userId
            );
            const role = userMember?.role ?? 'member';
            const isAdminOrCreator = role === 'admin' || role === 'creator';
            const pendingCount = pendingCountMap.get(sw.id) ?? 0;
            const color = colorFromName(sw.name ?? '');
            const avatars = (sw.members ?? []).map((m) => ({
              fallback: m.name ?? (m.user_id ?? m.userId ?? '').slice(0, 6),
            }));

            return (
              <Link key={sw.id} href={`/shared-wallets/${sw.id}`}>
                <Card hoverable className="h-full transition-all relative">
                  {/* Pending approval badge - top right */}
                  {isAdminOrCreator && pendingCount > 0 && (
                    <div
                      className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{ backgroundColor: 'var(--color-warning)' }}
                    >
                      <Clock size={10} weight="bold" style={{ color: 'var(--color-bg)' }} />
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: 'var(--color-bg)' }}
                      >
                        {pendingCount}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${color}22`, border: `1px solid ${color}44` }}
                      >
                        {sw.name ? (
                          <span
                            className="text-lg font-bold"
                            style={{ color }}
                          >
                            {sw.name.charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <Wallet size={22} style={{ color }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold" style={{ color: 'var(--color-text)' }}>{sw.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant={role === 'creator' ? 'primary' : role === 'admin' ? 'info' : 'default'}
                            size="sm"
                          >
                            {role}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Balance */}
                    <div>
                      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Balance</p>
                      <p
                        className="text-2xl font-semibold"
                        style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
                      >
                        {formatCurrency(balance, 'USDC')}
                      </p>
                    </div>

                    {/* Members */}
                    <div className="flex items-center justify-between">
                      <AvatarGroup avatars={avatars} max={3} size="xs" />
                      <div className="flex items-center gap-1.5">
                        <Users size={14} color="var(--color-text-tertiary)" />
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{memberCount}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}

          {/* Create new CTA */}
          <Link href="/shared-wallets/create">
            <div
              className="flex h-full min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] p-5 text-center transition-all hover:bg-white/[0.04]"
              style={{ border: '2px dashed var(--color-border)' }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--color-white-10)' }}
              >
                <Plus size={22} color="var(--color-text-secondary)" />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Create new wallet</p>
            </div>
          </Link>
        </div>
      )}
    </PageContainer>
  );
}
