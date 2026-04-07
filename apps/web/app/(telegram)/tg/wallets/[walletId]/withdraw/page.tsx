'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowUp, Wallet, Note, CheckCircle } from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { SuccessScreen } from '@/components/telegram/SuccessScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  useTelegramBackButton,
  useTelegramMainButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useSharedWalletDetail } from '@/hooks';
import { useAppStore } from '@/store';
import { createWithdrawalRequest } from '@/lib/firebase/queries';
import { formatCurrency, sanitizeAmountInput, dismissKeyboard } from '@/lib/utils';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import { WalletDetailSkeleton } from '@/components/telegram/TelegramSkeletons';

// ---------------------------------------------------------------------------
// Shared Wallet Withdraw — Creates a withdrawal request
// ---------------------------------------------------------------------------

export default function TelegramSharedWalletWithdrawPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { address: personalAddress } = useTgWallet();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userName = useAppStore((s) => s.user.currentUser?.name);

  const { wallet, isLoading } = useSharedWalletDetail(walletId);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(`/tg/wallets/${walletId}`), [goBack, walletId]),
  });

  const balance = wallet?.usdc_balance ?? wallet?.balance ?? 0;
  const numAmount = parseFloat(amount) || 0;
  const destination = personalAddress ?? '';
  const canSubmit =
    numAmount > 0 &&
    numAmount <= balance &&
    !!destination &&
    !!userId &&
    !submitting &&
    !submitted;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !userId || !wallet) return;
    setSubmitting(true);
    setError(null);
    try {
      await createWithdrawalRequest({
        walletId,
        requesterId: userId,
        requesterName: userName ?? 'Unknown',
        amount: numAmount,
        destinationAddress: destination,
        note: note.trim() || undefined,
      });
      haptic?.notificationOccurred('success');
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit request';
      setError(msg);
      haptic?.notificationOccurred('error');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, userId, wallet, walletId, userName, numAmount, destination, note, haptic]);

  // Telegram MainButton
  const brandColors = useTgBrandColors();

  useTelegramMainButton({
    text: submitting ? 'Submitting...' : `Request Withdrawal${numAmount > 0 ? ` $${numAmount.toFixed(2)}` : ''}`,
    onClick: handleSubmit,
    visible: canSubmit && !isLoading && !submitted,
    loading: submitting,
    disabled: !canSubmit,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  if (isLoading || !wallet) return <WalletDetailSkeleton />;

  // Success state
  if (submitted) {
    return (
      <SuccessScreen
        title="Request Submitted"
        message={`Your withdrawal request for ${formatCurrency(numAmount, 'USDC')} from "${wallet.name}" has been sent to the wallet admins for approval.`}
        onDone={() => goBack(`/tg/wallets/${walletId}`)}
        doneLabel="Back to Wallet"
        link={{ href: `/tg/wallets/${walletId}/withdrawals`, label: 'View Withdrawal Requests' }}
      />
    );
  }

  const truncatedDest = destination
    ? `${destination.slice(0, 6)}...${destination.slice(-4)}`
    : 'No wallet';

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Header */}
      <TgPageHeader
        icon={<ArrowUp size={20} weight="bold" color="var(--color-bg)" />}
        title="Withdraw"
        subtitle={`Request funds from "${wallet.name}"`}
      />

      {/* Error banner */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
        >
          {error}
        </div>
      )}

      {/* From — shared wallet */}
      <Card>
        <label className="block mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          From
        </label>
        <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--color-white-5)' }}>
          <Wallet size={18} style={{ color: 'var(--color-primary)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
              {wallet.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Balance: {formatCurrency(balance, 'USDC')}
            </p>
          </div>
        </div>
      </Card>

      {/* Amount */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Amount
        </label>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 font-medium"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-big-number)' }}
          >
            $
          </span>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { const v = sanitizeAmountInput(e.target.value); if (v !== null) setAmount(v); }}
            min={0}
            className="pl-8 font-medium"
            style={{ fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-big-number)' }}
          />
        </div>

        {numAmount > balance && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-error)' }}>
            Exceeds wallet balance
          </p>
        )}

        {/* Percentage buttons */}
        <div className="flex gap-2 mt-3">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                setAmount(((balance * pct) / 100).toFixed(2));
                haptic?.selectionChanged();
              }}
              className="flex-1 rounded-lg py-2 text-xs font-medium transition-all"
              style={{ backgroundColor: 'var(--color-white-10)', color: 'var(--color-text-secondary)' }}
            >
              {pct === 100 ? 'Max' : `${pct}%`}
            </button>
          ))}
        </div>
      </Card>

      {/* Destination (read-only — user's personal wallet) */}
      <Card>
        <label className="block mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          To (Your Personal Wallet)
        </label>
        <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--color-white-5)' }}>
          <Wallet size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <p className="text-sm font-mono" style={{ color: 'var(--color-text)' }}>
            {truncatedDest}
          </p>
        </div>
      </Card>

      {/* Note */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Note (optional)
        </label>
        <Input
          placeholder="Reason for withdrawal..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
        />
      </Card>

      {/* Info */}
      <div
        className="rounded-xl px-4 py-3"
        style={{ backgroundColor: 'var(--color-white-5)' }}
      >
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          This creates a withdrawal request that wallet admins will review.
          Once approved, funds will be sent to your personal wallet.
        </p>
      </div>

      {/* Fallback button */}
      {canSubmit && (
        <Button onClick={handleSubmit} loading={submitting} fullWidth className="tg-hide">
          Request Withdrawal
        </Button>
      )}
    </div>
  );
}
