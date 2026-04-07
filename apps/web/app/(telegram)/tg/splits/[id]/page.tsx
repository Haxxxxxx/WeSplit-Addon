'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { PublicKey } from '@solana/web3.js';
import {
  Clock,
  CheckCircle,
  XCircle,
  Receipt,
  Users,
  CalendarBlank,
  ArrowLeft,
  Storefront,
  PaperPlaneTilt,
  X,
} from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate, formatAddress } from '@/lib/utils';
import { PinPrompt } from '@/components/telegram/PinPrompt';
import { TransactionErrorBanner } from '@/components/telegram/TransactionErrorBanner';
import { usePinFlow } from '@/hooks/telegram/usePinFlow';
import {
  useTelegramBackButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useAppStore } from '@/store';
import { createConnection } from '@/lib/solana';
import { sendUSDC } from '@/lib/transactions/transactionService';
import {
  useSplitDetail,
  useSplitWallets,
  useCurrentUserSplitParticipant,
  useIsSplitCreator,
  useRecordSplitPayment,
} from '@/hooks';
import type { SplitStatus, SplitStorageStatus } from '@/types';

// ---------------------------------------------------------------------------
// Status configs
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<SplitStatus, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     variant: 'default', icon: Clock },
  pending:   { label: 'Pending',   variant: 'warning', icon: Clock },
  active:    { label: 'Active',    variant: 'info',    icon: Receipt },
  locked:    { label: 'Locked',    variant: 'orange',  icon: Clock },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'error',   icon: XCircle },
};

const PARTICIPANT_STATUS_CONFIG: Record<SplitStorageStatus, { label: string; variant: BadgeVariant }> = {
  pending:  { label: 'Pending',  variant: 'default' },
  invited:  { label: 'Invited',  variant: 'info' },
  accepted: { label: 'Accepted', variant: 'info' },
  declined: { label: 'Declined', variant: 'error' },
  paid:     { label: 'Paid',     variant: 'success' },
  locked:   { label: 'Locked',   variant: 'orange' },
};

