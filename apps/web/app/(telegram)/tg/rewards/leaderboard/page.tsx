'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Crown, Medal, Trophy } from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { getLeaderboard, getUserRank, getRecentContacts } from '@/lib/firebase/queries';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import { LeaderboardSkeleton } from '@/components/telegram/TelegramSkeletons';
import type { LeaderboardEntry } from '@/types';

// ---------------------------------------------------------------------------
// Podium (top 3)
// ---------------------------------------------------------------------------

function PodiumSpot({
  entry,
  rank,
  isCurrentUser,
}: {
  entry?: LeaderboardEntry;
  rank: 1 | 2 | 3;
  isCurrentUser: boolean;
}) {
  if (!entry) return <div className="flex-1" />;

  const heightMap = { 1: 'h-24', 2: 'h-20', 3: 'h-16' };
  const sizeMap = { 1: 'h-14 w-14', 2: 'h-11 w-11', 3: 'h-11 w-11' };
  const colorMap = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

  return (
    <Link href={`/tg/users/${entry.id}`} className="flex flex-1 flex-col items-center gap-1.5">
      <div className="relative">
        <div
          className={`${sizeMap[rank]} rounded-full flex items-center justify-center overflow-hidden`}
          style={{ border: `2px solid ${colorMap[rank]}` }}
        >
          <Avatar
            src={entry.avatar_url}
            fallback={entry.name}
            size={rank === 1 ? 'lg' : 'md'}
          />
        </div>
        {rank === 1 && (
          <Crown
            size={18}
            weight="fill"
            color="#FFD700"
            className="absolute -top-2.5 left-1/2 -translate-x-1/2"
          />
        )}
      </div>
      <p
        className="text-xs font-medium truncate max-w-[80px] text-center"
        style={{ color: isCurrentUser ? 'var(--color-primary)' : 'var(--color-text)' }}
      >
        {entry.name}
      </p>
      <p
        className="text-xs font-semibold"
        style={{ color: colorMap[rank], fontFamily: 'var(--font-family-number)' }}
      >
        {entry.points.toLocaleString()}
      </p>
      <div
        className={`w-full ${heightMap[rank]} rounded-t-xl flex items-center justify-center`}
        style={{ backgroundColor: `${colorMap[rank]}15`, border: `1px solid ${colorMap[rank]}30` }}
      >
        <span className="text-lg font-bold" style={{ color: colorMap[rank] }}>
          {rank}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard row (rank 4+)
// ---------------------------------------------------------------------------

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  return (
    <Link
      href={`/tg/users/${entry.id}`}
      className="flex items-center gap-3 py-2.5 px-1 rounded-lg transition-colors active:bg-white/[0.04]"
      style={isCurrentUser ? { backgroundColor: 'var(--color-primary-dim)' } : undefined}
    >
      <span
        className="w-7 text-center text-sm font-semibold"
        style={{
          color: isCurrentUser ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family-number)',
        }}
      >
        {entry.rank}
      </span>
      <Avatar src={entry.avatar_url} fallback={entry.name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm truncate"
            style={{ color: isCurrentUser ? 'var(--color-primary)' : 'var(--color-text)' }}
          >
            {entry.name}
          </span>
          {entry.active_badge && (
            <Badge variant="default" size="sm">{entry.active_badge}</Badge>
          )}
        </div>
      </div>
      <span
        className="text-sm font-medium"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
      >
        {entry.points.toLocaleString()}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard Page
// ---------------------------------------------------------------------------

export default function TelegramLeaderboardPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userName = useAppStore((s) => s.user.currentUser?.name) ?? '?';
  const [tab, setTab] = useState<'global' | 'friends'>('global');

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack('/tg/rewards'), [goBack]),
  });

  const { data: leaderboard = [], isLoading, refetch } = useQuery({
    queryKey: ['leaderboard', 100],
    queryFn: () => getLeaderboard(100),
    staleTime: 60_000,
  });

  const { data: userRank = 0 } = useQuery({
    queryKey: ['userRank', userId],
    queryFn: () => getUserRank(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Friends filter: use transaction-based contacts
  const { data: friendContacts = [] } = useQuery({
    queryKey: ['recentContacts', userId, 100],
    queryFn: () => getRecentContacts(userId!, 100),
    enabled: !!userId && tab === 'friends',
    staleTime: 60_000,
  });

  const friendIds = useMemo(
    () => new Set(friendContacts.map((c) => c.id)),
    [friendContacts],
  );

  const displayList = useMemo(() => {
    if (tab === 'global') return leaderboard;
    // Filter to friends + current user, re-rank
    const filtered = leaderboard.filter(
      (e) => friendIds.has(e.id) || e.id === userId,
    );
    return filtered.map((e, i) => ({ ...e, rank: i + 1 }));
  }, [tab, leaderboard, friendIds, userId]);

  const top3 = displayList.slice(0, 3);
  const rest = displayList.slice(3);

  // Current user in list?
  const userInList = displayList.find((e) => e.id === userId);
  const userPoints = useAppStore((s) => s.user.currentUser?.points ?? 0);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<Trophy size={20} weight="fill" color="var(--color-bg)" />}
        title="Leaderboard"
        subtitle={userRank > 0 ? `You're ranked #${userRank}` : 'Compete with the community'}
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--color-white-5)' }}>
        {(['global', 'friends'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              haptic?.selectionChanged();
            }}
            className="flex-1 rounded-lg py-2 text-xs font-medium transition-all capitalize"
            style={{
              backgroundColor: tab === t ? 'var(--color-white-10)' : 'transparent',
              color: tab === t ? 'var(--color-text)' : 'var(--color-text-tertiary)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading && <LeaderboardSkeleton />}

      {!isLoading && displayList.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Trophy size={36} color="var(--color-text-tertiary)" />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {tab === 'friends' ? 'No friends on the leaderboard yet' : 'Leaderboard is empty'}
            </p>
          </div>
        </Card>
      )}

      {/* Podium (top 3) */}
      {top3.length > 0 && (
        <HeroCard className="px-4 pt-5 pb-0 overflow-hidden">
          <div className="flex items-end gap-2">
            <PodiumSpot entry={top3[1]} rank={2} isCurrentUser={top3[1]?.id === userId} />
            <PodiumSpot entry={top3[0]} rank={1} isCurrentUser={top3[0]?.id === userId} />
            <PodiumSpot entry={top3[2]} rank={3} isCurrentUser={top3[2]?.id === userId} />
          </div>
        </HeroCard>
      )}

      {/* Rest of the list */}
      {rest.length > 0 && (
        <Card>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {rest.map((entry) => (
              <LeaderboardRow
                key={entry.id}
                entry={entry}
                isCurrentUser={entry.id === userId}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Fixed user rank card (when user not visible in top list) */}
      {userId && !userInList && userRank > 0 && (
        <Card
          className="sticky bottom-4"
          style={{ border: '1px solid var(--color-primary)', borderColor: 'var(--color-primary)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-7 text-center text-sm font-bold"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family-number)' }}
            >
              {userRank}
            </span>
            <Avatar fallback={userName} size="sm" />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                You
              </p>
            </div>
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
            >
              {userPoints.toLocaleString()}
            </span>
          </div>
        </Card>
      )}
    </div>
    </PullToRefresh>
  );
}
