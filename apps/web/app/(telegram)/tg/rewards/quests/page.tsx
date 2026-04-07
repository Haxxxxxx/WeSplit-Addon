'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Target,
  Star,
  CheckCircle,
  ShieldStar,
  Wallet,
  Users,
  Link as LinkIcon,
  XLogo,
  TelegramLogo,
  Lock,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { getUserQuests, getUserBadgeProgress, claimBadge } from '@/lib/firebase/queries';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import { QuestsSkeleton } from '@/components/telegram/TelegramSkeletons';
import type { Quest, QuestType, UserBadgeProgress } from '@/types';

// ---------------------------------------------------------------------------
// Quest config
// ---------------------------------------------------------------------------

const QUEST_CONFIG: Record<
  QuestType,
  { icon: React.ElementType; title: string; description: string; points: number }
> = {
  export_seed_phrase: {
    icon: Lock,
    title: 'Backup Your Wallet',
    description: 'Export and safely store your seed phrase',
    points: 100,
  },
  setup_account_pp: {
    icon: Star,
    title: 'Complete Your Profile',
    description: 'Set up your display name and avatar',
    points: 50,
  },
  first_shared_wallet_with_friends: {
    icon: Users,
    title: 'Create a Shared Wallet',
    description: 'Create your first shared wallet with friends',
    points: 200,
  },
  first_external_wallet_linked: {
    icon: LinkIcon,
    title: 'Link External Wallet',
    description: 'Connect a Phantom or Solflare wallet',
    points: 150,
  },
  invite_friends_create_account: {
    icon: Users,
    title: 'Invite a Friend',
    description: 'Get a friend to create a WeSplit account',
    points: 500,
  },
  friend_do_first_shared_wallet_over_10: {
    icon: Wallet,
    title: 'Friend Creates Split',
    description: 'A referred friend creates their first split over $10',
    points: 300,
  },
  follow_x: {
    icon: XLogo,
    title: 'Follow on X',
    description: 'Follow WeSplit on X (Twitter)',
    points: 50,
  },
  join_telegram: {
    icon: TelegramLogo,
    title: 'Join Telegram Group',
    description: 'Join the official WeSplit Telegram community',
    points: 50,
  },
};

// Sort order: incomplete first, then completed
function sortQuests(quests: Quest[]): Quest[] {
  return [...quests].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });
}

// ---------------------------------------------------------------------------
// Quest card
// ---------------------------------------------------------------------------

