'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Eye,
  EyeSlash,
  CopySimple,
  Check,
  PaperPlaneTilt,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  QrCode,
} from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { formatCurrency, formatDate, toDate } from '@/lib/utils';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useAppStore } from '@/store';
import { useTransactions, useUserBalance } from '@/hooks';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import type { Transaction } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTxLabel(tx: Transaction, userId?: string): string {
  const isOutgoing = tx.from_user === userId;
  if (tx.type === 'deposit') return 'Deposit';
  if (tx.type === 'withdraw') return 'Withdrawal';
  if (isOutgoing) return tx.recipient_name ? `Sent to ${tx.recipient_name}` : 'Sent';
  return tx.sender_name ? `From ${tx.sender_name}` : 'Received';
}

// ---------------------------------------------------------------------------
// Quick action pill
// ---------------------------------------------------------------------------

function QuickAction({
  icon: Icon,
  label,
  href,
  primary,
  onTouchStart,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  primary?: boolean;
  onTouchStart?: () => void;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5" onTouchStart={onTouchStart}>
      <div
        className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform active:scale-90"
        style={
          primary
            ? { background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }
            : { backgroundColor: 'var(--color-white-10)' }
        }
      >
        <Icon
          size={20}
          weight={primary ? 'fill' : 'regular'}
          color={primary ? 'var(--color-bg)' : 'var(--color-text)'}
        />
      </div>
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------

function TxRow({ tx, userId }: { tx: Transaction; userId?: string }) {
  const isOutgoing = tx.from_user === userId;
  return (
    <Link
      href={`/tg/transactions/${tx.id}`}
      className="flex items-center gap-3 py-2.5 transition-colors active:bg-white/[0.04]"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: isOutgoing ? 'var(--color-error-20)' : 'var(--color-success-20)' }}
      >
        {isOutgoing ? (
          <ArrowUpRight size={16} weight="bold" color="var(--color-error)" />
        ) : (
          <ArrowDownLeft size={16} weight="bold" color="var(--color-success)" />
        )}
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <span className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
          {getTxLabel(tx, userId)}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {formatDate(toDate(tx.created_at), { format: 'relative' })}
        </span>
      </div>
      <span
        className="text-sm font-medium"
        style={{
          color: isOutgoing ? 'var(--color-error)' : 'var(--color-success)',
          fontFamily: 'var(--font-family-number)',
        }}
      >
        {isOutgoing ? '-' : '+'}
        {formatCurrency(tx.amount, 'USDC')}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TelegramWalletDetailsPage() {
  const { goBack, prefetchData } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { address, hasWallet } = useTgWallet();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const { usdc, isLoading: balanceLoading, refetch: refetchBalance } = useUserBalance();
  const { transactions, isLoading: txLoading, refetch: refetchTx } = useTransactions(5);

  const [balanceVisible, setBalanceVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const handleCopy = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      haptic?.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [address, haptic]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchBalance(), refetchTx()]);
  }, [refetchBalance, refetchTx]);

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'Not connected';

  const loading = balanceLoading || txLoading;

  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 animate-fade-in">
        <div className="h-8 w-40 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
        <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
        <div className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
        {/* Wallet hero card */}
        <HeroCard className="p-5">
          {/* Name + eye toggle */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              WeSplit Wallet
            </p>
            <button
              type="button"
              onClick={() => setBalanceVisible((v) => !v)}
              className="p-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {balanceVisible ? <Eye size={16} /> : <EyeSlash size={16} />}
            </button>
          </div>

          {/* Balance */}
          <p
            className="font-semibold leading-none mb-3"
            style={{
              fontFamily: 'var(--font-family-number)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-balance)',
            }}
          >
            {balanceVisible ? formatCurrency(usdc, 'USDC') : '******'}
          </p>

          {/* Address */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span className="text-xs font-mono">{truncatedAddress}</span>
            {copied ? <Check size={12} weight="bold" /> : <CopySimple size={12} />}
          </button>
        </HeroCard>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3 py-1">
          <QuickAction icon={PaperPlaneTilt} label="Send" href="/tg/send" primary onTouchStart={() => prefetchData('/tg/send')} />
          <QuickAction icon={QrCode} label="Receive" href="/tg/receive" />
          <QuickAction icon={ArrowDown} label="Deposit" href="/tg/deposit" />
          <QuickAction icon={ArrowUp} label="Withdraw" href="/tg/withdraw" />
        </div>

        {/* Security link */}
        <Link href="/tg/settings/security">
          <Card className="flex items-center gap-3 p-4 transition-colors active:bg-white/[0.04]">
            <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>
              Security &amp; Keys
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>&rsaquo;</span>
          </Card>
        </Link>

        {/* Recent transactions */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
              Recent Activity
            </h2>
            {transactions.length > 0 && (
              <Link
                href="/tg/transactions"
                className="text-xs font-medium"
                style={{ color: 'var(--color-primary)' }}
              >
                See all
              </Link>
            )}
          </div>
          {transactions.length > 0 ? (
            <div
              className="flex flex-col divide-y"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {transactions.map((tx) => (
                <TxRow key={tx.id} tx={tx} userId={userId} />
              ))}
            </div>
          ) : (
            <p
              className="py-4 text-center text-sm"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              No transactions yet
            </p>
          )}
        </Card>
      </div>
    </PullToRefresh>
  );
}
