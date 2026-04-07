'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  ArrowSquareOut,
  ShareNetwork,
  Clock,
  Hash,
  Wallet,
  CurrencyDollar,
  Note,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { getTransactionById } from '@/lib/firebase/queries';
import { formatCurrency, formatDate, toDate } from '@/lib/utils';
import { isDevnet } from '@/lib/transactions/transactionService';
import { TransactionsSkeleton } from '@/components/telegram/TelegramSkeletons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getSolscanUrl(txHash: string): string {
  const cluster = isDevnet() ? '?cluster=devnet' : '';
  return `https://solscan.io/tx/${txHash}${cluster}`;
}

// ---------------------------------------------------------------------------
// Detail row
// ---------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
  value,
  copyable,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const haptic = useTelegramHaptic();

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      haptic?.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-start gap-3 py-3">
      <Icon size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {label}
        </span>
        <span
          className={`text-sm break-all ${mono ? 'font-mono' : ''}`}
          style={{ color: 'var(--color-text)' }}
        >
          {value}
        </span>
      </div>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 mt-3 p-1 rounded transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TelegramTransactionDetailPage() {
  const params = useParams<{ txId: string }>();
  const txId = params.txId;
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const { data: tx, isLoading } = useQuery({
    queryKey: ['transaction', txId],
    queryFn: () => getTransactionById(txId),
    enabled: !!txId,
    staleTime: 60_000,
  });

  if (isLoading) return <TransactionsSkeleton />;

  if (!tx) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 pt-20 text-center animate-fade-in">
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          Transaction Not Found
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          This transaction may have been removed or the ID is invalid.
        </p>
        <Button onClick={() => goBack()} variant="outline">
          Back
        </Button>
      </div>
    );
  }

  const isSend = tx.from_user === userId;
  const statusColor =
    tx.status === 'completed'
      ? 'var(--color-success)'
      : tx.status === 'failed'
      ? 'var(--color-error)'
      : 'var(--color-warning)';

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Hero */}
      <div className="flex flex-col items-center gap-3 pt-4 pb-2">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: isSend ? 'var(--color-error-20)' : 'var(--color-success-20)' }}
        >
          {isSend ? (
            <ArrowUpRight size={28} weight="bold" color="var(--color-error)" />
          ) : (
            <ArrowDownLeft size={28} weight="bold" color="var(--color-success)" />
          )}
        </div>
        <div className="text-center">
          <p
            className="text-2xl font-bold"
            style={{
              color: isSend ? 'var(--color-error)' : 'var(--color-success)',
              fontFamily: 'var(--font-family-number)',
            }}
          >
            {isSend ? '-' : '+'}
            {formatCurrency(tx.amount, (tx.currency as 'USD' | 'USDC' | 'SOL') || 'USDC')}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {isSend ? 'Sent' : 'Received'} {tx.currency || 'USDC'}
          </p>
        </div>
        <Badge
          variant={tx.status === 'completed' ? 'success' : tx.status === 'failed' ? 'error' : 'warning'}
          size="md"
        >
          {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
        </Badge>
      </div>

      {/* Details */}
      <Card>
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <DetailRow
            icon={Clock}
            label="Date"
            value={formatDate(toDate(tx.created_at), { format: 'long' })}
          />

          {tx.sender_name && (
            <DetailRow icon={Wallet} label="From" value={tx.sender_name} />
          )}
          <DetailRow
            icon={Wallet}
            label="From Wallet"
            value={truncateAddress(tx.from_wallet)}
            copyable
            mono
          />

          {tx.recipient_name && (
            <DetailRow icon={Wallet} label="To" value={tx.recipient_name} />
          )}
          <DetailRow
            icon={Wallet}
            label="To Wallet"
            value={truncateAddress(tx.to_wallet)}
            copyable
            mono
          />

          <DetailRow
            icon={CurrencyDollar}
            label="Amount"
            value={`${tx.amount} ${tx.currency || 'USDC'}`}
          />

          {tx.gas_fee !== undefined && tx.gas_fee !== null && (
            <DetailRow
              icon={CurrencyDollar}
              label="Network Fee"
              value={`${tx.gas_fee} SOL`}
            />
          )}

          {tx.note && (
            <DetailRow icon={Note} label="Note" value={tx.note} />
          )}

          {tx.tx_hash && (
            <DetailRow
              icon={Hash}
              label="Transaction Hash"
              value={truncateAddress(tx.tx_hash)}
              copyable
              mono
            />
          )}

          {tx.blockchain_network && (
            <DetailRow
              icon={Hash}
              label="Network"
              value={tx.blockchain_network}
            />
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {tx.tx_hash && (
          <Button
            variant="outline"
            fullWidth
            onClick={() => window.open(getSolscanUrl(tx.tx_hash), '_blank')}
            leftIcon={<ArrowSquareOut size={16} />}
          >
            View on Solscan
          </Button>
        )}
        <Button
          variant="ghost"
          fullWidth
          leftIcon={<ShareNetwork size={16} />}
          onClick={() => {
            const lines = [
              `${isSend ? 'Sent' : 'Received'} ${formatCurrency(tx.amount, (tx.currency as 'USD' | 'USDC' | 'SOL') || 'USDC')} ${tx.currency || 'USDC'}`,
              tx.sender_name ? `From: ${tx.sender_name}` : '',
              tx.recipient_name ? `To: ${tx.recipient_name}` : '',
              `Date: ${formatDate(toDate(tx.created_at), { format: 'long' })}`,
              `Status: ${tx.status}`,
              tx.tx_hash ? `Explorer: ${getSolscanUrl(tx.tx_hash)}` : '',
              '',
              'Sent via WeSplit',
            ].filter(Boolean).join('\n');

            haptic?.impactOccurred('light');

            const webApp = typeof window !== 'undefined'
              ? window.Telegram
              : undefined;

            if (webApp?.WebApp?.openTelegramLink) {
              const encoded = encodeURIComponent(lines);
              webApp.WebApp.openTelegramLink(`https://t.me/share/url?url=${encoded}&text=`);
            } else if (navigator.share) {
              navigator.share({ text: lines }).catch(() => {});
            } else {
              navigator.clipboard.writeText(lines);
              haptic?.notificationOccurred('success');
            }
          }}
        >
          Share Receipt
        </Button>
      </div>
    </div>
  );
}
