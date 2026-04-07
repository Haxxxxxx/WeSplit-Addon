'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ArrowSquareOut, Copy } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { isDevnet } from '@/lib/transactions/transactionService';

// ---------------------------------------------------------------------------
// Send success page
// ---------------------------------------------------------------------------

export default function SendSuccessPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const amount = searchParams.get('amount') ?? '0';
  const currency = searchParams.get('currency') ?? 'USDC';
  const recipient = searchParams.get('recipient') ?? 'Unknown';
  const txId = searchParams.get('txId') ?? `${Date.now().toString(36).toUpperCase()}...${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const date = new Date().toLocaleString();
  const displayAmount = currency === 'USDC' ? `$${parseFloat(amount).toFixed(2)}` : `${parseFloat(amount).toFixed(4)} SOL`;
  const solscanUrl = `https://solscan.io/tx/${txId}${isDevnet() ? '?cluster=devnet' : ''}`;

  function copyTxId() {
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
              Sent successfully!
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your payment has been confirmed on Solana
            </p>
          </div>

          {/* Transaction details */}
          <Card className="w-full text-left">
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {[
                { label: 'Amount', value: displayAmount, highlight: true },
                { label: 'Currency', value: currency },
                { label: 'Recipient', value: recipient },
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

              {/* Tx ID with copy */}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Tx ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    {txId}
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
                </div>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex w-full flex-col gap-3">
            <Link href="/send" className="w-full">
              <Button variant="primary" fullWidth>Send Again</Button>
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
