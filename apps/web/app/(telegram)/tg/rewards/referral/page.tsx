'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UserPlus,
  Copy,
  Check,
  ShareNetwork,
  NumberCircleOne,
  NumberCircleTwo,
  NumberCircleThree,
} from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Button } from '@/components/ui/Button';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { ensureReferralCode, getUserReferralCount } from '@/lib/firebase/queries';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';

// ---------------------------------------------------------------------------
// How it works step
// ---------------------------------------------------------------------------

function Step({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={24} weight="fill" color="var(--color-primary)" className="shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {description}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Referral Page
// ---------------------------------------------------------------------------

export default function TelegramReferralPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const [copied, setCopied] = useState(false);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack('/tg/rewards'), [goBack]),
  });

  const { data: referralCode, isLoading: codeLoading, isError: codeError, refetch: refetchCode } = useQuery({
    queryKey: ['referralCode', userId],
    queryFn: () => ensureReferralCode(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  const { data: referralCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ['referralCount', userId],
    queryFn: () => getUserReferralCount(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const referralLink = referralCode
    ? `https://wesplit.io/referral?code=${referralCode}`
    : '';

  function copyCode() {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      haptic?.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareCode() {
    if (!referralCode) return;
    if (navigator.share) {
      navigator.share({
        title: 'Join WeSplit!',
        text: `Use my referral code ${referralCode} to join WeSplit and earn points!`,
        url: referralLink,
      });
    } else {
      copyCode();
    }
  }

  const handleRefresh = useCallback(async () => {
    await refetchCount();
  }, [refetchCount]);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<UserPlus size={20} weight="fill" color="var(--color-bg)" />}
        title="Invite Friends"
        subtitle="Earn rewards for every friend who joins"
      />

      {codeError && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
        >
          <span className="text-sm">Failed to load referral code</span>
          <Button size="sm" variant="ghost" onClick={() => refetchCode()}>Retry</Button>
        </div>
      )}

      {/* Score card */}
      <HeroCard className="p-5 text-center">
        <p
          className="text-xs uppercase tracking-widest mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Friends Referred
        </p>
        <p
          className="font-bold"
          style={{
            fontFamily: 'var(--font-family-number)',
            fontSize: 'var(--font-size-balance)',
            color: 'var(--color-text)',
          }}
        >
          {referralCount}
        </p>
      </HeroCard>

      {/* Referral code */}
      <Card>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Your Referral Code
        </p>
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 mb-3"
          style={{
            background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))',
          }}
        >
          <span
            className="text-lg font-bold tracking-widest"
            style={{ color: 'var(--color-bg)', fontFamily: 'var(--font-family-number)' }}
          >
            {codeLoading ? '...' : codeError ? '---' : referralCode}
          </span>
        </div>
        <div className="flex gap-3">
          <Button
            variant="primary"
            fullWidth
            onClick={copyCode}
            leftIcon={copied ? <Check size={18} weight="bold" /> : <Copy size={18} />}
            disabled={codeLoading}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button
            variant="secondary"
            onClick={shareCode}
            leftIcon={<ShareNetwork size={18} />}
            disabled={codeLoading}
          >
            Share
          </Button>
        </div>
      </Card>

      {/* How it works */}
      <Card>
        <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text)' }}>
          How It Works
        </h3>
        <div className="flex flex-col gap-4">
          <Step
            icon={NumberCircleOne}
            title="Share your code"
            description="Send your referral code or link to friends"
          />
          <Step
            icon={NumberCircleTwo}
            title="Friend joins WeSplit"
            description="They sign up using your referral code"
          />
          <Step
            icon={NumberCircleThree}
            title="Both earn points"
            description="You and your friend receive bonus points"
          />
        </div>
      </Card>
    </div>
    </PullToRefresh>
  );
}
