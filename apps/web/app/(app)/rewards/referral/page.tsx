'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, ShareNetwork, WhatsappLogo, TwitterLogo } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ensureReferralCode, getUserReferralCount } from '@/lib/firebase/queries';
import { useAppStore } from '@/store';
import { REFERRAL_BONUS_POINTS } from '@/lib/constants';

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;

  // Ensure referral code exists and fetch it
  const { data: referralCode, isLoading: codeLoading } = useQuery<string>({
    queryKey: ['referralCode', userId],
    queryFn: () => ensureReferralCode(userId!),
    enabled: !!userId,
  });

  // Fetch actual referral count
  const { data: referralCount = 0 } = useQuery<number>({
    queryKey: ['referralCount', userId],
    queryFn: () => getUserReferralCount(userId!),
    enabled: !!userId,
  });

  const totalPoints = currentUser?.points ?? 0;
  const pointsFromReferrals = referralCount * REFERRAL_BONUS_POINTS;
  const referralLink = referralCode ? `https://wesplit.io/join?ref=${referralCode}` : '';

  const referralStats = [
    { label: 'Total Referrals',   value: referralCount.toString(),                highlight: false },
    { label: 'Points Earned',     value: pointsFromReferrals.toLocaleString(),    highlight: true },
    { label: 'Your Points',       value: totalPoints.toLocaleString(),            highlight: false },
  ];

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function share(platform: 'twitter' | 'whatsapp' | 'native') {
    const msg = `Join me on WeSplit — decentralized payments on Solana! Use my referral link: ${referralLink}`;
    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`);
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    } else if (navigator.share) {
      navigator.share({ title: 'Join WeSplit', text: msg, url: referralLink });
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/rewards" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back to Rewards
        </Link>
      </div>

      <div className="flex flex-col gap-6 max-w-md">
        {/* Hero */}
        <div
          className="rounded-[var(--radius-2xl)] p-6 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }}
        >
          <p className="text-4xl mb-3">🎁</p>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-bg)' }}>Refer &amp; Earn</h1>
          <p className="text-sm" style={{ color: 'rgba(6,17,19,0.7)' }}>
            Share WeSplit with friends and earn <strong>{REFERRAL_BONUS_POINTS} points</strong> for every person who signs up.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {referralStats.map(({ label, value, highlight }) => (
            <Card key={label} padding="sm" className="text-center">
              <p
                className="text-2xl font-semibold"
                style={{ fontFamily: 'var(--font-family-number)', color: highlight ? 'var(--color-primary)' : 'var(--color-text)' }}
              >
                {value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
            </Card>
          ))}
        </div>

        {/* Referral code */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Your Referral Code</h3>
          {codeLoading ? (
            <Skeleton width="100%" height={48} radius="lg" />
          ) : referralCode ? (
            <div
              className="flex items-center justify-between rounded-[var(--radius-lg)] px-4 py-3"
              style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-border)' }}
            >
              <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)', letterSpacing: '0.1em' }}>
                {referralCode}
              </span>
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                style={{ backgroundColor: 'var(--color-primary-dim)', color: 'var(--color-primary)' }}
              >
                {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sign in to get your referral code</p>
          )}
        </Card>

        {/* Share buttons */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Share via</h3>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => share('twitter')}
              leftIcon={<TwitterLogo size={18} weight="fill" />}
              disabled={!referralCode}
            >
              Share on Twitter
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => share('whatsapp')}
              leftIcon={<WhatsappLogo size={18} weight="fill" />}
              disabled={!referralCode}
            >
              Share on WhatsApp
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={() => share('native')}
              leftIcon={<ShareNetwork size={18} weight="fill" />}
              disabled={!referralCode}
            >
              More Options
            </Button>
          </div>
        </Card>

        {/* Terms */}
        <p className="text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Points are credited once your referral completes their first transaction.
          Maximum 50 referrals per account.
        </p>
      </div>
    </PageContainer>
  );
}