function getStatusConfig(status: SplitStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

function getParticipantStatusConfig(status: SplitStorageStatus) {
  return PARTICIPANT_STATUS_CONFIG[status] ?? PARTICIPANT_STATUS_CONFIG.pending;
}

// ---------------------------------------------------------------------------
// Category emoji + color
// ---------------------------------------------------------------------------

const CATEGORY_EMOJI: Record<string, string> = {
  trip: '✈️', food: '🍔', home: '🏠', event: '🎉', rocket: '🚀',
};

function getCategoryEmoji(c?: string): string {
  return (c && CATEGORY_EMOJI[c]) ?? '💸';
}

const PALETTE = [
  'var(--color-wallet-purple)',
  'var(--color-wallet-green)',
  'var(--color-wallet-orange)',
  'var(--color-wallet-blue)',
  'var(--color-wallet-red)',
  'var(--color-wallet-teal)',
];

function colorFromName(name: string | undefined): string {
  const s = name || 'x';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length] ?? 'var(--color-wallet-purple)';
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-24">
      <Skeleton width={120} height={18} radius="sm" />
      <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-start gap-3 mb-4">
          <Skeleton width={48} height={48} radius="xl" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton height={18} width="60%" radius="sm" />
            <Skeleton height={12} width="40%" radius="sm" />
          </div>
        </div>
        <Skeleton height={40} radius="lg" className="mb-3" />
        <div className="flex gap-2">
          <Skeleton height={36} width={110} radius="lg" />
          <Skeleton height={36} width={80} radius="lg" />
        </div>
      </div>
      <Card>
        <SkeletonText lines={4} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TgSplitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userName = useAppStore((s) => s.user.currentUser?.name);

  // Wallet (TG local keypair)
  const {
    address: walletAddress,
    hasWallet,
    usdcBalance,
    sign,
    getPinHint,
    refetchBalance,
  } = useTgWallet();

  // Split data
  const { split, isLoading: splitLoading, error: splitError } = useSplitDetail(id);
  const { wallets } = useSplitWallets();

  // Mutations
  const recordPayment = useRecordSplitPayment();

  // Computed
  const isCreator = useIsSplitCreator(split);
  const myParticipant = useCurrentUserSplitParticipant(split);

  // Find the split wallet corresponding to this split's billId
  const splitWallet = wallets.find(
    (w) => w.billId === split?.billId || w.id === split?.billId,
  );

  // UI state
  const [paidSuccess, setPaidSuccess] = useState(false);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // ---- Computed flags ----

  const amountOwed = myParticipant?.amountOwed ?? 0;
  const amountPaid = myParticipant?.amountPaid ?? 0;
  const remaining  = Math.max(0, amountOwed - amountPaid);
  const alreadyPaid = myParticipant?.status === 'paid';
  const splitActive = split?.status === 'active' || split?.status === 'pending';

  const canPay =
    !!myParticipant &&
    !alreadyPaid &&
    splitActive &&
    hasWallet &&
    !!walletAddress &&
    remaining > 0 &&
    usdcBalance >= remaining;

  const pin = usePinFlow(canPay, { haptic });

  // ---- Payment flow ----

  const handlePinConfirm = useCallback(
    async (pinValue: string) => {
      if (!walletAddress || !splitWallet?.walletAddress) return;

      pin.startSending();

      try {
        const connection = createConnection();
        const fromPubkey = new PublicKey(walletAddress);

        const txSig = await sendUSDC({
          connection,
          fromPubkey,
          toAddress: splitWallet.walletAddress,
          amountUsdc: remaining,
          signTransaction: (tx) => sign(tx, pinValue),
          note: `Split payment: ${split?.title}`,
          senderName: userName ?? undefined,
          senderUid: userId ?? undefined,
        });

        // Record payment in Firestore
        await recordPayment.mutateAsync({
          splitWalletId: splitWallet.id,
          amount: remaining,
          transactionSignature: typeof txSig === 'string' ? txSig : '',
        });

        pin.onSuccess();
        setPaidSuccess(true);
        refetchBalance();
      } catch (err: unknown) {
        pin.onError(err);
      } finally {
        pin.stopSending();
      }
    },
    [walletAddress, splitWallet, remaining, split?.title, sign, userName, userId, recordPayment, refetchBalance, pin],
  );

  // ---- Render ----

  if (splitLoading) return <DetailSkeleton />;

  if (splitError || !split) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-24">
        <Link href="/tg/splits" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} />
          Back to Splits
        </Link>
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="text-3xl">⚠️</div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Split not found</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              This split may have been deleted or you don&apos;t have access.
            </p>
            <Link href="/tg/splits">
              <Button size="sm" variant="secondary">Back to Splits</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { label, variant, icon: StatusIcon } = getStatusConfig(split.status);
  const color   = colorFromName(split.title);
  const emoji   = getCategoryEmoji(split.category);

  // Progress
  const paidCount   = split.participants.filter((p) => p.status === 'paid').length;
  const totalPartic = split.participants.length;
  const progress    = totalPartic > 0 ? (paidCount / totalPartic) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-24 animate-fade-in">
      {/* Back */}
      <Link
        href="/tg/splits"
        className="flex items-center gap-1.5 text-sm w-fit"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <ArrowLeft size={16} />
        Splits
      </Link>

      {/* Hero card */}
      <HeroCard className="p-5 relative overflow-hidden">
        <div
          className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />

        <div className="flex items-start gap-3 mb-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `${color}22`, border: `1px solid ${color}44` }}
          >
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-display)' }}>
              {split.title}
            </h1>
            <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              <CalendarBlank size={12} />
              <span>{formatDate(split.createdAt, { format: 'short' })}</span>
              {split.merchant?.name && (
                <>
                  <Storefront size={12} />
                  <span className="truncate">{split.merchant.name}</span>
                </>
              )}
            </div>
          </div>
          <Badge variant={variant} size="sm">
            <StatusIcon size={10} weight="bold" />
            {label}
          </Badge>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Total Amount
          </p>
          <p
            className="text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
          >
            {formatCurrency(split.totalAmount, split.currency as 'USDC')}
          </p>
        </div>

        {/* Progress bar */}
        {(split.status === 'active' || split.status === 'pending') && totalPartic > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>{paidCount} of {totalPartic} paid</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-white-10)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress}%`,
                  background: progress === 100
                    ? 'var(--color-success)'
                    : 'linear-gradient(90deg, var(--color-gradient-start), var(--color-gradient-end))',
                }}
              />
            </div>
          </div>
        )}

        {/* My share + Pay CTA */}
        {myParticipant && (
          <div
            className="rounded-xl p-3 flex items-center justify-between"
            style={{ backgroundColor: 'var(--color-white-5)' }}
          >
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {alreadyPaid || paidSuccess ? 'Your share' : 'You owe'}
              </p>
              <p
                className="text-lg font-semibold"
                style={{
                  fontFamily: 'var(--font-family-number)',
                  color: alreadyPaid || paidSuccess ? 'var(--color-success)' : 'var(--color-text)',
                }}
              >
                {formatCurrency(amountOwed, split.currency as 'USDC')}
              </p>
            </div>

            {paidSuccess || alreadyPaid ? (
              <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--color-success)' }}>
                <CheckCircle size={18} weight="fill" />
                Paid
              </div>
            ) : canPay ? (
              <Button
                size="sm"
                onClick={pin.openPinPrompt}
                loading={pin.sending}
                leftIcon={<PaperPlaneTilt size={15} weight="bold" />}
              >
                Pay {formatCurrency(remaining, split.currency as 'USDC')}
              </Button>
            ) : !hasWallet ? (
              <Link href="/tg/wallet/setup">
                <Button size="sm" variant="secondary">Set Up Wallet</Button>
              </Link>
            ) : usdcBalance < remaining ? (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                Insufficient balance
              </p>
            ) : null}
          </div>
        )}

        {/* Creator badge */}
        {isCreator && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            You created this split
          </p>
        )}
      </HeroCard>

      {/* TX error */}
      {pin.txError && <TransactionErrorBanner error={pin.txError} onRetry={pin.openPinPrompt} />}

      {/* Participants */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Participants ({totalPartic})
          </h2>
        </div>

        <div
          className="flex flex-col divide-y"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {split.participants.map((p) => {
            const { label: pLabel, variant: pVariant } = getParticipantStatusConfig(p.status);
            const isMe = p.userId === userId;
            const pPaid = p.amountPaid ?? 0;
            const pOwed = p.amountOwed ?? 0;

            return (
              <div key={p.userId} className="flex items-center gap-3 py-2.5">
                <Avatar fallback={p.name} src={p.avatar} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {p.name}
                    </span>
                    {isMe && (
                      <Badge variant="primary" size="sm">You</Badge>
                    )}
                  </div>
                  {p.walletAddress && (
                    <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                      {formatAddress(p.walletAddress)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className="text-sm font-semibold"
                    style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
                  >
                    {formatCurrency(pOwed, split.currency as 'USDC')}
                  </span>
                  <Badge variant={pVariant} size="sm">{pLabel}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Split wallet address (for reference) */}
      {splitWallet?.walletAddress && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            Split Wallet
          </p>
          <p className="text-xs font-mono break-all" style={{ color: 'var(--color-text-secondary)' }}>
            {splitWallet.walletAddress}
          </p>
        </Card>
      )}

      {/* Description */}
      {split.description && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Description
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {split.description}
          </p>
        </Card>
      )}

      {/* PIN prompt */}
      <PinPrompt
        open={pin.showPin}
        onConfirm={handlePinConfirm}
        onCancel={pin.cancelPin}
        loading={pin.sending}
        error={pin.pinError}
        title="Pay Your Share"
        description={`Enter your wallet PIN to pay ${formatCurrency(remaining, split.currency as 'USDC')} into the split.`}
        getPinHint={getPinHint}
      />
    </div>
  );
}
