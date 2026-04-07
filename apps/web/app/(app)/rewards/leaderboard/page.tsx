'use client';

import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { getLeaderboard, getUserRank } from '@/lib/firebase/queries';
import { useAppStore } from '@/store';
import type { LeaderboardEntry } from '@/types';

const RANK_COLORS: Record<number, string> = {
  1: '#F1C40F',
  2: '#BDC3C7',
  3: '#CD7F32',
};

export default function LeaderboardPage() {
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;

  const { data: entries = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: () => getLeaderboard(50),
  });

  const { data: myRank } = useQuery<number>({
    queryKey: ['myRank', userId],
    queryFn: () => getUserRank(userId!),
    enabled: !!userId,
  });

  // Check if user is already in the top entries
  const userInList = entries.some((e) => e.id === userId);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href="/rewards" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back to Rewards
          </Link>
        </div>
        <Skeleton width={200} height={32} radius="sm" className="mb-4" />
        <div className="flex items-end justify-center gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width={100} height={180} radius="lg" />
          ))}
        </div>
        <SkeletonText lines={6} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/rewards" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back to Rewards
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Leaderboard</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Top earners this month</p>
      </div>

      {entries.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No leaderboard data yet</p>
        </Card>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length >= 3 && (
            <div className="mb-6 flex items-end justify-center gap-3">
              {[top3[1], top3[0], top3[2]].map((entry, i) => {
                if (!entry) return null;
                const podiumRank = [2, 1, 3][i] as number;
                const heights = ['h-24', 'h-32', 'h-20'] as const;
                const isMe = entry.id === userId;
                return (
                  <div key={entry.id} className="flex flex-col items-center gap-2 flex-1 max-w-[100px]">
                    <Avatar fallback={entry.name} src={entry.avatar_url} size="lg" />
                    <div className="text-center">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                        {isMe ? 'You' : entry.name.split(' ')[0]}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family-number)' }}>
                        {entry.points.toLocaleString()}
                      </p>
                    </div>
                    <div
                      className={`flex w-full ${heights[i]} items-center justify-center rounded-t-[var(--radius-lg)]`}
                      style={{ backgroundColor: `${RANK_COLORS[podiumRank]}22`, border: `1px solid ${RANK_COLORS[podiumRank]}55` }}
                    >
                      <span className="text-2xl font-bold" style={{ color: RANK_COLORS[podiumRank] }}>
                        {podiumRank === 1 ? '🥇' : podiumRank === 2 ? '🥈' : '🥉'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rank list */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {rest.map((entry) => {
                const isMe = entry.id === userId;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-5 py-4"
                    style={{ backgroundColor: isMe ? 'var(--color-primary-dim)' : 'transparent' }}
                  >
                    <div className="w-6 text-center">
                      <span
                        className="text-sm font-bold"
                        style={{ color: RANK_COLORS[entry.rank] ?? 'var(--color-text-secondary)' }}
                      >
                        {entry.rank}
                      </span>
                    </div>
                    <Avatar fallback={entry.name} src={entry.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium" style={{ color: 'var(--color-text)' }}>
                          {isMe ? 'You' : entry.name}
                        </span>
                        {isMe && <Badge variant="primary" size="sm">You</Badge>}
                      </div>
                      {entry.wallet_address && (
                        <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {entry.wallet_address.slice(0, 4)}...{entry.wallet_address.slice(-4)}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
                        {entry.points.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Show current user at bottom if not in the top list */}
              {!userInList && myRank && currentUser && (
                <div
                  className="flex items-center gap-3 px-5 py-4"
                  style={{ backgroundColor: 'var(--color-primary-dim)' }}
                >
                  <div className="w-6 text-center">
                    <span className="text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                      {myRank}
                    </span>
                  </div>
                  <Avatar fallback={currentUser.name || 'Me'} src={currentUser.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium" style={{ color: 'var(--color-text)' }}>You</span>
                      <Badge variant="primary" size="sm">You</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
                      {(currentUser.points ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
