'use client';

import { useCallback } from 'react';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  Trophy,
  Target,
  UserPlus,
  ArrowRight,
  CurrencyCircleDollar,
  Handshake,
  GearSix,
} from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTelegramBackButton } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { getPointsHistory } from '@/lib/firebase/queries';
import { formatDate, toDate } from '@/lib/utils';
import type { PointsTransaction, PointsSource } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_CONFIG: Record<PointsSource, { icon: React.ElementType; label: string }> = {
  transaction_reward: { icon: CurrencyCircleDollar, label: 'Transaction' },
  quest_completion: { icon: Star, label: 'Quest' },
  season_reward: { icon: Trophy, label: 'Season' },
  referral_reward: { icon: Handshake, label: 'Referral' },
  admin_adjustment: { icon: GearSix, label: 'Adjustment' },
};

function PointsRow({ tx }: { tx: PointsTransaction }) {
  const config = SOURCE_CONFIG[tx.source] ?? SOURCE_CONFIG.transaction_reward;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--color-primary-dim)' }}
      >
        <Icon size={14} weight="fill" color="var(--color-primary)" />
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
}

// ---------------------------------------------------------------------------
// Feature card
// ---------------------------------------------------------------------------

function FeatureCard({
  icon: Icon,
  title,
  subtitle,
  href,
  color,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href} className="flex-1">
      <Card className="h-full transition-colors active:bg-white/[0.04]">
        <div className="flex flex-col gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon size={20} weight="fill" color={color} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {title}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {subtitle}
          </p>
        </div>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Rewards Hub
// ---------------------------------------------------------------------------

export default function TelegramRewardsPage() {
  const { goBack } = useTgNavigation();
  const user = useAppStore((s) => s.user.currentUser);
  const userId = user?.id;

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const { data: recentPoints = [], refetch } = useQuery({
    queryKey: ['pointsHistory', userId, 4],
    queryFn: () => getPointsHistory(userId!, 4),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const points = user?.points ?? 0;

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-24 animate-fade-in">
      {/* Points hero */}
      <HeroCard className="p-5 text-center">
        <div className="flex justify-center mb-2">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }}
          >
            <Star size={28} weight="fill" color="var(--color-bg)" />
          </div>
        </div>
        <p
          className="text-xs uppercase tracking-widest mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Your Points
        </p>
        <p
          className="font-bold mb-1"
          style={{
            fontFamily: 'var(--font-family-number)',
            fontSize: 'var(--font-size-balance)',
            color: 'var(--color-text)',
          }}
        >
          {points.toLocaleString()}
        </p>
        {user?.active_badge && (
          <Badge variant="primary" size="sm">{user.active_badge}</Badge>
        )}
      </HeroCard>

      {/* Invite friends CTA */}
      <Link href="/tg/rewards/referral">
        <Card
          className="flex items-center gap-3 transition-colors active:bg-white/[0.04]"
          style={{ border: '1px solid var(--color-primary)', borderColor: 'var(--color-primary)' }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }}
          >
            <UserPlus size={20} weight="fill" color="var(--color-bg)" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Invite Friends
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Earn points for every friend who joins
            </p>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        </Card>
      </Link>

      {/* Feature cards grid */}
      <div className="grid grid-cols-2 gap-3">
        <FeatureCard
          icon={Trophy}
          title="Leaderboard"
          subtitle="See where you rank"
          href="/tg/rewards/leaderboard"
          color="#FFD700"
        />
        <FeatureCard
          icon={Target}
          title="Quests"
          subtitle="Complete tasks, earn more"
          href="/tg/rewards/quests"
          color="#9B59B6"
        />
      </div>

      {/* Recent points */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
            Recent Points
          </h2>
          {recentPoints.length > 0 && (
            <Link
              href="/tg/rewards/history"
              className="text-xs font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              See all
            </Link>
          )}
        </div>
        {recentPoints.length > 0 ? (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {recentPoints.map((pt) => (
              <PointsRow key={pt.id} tx={pt} />
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Complete quests and transactions to earn points
          </p>
        )}
      </Card>
    </div>
    </PullToRefresh>
  );
}
