'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  CurrencyCircleDollar,
  Trophy,
  Handshake,
  GearSix,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { getPointsHistory } from '@/lib/firebase/queries';
import { formatDate } from '@/lib/utils';
import { useAppStore } from '@/store';
import type { PointsTransaction, PointsSource } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
}

const SOURCE_CONFIG: Record<PointsSource, { icon: React.ElementType; label: string; color: string }> = {
  transaction_reward: { icon: CurrencyCircleDollar, label: 'Transaction Reward', color: 'var(--color-success)' },
  quest_completion:   { icon: Star,                label: 'Quest Completed',    color: 'var(--color-warning)' },
  season_reward:      { icon: Trophy,              label: 'Season Reward',      color: 'var(--color-orange)' },
  referral_reward:    { icon: Handshake,           label: 'Referral Reward',    color: 'var(--color-info)' },
  admin_adjustment:   { icon: GearSix,             label: 'Adjustment',         color: 'var(--color-text-tertiary)' },
};

function groupByMonth(transactions: PointsTransaction[]): Map<string, PointsTransaction[]> {
  const groups = new Map<string, PointsTransaction[]>();
  for (const tx of transactions) {
    const d = toDate(tx.created_at);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(tx);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PointsHistoryPage() {
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;

  const { data: history = [], isLoading } = useQuery<PointsTransaction[]>({
    queryKey: ['pointsHistory', userId, 100],
    queryFn: () => getPointsHistory(userId!, 100),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const grouped = useMemo(() => groupByMonth(history), [history]);

  const totalPoints = useMemo(
    () => history.reduce((sum, tx) => sum + tx.amount, 0),
    [history],
  );

  return (
    <PageContainer>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/rewards"
          className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={16} /> Back to Rewards
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--color-white-10)' }}
        >
          <ClockCounterClockwise size={20} weight="fill" style={{ color: 'var(--color-text)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            Points History
          </h1>
          {!isLoading && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {totalPoints.toLocaleString()} total points earned
            </p>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton width={120} height={14} radius="sm" />
              <Card padding="none">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                    <Skeleton width={32} height={32} radius="full" />
                    <div className="flex-1 flex flex-col gap-1">
                      <Skeleton width="55%" height={13} radius="sm" />
                      <Skeleton width="30%" height={11} radius="sm" />
                    </div>
                    <Skeleton width={40} height={13} radius="sm" />
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && history.length === 0 && (
        <Card className="text-center py-16">
          <Star size={48} color="var(--color-text-tertiary)" className="mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            No points earned yet
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Complete quests and make transactions to start earning
          </p>
        </Card>
      )}

      {/* Grouped history */}
      {!isLoading && Array.from(grouped.entries()).map(([month, txs]) => (
        <div key={month} className="mb-6">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {month}
          </p>
          <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {txs.map((tx) => {
                const config = SOURCE_CONFIG[tx.source] ?? SOURCE_CONFIG.transaction_reward;
                const Icon = config.icon;
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)` }}
                    >
                      <Icon size={14} weight="fill" color={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                        {tx.description ?? config.label}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {formatDate(toDate(tx.created_at), { format: 'relative' })}
                      </p>
                    </div>
                    <span
                      className="text-sm font-semibold shrink-0"
                      style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family-number)' }}
                    >
                      +{tx.amount}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ))}
    </PageContainer>
  );
}
