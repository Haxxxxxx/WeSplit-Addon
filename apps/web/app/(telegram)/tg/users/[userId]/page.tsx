'use client';

import { use, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  User as UserIcon,
  Wallet,
  Star,
  PaperPlaneTilt,
  HandCoins,
  Copy,
  Check,
  Trophy,
  CalendarBlank,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Card, HeroCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { getUserDoc, getUserRank } from '@/lib/firebase/queries';

// ---------------------------------------------------------------------------
// User Profile Page
// ---------------------------------------------------------------------------

export default function TelegramUserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const currentUserId = useAppStore((s) => s.user.currentUser?.id);
  const isOwnProfile = userId === currentUserId;

  const [copied, setCopied] = useState(false);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => getUserDoc(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const { data: rank = 0 } = useQuery({
    queryKey: ['userRank', userId],
    queryFn: () => getUserRank(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const truncatedAddress = user?.wallet_address
    ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}`
    : null;

  function handleCopyAddress() {
    if (!user?.wallet_address) return;
    navigator.clipboard.writeText(user.wallet_address).then(() => {
      haptic?.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 animate-fade-in">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 pt-20 text-center animate-fade-in">
        <UserIcon size={48} style={{ color: 'var(--color-text-tertiary)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          User Not Found
        </h2>
        <Button onClick={() => goBack()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  const memberSince = user.created_at || user.createdAt;
  const memberDate = memberSince
    ? new Date(memberSince).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Profile hero */}
      <HeroCard className="p-5">
        <div className="flex flex-col items-center gap-3">
          <Avatar
            src={user.avatar_url ?? user.telegram_photo_url}
            fallback={user.name ?? 'User'}
            size="lg"
          />
          <div className="text-center">
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
              {user.name ?? 'Unknown'}
            </h1>
            {user.email && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {user.email}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {(user.points ?? 0) > 0 && (
              <Badge variant="primary" size="sm">
                <Star size={12} weight="fill" className="mr-1" />
                {(user.points ?? 0).toLocaleString()} pts
              </Badge>
            )}
            {rank > 0 && (
              <Badge variant="default" size="sm">
                <Trophy size={12} weight="fill" className="mr-1" />
                #{rank}
              </Badge>
            )}
            {memberDate && (
              <Badge variant="default" size="sm">
                <CalendarBlank size={12} className="mr-1" />
                {memberDate}
              </Badge>
            )}
          </div>
        </div>
      </HeroCard>

      {/* Wallet address */}
      {truncatedAddress && (
        <Card>
          <div className="flex items-center gap-3">
            <Wallet size={16} style={{ color: 'var(--color-text-tertiary)' }} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Wallet Address
              </span>
              <p className="text-sm font-mono" style={{ color: 'var(--color-text)' }}>
                {truncatedAddress}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="shrink-0 p-1 rounded transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              aria-label="Copy wallet address"
            >
              {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
            </button>
          </div>
        </Card>
      )}

      {/* Actions (not on own profile) */}
      {!isOwnProfile && user.wallet_address && (
        <div className="flex gap-3">
          <Link
            href={`/tg/send?to=${user.wallet_address}&name=${encodeURIComponent(user.name ?? 'User')}`}
            className="flex-1"
          >
            <Button fullWidth leftIcon={<PaperPlaneTilt size={16} weight="fill" />}>
              Send
            </Button>
          </Link>
          <Link
            href={`/tg/request`}
            className="flex-1"
          >
            <Button
              fullWidth
              variant="outline"
              leftIcon={<HandCoins size={16} weight="fill" />}
            >
              Request
            </Button>
          </Link>
        </div>
      )}

      {/* Own profile link to settings */}
      {isOwnProfile && (
        <Link href="/tg/settings">
          <Card className="flex items-center gap-3 p-4 transition-colors active:bg-white/[0.04]">
            <UserIcon size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>
              Edit Profile
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              &rsaquo;
            </span>
          </Card>
        </Link>
      )}
    </div>
  );
}
