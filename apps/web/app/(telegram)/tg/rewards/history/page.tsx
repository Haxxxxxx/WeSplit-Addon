'use client';

import { useCallback, useMemo } from 'react';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  CurrencyCircleDollar,
  Trophy,
  Handshake,
  GearSix,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { useTelegramBackButton } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { getPointsHistory } from '@/lib/firebase/queries';
import { formatDate, toDate } from '@/lib/utils';
import { PointsHistorySkeleton } from '@/components/telegram/TelegramSkeletons';
import type { PointsTransaction, PointsSource } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_CONFIG: Record<PointsSource, { icon: React.ElementType; label: string; color: string }> = {
  transaction_reward: { icon: CurrencyCircleDollar, label: 'Transaction Reward', color: '#2ECC71' },
  quest_completion: { icon: Star, label: 'Quest Completed', color: '#F1C40F' },
  season_reward: { icon: Trophy, label: 'Season Reward', color: '#E67E22' },
  referral_reward: { icon: Handshake, label: 'Referral Reward', color: '#3498DB' },
  admin_adjustment: { icon: GearSix, label: 'Adjustment', color: '#95A5A6' },
};

function groupByMonth(transactions: PointsTransaction[]): Map<string, PointsTransaction[]> {
  const groups = new Map<string, PointsTransaction[]>();
  for (const tx of transactions) {
    const d = toDate(tx.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(tx);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Points History Page
// ---------------------------------------------------------------------------

export default function TelegramPointsHistoryPage() {
  const { goBack } = useTgNavigation();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack('/tg/rewards'), [goBack]),
  });

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['pointsHistory', userId, 100],
    queryFn: () => getPointsHistory(userId!, 100),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const grouped = useMemo(() => groupByMonth(history), [history]);

  const totalPoints = useMemo(
    () => history.reduce((sum, tx) => sum + tx.amount, 0),
    [history],
  );

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<ClockCounterClockwise size={20} weight="fill" color="var(--color-bg)" />}
        title="Points History"
        subtitle={`${totalPoints.toLocaleString()} total points earned`}
      />

      {isLoading && <PointsHistorySkeleton />}

      {!isLoading && history.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Star size={36} color="var(--color-text-tertiary)" />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No points earned yet
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Complete quests and make transactions to start earning
            </p>
          </div>
        </Card>
      )}

      {Array.from(grouped.entries()).map(([month, txs]) => (
        <div key={month}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {month}
          </p>
          <Card>
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {txs.map((tx) => {
                const config = SOURCE_CONFIG[tx.source] ?? SOURCE_CONFIG.transaction_reward;
                const Icon = config.icon;
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${config.color}20` }}
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
                      className="text-sm font-semibold"
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
    </div>
    </PullToRefresh>
  );
}