function QuestCard({ quest }: { quest: Quest }) {
  const config = QUEST_CONFIG[quest.type];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ opacity: quest.completed ? 0.5 : 1 }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: quest.completed ? 'var(--color-success-20)' : 'var(--color-white-10)',
        }}
      >
        {quest.completed ? (
          <CheckCircle size={20} weight="fill" color="var(--color-success)" />
        ) : (
          <Icon size={20} weight="fill" style={{ color: 'var(--color-text)' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: 'var(--color-text)' }}>
          {config.title}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {config.description}
        </p>
      </div>
      <Badge
        variant={quest.completed ? 'default' : 'primary'}
        size="sm"
      >
        {quest.completed ? 'Done' : `+${quest.points ?? config.points}`}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge progress card
// ---------------------------------------------------------------------------

function BadgeCard({
  progress,
  onClaim,
  claiming,
}: {
  progress: UserBadgeProgress;
  onClaim: () => void;
  claiming: boolean;
}) {
  const { badge, current, claimed } = progress;
  const pct = Math.min((current / badge.target) * 100, 100);
  const canClaim = current >= badge.target && !claimed;

  return (
    <Card padding="sm">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: claimed ? 'var(--color-success-20)' : 'var(--color-white-10)',
          }}
        >
          {claimed ? (
            <ShieldStar size={20} weight="fill" color="var(--color-success)" />
          ) : (
            <ShieldStar size={20} weight="fill" style={{ color: 'var(--color-text-tertiary)' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {badge.name}
          </p>
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {badge.description}
          </p>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-white-10)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: claimed ? 'var(--color-success)' : 'var(--color-primary)',
                }}
              />
            </div>
            <span
              className="text-xs shrink-0"
              style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family-number)' }}
            >
              {current}/{badge.target}
            </span>
          </div>
        </div>

        {canClaim && (
          <Button
            size="sm"
            variant="primary"
            onClick={onClaim}
            loading={claiming}
          >
            Claim
          </Button>
        )}
        {claimed && (
          <Badge variant="default" size="sm">Claimed</Badge>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quests & Badges Page
// ---------------------------------------------------------------------------

export default function TelegramQuestsPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const queryClient = useQueryClient();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const [tab, setTab] = useState<'quests' | 'badges'>('quests');
  const [claimingBadge, setClaimingBadge] = useState<string | null>(null);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack('/tg/rewards'), [goBack]),
  });

  // Quests
  const { data: quests = [], isLoading: questsLoading, refetch: refetchQuests } = useQuery({
    queryKey: ['userQuests', userId],
    queryFn: () => getUserQuests(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Fill in any missing quest types (show all quests even if user hasn't started them)
  const allQuests: Quest[] = Object.keys(QUEST_CONFIG).map((type) => {
    const existing = quests.find((q) => q.type === type);
    return existing ?? { id: type, type: type as QuestType, completed: false };
  });

  // Badges
  const { data: badgeProgress = [], isLoading: badgesLoading } = useQuery({
    queryKey: ['userBadgeProgress', userId],
    queryFn: () => getUserBadgeProgress(userId!),
    enabled: !!userId && tab === 'badges',
    staleTime: 30_000,
  });

  // Sort: ready to claim → in progress → claimed
  const sortedBadges = [...badgeProgress].sort((a, b) => {
    const aCanClaim = a.current >= a.badge.target && !a.claimed ? 0 : a.claimed ? 2 : 1;
    const bCanClaim = b.current >= b.badge.target && !b.claimed ? 0 : b.claimed ? 2 : 1;
    return aCanClaim - bCanClaim;
  });

  const handleClaimBadge = useCallback(
    async (badgeId: string) => {
      if (!userId || claimingBadge) return;
      setClaimingBadge(badgeId);
      try {
        await claimBadge(userId, badgeId);
        haptic?.notificationOccurred('success');
        queryClient.invalidateQueries({ queryKey: ['userBadgeProgress', userId] });
      } catch {
        haptic?.notificationOccurred('error');
      } finally {
        setClaimingBadge(null);
      }
    },
    [userId, claimingBadge, haptic, queryClient],
  );

  const completedCount = allQuests.filter((q) => q.completed).length;

  const handleRefresh = useCallback(async () => {
    await refetchQuests();
  }, [refetchQuests]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<Target size={20} weight="fill" color="var(--color-bg)" />}
        title="Quests & Badges"
        subtitle={`${completedCount}/${allQuests.length} quests completed`}
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--color-white-5)' }}>
        {(['quests', 'badges'] as const).map((t) => (
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

      {/* Quests tab */}
      {tab === 'quests' && (
        <>
          {questsLoading && <QuestsSkeleton />}
          {!questsLoading && (
            <Card>
              <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {sortQuests(allQuests).map((quest) => (
                  <QuestCard key={quest.type} quest={quest} />
                ))}
              </div>
            </Card>
          )}

          {/* Info card */}
          <Card>
            <div
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ backgroundColor: 'var(--color-white-5)' }}
            >
              <Star size={20} weight="fill" color="var(--color-primary)" />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Earn points for every action
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Transactions, splits, and referrals all earn you points automatically
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Badges tab */}
      {tab === 'badges' && (
        <>
          {badgesLoading && <QuestsSkeleton />}
          {!badgesLoading && sortedBadges.length === 0 && (
            <Card>
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ShieldStar size={36} color="var(--color-text-tertiary)" />
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No badges available yet
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Badges will appear as you use WeSplit more
                </p>
              </div>
            </Card>
          )}
          {!badgesLoading && sortedBadges.length > 0 && (
            <div className="flex flex-col gap-3">
              {sortedBadges.map((bp) => (
                <BadgeCard
                  key={bp.badge.id}
                  progress={bp}
                  onClaim={() => handleClaimBadge(bp.badge.id)}
                  claiming={claimingBadge === bp.badge.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
    </PullToRefresh>
  );
}
