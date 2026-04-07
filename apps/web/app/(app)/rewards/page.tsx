'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Trophy, ArrowRight, CheckCircle, Clock, Spinner, ClockCounterClockwise } from '@phosphor-icons/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { getUserQuests, getUserBadgeProgress, claimBadge } from '@/lib/firebase/queries';
import { useAppStore } from '@/store';
import { REFERRAL_BONUS_POINTS } from '@/lib/constants';
import type { Quest, UserBadgeProgress } from '@/types';

// Human-readable metadata for each quest type
const QUEST_META: Record<string, { title: string; description: string }> = {
  export_seed_phrase:                   { title: 'Backup Wallet',           description: 'Export and save your seed phrase' },
  setup_account_pp:                     { title: 'Profile Photo',           description: 'Set up your profile picture' },
  first_shared_wallet_with_friends:     { title: 'Group Wallet',            description: 'Create a shared wallet with friends' },
  first_external_wallet_linked:         { title: 'Link Wallet',             description: 'Link an external Solana wallet' },
  invite_friends_create_account:        { title: 'Invite Friends',          description: 'Invite a friend who creates an account' },
  friend_do_first_shared_wallet_over_10:{ title: 'Power Referral',          description: 'Referred friend creates a wallet with $10+' },
  follow_x:                             { title: 'Follow on X',             description: 'Follow WeSplit on X (Twitter)' },
  join_telegram:                        { title: 'Join Telegram',           description: 'Join the WeSplit Telegram community' },
};

export default function RewardsPage() {
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;
  const queryClient = useQueryClient();

  const totalPoints = currentUser?.points ?? 0;
  const level = Math.floor(totalPoints / 200) + 1;
  const pointsToNextLevel = 200 - (totalPoints % 200);

  // Quests
  const { data: quests = [], isLoading: questsLoading } = useQuery<Quest[]>({
    queryKey: ['quests', userId],
    queryFn: () => getUserQuests(userId!),
    enabled: !!userId,
  });

  // Badges
  const { data: badgeProgress = [], isLoading: badgesLoading } = useQuery<UserBadgeProgress[]>({
    queryKey: ['badgeProgress', userId],
    queryFn: () => getUserBadgeProgress(userId!),
    enabled: !!userId,
  });

  // Claim badge mutation
  const claimMutation = useMutation({
    mutationFn: (badgeId: string) => claimBadge(userId!, badgeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badgeProgress', userId] });
    },
  });

  const activeQuests = quests.filter((q) => !q.completed);

  return (
    <PageContainer>
      <PageHeader
        title="Rewards"
        subtitle="Earn points for every action"
        rightElement={
          <div className="flex items-center gap-2">
            <Link href="/rewards/history">
              <Button variant="ghost" size="sm" leftIcon={<ClockCounterClockwise size={14} />}>History</Button>
            </Link>
            <Link href="/rewards/leaderboard">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>Leaderboard</Button>
            </Link>
          </div>
        }
      />

      {/* Points hero */}
      <div
        className="mb-6 rounded-[var(--radius-2xl)] p-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--color-gradient-start) 0%, var(--color-gradient-end) 100%)' }}
      >
        <div className="pointer-events-none absolute right-4 top-4 opacity-20">
          <Trophy size={100} weight="fill" color="var(--color-bg)" />
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(6,17,19,0.7)' }}>Your Points</p>
        <p
          className="text-6xl font-semibold mb-2"
          style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-bg)' }}
        >
          {totalPoints.toLocaleString()}
        </p>
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="default" className="bg-black/10 text-[var(--color-bg)] border-transparent">Level {level}</Badge>
          <span className="text-xs font-medium" style={{ color: 'rgba(6,17,19,0.7)' }}>
            {pointsToNextLevel} pts to Level {level + 1}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-black/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${((totalPoints % 200) / 200) * 100}%`, backgroundColor: 'rgba(6,17,19,0.5)' }}
          />
        </div>
      </div>

      {/* Quests */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>Quests</h2>
          {!questsLoading && <Badge variant="primary" size="sm">{activeQuests.length} active</Badge>}
        </div>

        {questsLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={72} radius="lg" />
            ))}
          </div>
        ) : quests.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No quests available yet</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {quests.map((quest) => {
              const meta = QUEST_META[quest.type] ?? { title: quest.type, description: '' };
              return (
                <Card key={quest.id} padding="sm">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: quest.completed ? 'var(--color-success-20)' : 'var(--color-white-10)' }}
                    >
                      {quest.completed
                        ? <CheckCircle size={22} weight="fill" color="var(--color-success)" />
                        : <Clock size={22} color="var(--color-text-tertiary)" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{meta.title}</span>
                        {quest.points && <Badge variant="primary" size="sm">+{quest.points} pts</Badge>}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{meta.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="mb-6">
        <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text)' }}>Badges</h2>

        {badgesLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} width="100%" height={100} radius="lg" />
            ))}
          </div>
        ) : badgeProgress.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No badges available yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {badgeProgress.map((bp) => {
              const canClaim = !bp.claimed && bp.current >= bp.badge.target;
              return (
                <div
                  key={bp.badge.id}
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-xl)] p-3"
                  style={{
                    backgroundColor: bp.claimed ? 'var(--color-primary-dim)' : 'var(--color-white-5)',
                    border: bp.claimed ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    opacity: bp.claimed ? 1 : canClaim ? 0.9 : 0.5,
                  }}
                >
                  {bp.badge.icon_url ? (
                    <Image src={bp.badge.icon_url} alt={bp.badge.name} width={32} height={32} className="h-8 w-8" />
                  ) : (
                    <span className="text-3xl">{bp.claimed ? '🏆' : '🔒'}</span>
                  )}
                  <span
                    className="text-center text-xs font-medium"
                    style={{ color: bp.claimed ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                  >
                    {bp.badge.name}
                  </span>
                  {canClaim && (
                    <button
                      type="button"
                      onClick={() => claimMutation.mutate(bp.badge.id)}
                      disabled={claimMutation.isPending}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
                    >
                      {claimMutation.isPending ? 'Claiming...' : 'Claim'}
                    </button>
                  )}
                  {!bp.claimed && !canClaim && (
                    <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {bp.current}/{bp.badge.target}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Referral CTA */}
      <Card gradientBorderAlways>
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: 'var(--color-primary-dim)' }}
          >
            🎁
          </div>
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Refer a friend</p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Earn {REFERRAL_BONUS_POINTS} points per referral</p>
          </div>
          <Link href="/rewards/referral">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>Share</Button>
          </Link>
        </div>
      </Card>
    </PageContainer>
  );
}
