'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, Copy } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate, formatAddress } from '@/lib/utils';
import { getTransactionById } from '@/lib/firebase/queries';
import { useToast } from '@/components/ui/Toast';
import { useAppStore } from '@/store';

export default function TransactionDetailPage({ params }: { params: Promise<{ txId: string }> }) {
  const { txId } = use(params);
  const { toast } = useToast();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const { data: tx, isLoading } = useQuery({
    queryKey: ['transaction', txId],
    queryFn: () => getTransactionById(txId!),
    enabled: !!txId,
  });

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', variant: 'info' });
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href="/transactions" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back to Transactions
          </Link>
        </div>
        <div className="flex flex-col gap-5 max-w-lg">
          <div className="flex flex-col items-center gap-3 py-6">
            <Skeleton width={80} height={24} radius="full" />
            <Skeleton width={160} height={48} radius="sm" />
            <Skeleton width={120} height={16} radius="sm" />
          </div>
          <Card>
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between py-3">
                  <Skeleton width={80} height={14} radius="sm" />
                  <Skeleton width={120} height={14} radius="sm" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (!tx) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href="/transactions" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back to Transactions
          </Link>
        </div>
        <Card>
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Transaction not found</p>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const isSend = tx.from_user === userId;
  const label = isSend
    ? tx.recipient_name ? `Sent to ${tx.recipient_name}` : 'Sent'
    : tx.sender_name ? `Received from ${tx.sender_name}` : 'Received';

  const solscanUrl = tx.blockchain_network === 'devnet'
    ? `https://solscan.io/tx/${tx.tx_hash}?cluster=devnet`
    : `https://solscan.io/tx/${tx.tx_hash}`;

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/transactions" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back to Transactions
        </Link>
      </div>

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Amount hero */}
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Badge
            variant={tx.status === 'completed' ? 'success' : tx.status === 'failed' ? 'error' : 'warning'}
            size="md"
            dot
          >
            {tx.status}
          </Badge>
          <p
            className="font-semibold"
            style={{
              fontFamily: 'var(--font-family-number)',
              fontSize: 'var(--font-size-balance)',
              color: isSend ? 'var(--color-error)' : 'var(--color-success)',
            }}
          >
            {isSend ? '-' : '+'}{formatCurrency(tx.amount, (tx.currency as 'USDC' | 'SOL') || 'USDC')}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
        </div>

        {/* Transaction details */}
        <Card>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between py-3 first:pt-0">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Date</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {formatDate(tx.created_at, { format: 'long' })}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Type</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{tx.type}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Currency</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{tx.currency}</span>
            </div>
            {tx.gas_fee !== undefined && (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Network fee</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{tx.gas_fee} SOL</span>
              </div>
            )}
            {tx.block_height !== undefined && (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Block</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{tx.block_height.toLocaleString()}</span>
              </div>
            )}

            {/* From address */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>From</span>
              <div className="flex flex-col items-end gap-1">
                {tx.sender_name && (
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{tx.sender_name}</span>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formatAddress(tx.from_wallet, { chars: 6 })}
                  </span>
                  <button type="button" onClick={() => copy(tx.from_wallet)} className="transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* To address */}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>To</span>
              <div className="flex flex-col items-end gap-1">
                {tx.recipient_name && (
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{tx.recipient_name}</span>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formatAddress(tx.to_wallet, { chars: 6 })}
                  </span>
                  <button type="button" onClick={() => copy(tx.to_wallet)} className="transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Note */}
            {tx.note && (
              <div className="flex items-start justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Note</span>
                <span className="text-sm text-right max-w-[60%]" style={{ color: 'var(--color-text)' }}>{tx.note}</span>
              </div>
            )}

            {/* Signature */}
            <div className="flex items-center justify-between py-3 last:pb-0">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Signature</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatAddress(tx.tx_hash, { chars: 6 })}
                </span>
                <button type="button" onClick={() => copy(tx.tx_hash)} className="transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
                  <Copy size={12} />
                </button>
                <a href={solscanUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
                  <ArrowSquareOut size={12} />
                </a>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
