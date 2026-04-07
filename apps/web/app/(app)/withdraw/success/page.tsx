'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ArrowSquareOut, Copy } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { isDevnet } from '@/lib/transactions/transactionService';

// ---------------------------------------------------------------------------
// Withdraw success page
// ---------------------------------------------------------------------------

export default function WithdrawSuccessPage() {
  return (
    <Suspense fallback={<PageContainer><Skeleton width="100%" height={400} radius="lg" /></PageContainer>}>
      <WithdrawSuccessInner />
    </Suspense>
  );
}

function WithdrawSuccessInner() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const amount = searchParams.get('amount') ?? '0';
  const currency = searchParams.get('currency') ?? 'USDC';
  const destination = searchParams.get('destination') ?? 'Unknown';
  const txId = searchParams.get('txId') ?? '';
  const date = new Date().toLocaleString();

  const displayAmount =
    currency === 'USDC'
      ? `$${parseFloat(amount).toFixed(2)} USDC`
      : `${parseFloat(amount).toFixed(4)} SOL`;

  const shortDest =
    destination.length > 20
      ? `${destination.slice(0, 6)}...${destination.slice(-6)}`
      : destination;

  const solscanUrl = txId
    ? `https://solscan.io/tx/${txId}${isDevnet() ? '?cluster=devnet' : ''}`
    : null;

  function copyTxId() {
    if (!txId) return;
    navigator.clipboard.writeText(txId).then(() => {
      toast({ title: 'Copied!', description: 'Transaction ID copied to clipboard', variant: 'success', duration: 2000 });
    }).catch(() => {});
  }

  return (
    <PageContainer>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
          {/* Success icon */}
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }}
          >
            <CheckCircle size={48} weight="fill" color="var(--color-bg)" />
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Withdrawal complete!
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your funds have been sent to the destination wallet
            </p>
          </div>

          {/* Transaction details */}
          <Card className="w-full text-left">
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {[
                { label: 'Amount', value: displayAmount, highlight: true },
                { label: 'Asset', value: currency },
                { label: 'To', value: shortDest },
                { label: 'Date', value: date },
                { label: 'Status', value: <Badge variant="success" dot>Confirmed</Badge> },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                  {typeof value === 'string' ? (
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: highlight ? 'var(--color-success)' : 'var(--color-text)',
                        fontFamily: highlight ? 'var(--font-family-number)' : undefined,
                      }}
                    >
                      {value}
                    </span>
                  ) : (
                    value
                  )}
                </div>
              ))}

              {/* Tx ID with copy + Solscan link */}
              {txId && (
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Tx ID</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {txId.slice(0, 8)}...{txId.slice(-6)}
                    </span>
                    <button
                      type="button"
                      onClick={copyTxId}
                      className="rounded p-0.5 transition-colors hover:text-[var(--color-primary)]"
                      style={{ color: 'var(--color-text-secondary)' }}
                      aria-label="Copy transaction ID"
                    >
                      <Copy size={14} />
                    </button>
                    {solscanUrl && (
                      <a
                        href={solscanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-0.5 transition-colors hover:text-[var(--color-primary)]"
                        style={{ color: 'var(--color-text-secondary)' }}
                        aria-label="View on Solscan"
                      >
                        <ArrowSquareOut size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex w-full flex-col gap-3">
            <Link href="/withdraw" className="w-full">
              <Button variant="primary" fullWidth>Withdraw Again</Button>
            </Link>
            <Link href="/dashboard" className="w-full">
              <Button variant="ghost" fullWidth>Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
