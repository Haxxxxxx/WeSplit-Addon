'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getSharedWalletTransactions, getUserDoc } from '@/lib/firebase/queries';

export default function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ walletId: string; expenseId: string }>;
}) {
  const { walletId, expenseId } = use(params);

  // Fetch shared wallet transactions
  const { data: transactions = [], isLoading, error } = useQuery({
    queryKey: ['sharedWalletTransactions', walletId],
    queryFn: () => getSharedWalletTransactions(walletId),
    enabled: !!walletId,
  });

  // Find the specific transaction matching expenseId
  const transaction = transactions.find((tx) => tx.id === expenseId);

  // Fetch initiator details if transaction exists
  const { data: initiator } = useQuery({
    queryKey: ['user', transaction?.initiated_by],
    queryFn: () => getUserDoc(transaction!.initiated_by),
    enabled: !!transaction?.initiated_by,
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <div className="flex flex-col gap-5 max-w-lg">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="h-10 w-24 rounded bg-white/10 animate-pulse" />
          </div>
          <Card>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between py-3">
                  <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 w-16 rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (error || !transaction) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <Card>
          <div className="text-center py-8">
            <p className="text-sm mb-2" style={{ color: 'var(--color-text)' }}>
              Transaction not found
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              This transaction may have been removed or you may not have access to it.
            </p>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const createdDate = transaction.created_at ? new Date(transaction.created_at) : new Date();
  const initiatorName = initiator?.name || 'Unknown User';
  const statusVariant =
    transaction.status === 'confirmed' ? 'success'
    : transaction.status === 'failed' ? 'error'
    : 'warning';

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                {transaction.type === 'deposit'
                  ? 'Deposit'
                  : transaction.type === 'withdrawal'
                  ? 'Withdrawal'
                  : transaction.type === 'transfer'
                  ? 'Transfer'
                  : 'Transaction'}
              </h1>
              <Badge variant={statusVariant} size="md">{transaction.status}</Badge>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {transaction.type === 'deposit' ? 'Deposited' : 'Initiated'} by {initiatorName} · {formatDate(createdDate, { format: 'relative' })}
            </p>
          </div>
          <p
            className="text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
          >
            {formatCurrency(transaction.amount, transaction.currency as 'USDC' | 'SOL')}
          </p>
        </div>

        {/* Details */}
        <Card>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Type</span>
              <span className="text-sm font-semibold capitalize" style={{ color: 'var(--color-text)' }}>
                {transaction.type}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Amount</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
                {formatCurrency(transaction.amount, transaction.currency as 'USDC' | 'SOL')}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Status</span>
              <Badge variant={statusVariant} size="sm">{transaction.status}</Badge>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Initiated by</span>
              <div className="flex items-center gap-2">
                <Avatar fallback={initiatorName} size="xs" />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{initiatorName}</span>
              </div>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Date</span>
              <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                {formatDate(createdDate, { format: 'long' })}
              </span>
            </div>
            {transaction.note && (
              <div className="flex justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Note</span>
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{transaction.note}</span>
              </div>
            )}
            {transaction.tx_hash && (
              <div className="flex justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Transaction Hash</span>
                <a
                  href={`https://explorer.solana.com/tx/${transaction.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono hover:text-[var(--color-primary)] transition-colors"
                  style={{ color: 'var(--color-info)' }}
                >
                  {transaction.tx_hash.slice(0, 8)}...{transaction.tx_hash.slice(-8)}
                </a>
              </div>
            )}
          </div>
        </Card>

        {/* Additional Info Card */}
        {(transaction.from_user || transaction.to_user) && (
          <Card>
            <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {transaction.type === 'transfer' ? 'Transfer Details' : 'Additional Information'}
            </h3>
            <div className="flex flex-col gap-3">
              {transaction.from_user && (
                <TransactionParticipant label="From" userId={transaction.from_user} />
              )}
              {transaction.to_user && (
                <TransactionParticipant label="To" userId={transaction.to_user} />
              )}
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

function TransactionParticipant({ label, userId }: { label: string; userId: string }) {
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserDoc(userId),
    enabled: !!userId,
  });

  const userName = user?.name || 'Unknown User';

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <Avatar fallback={userName} size="sm" />
        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{userName}</span>
      </div>
    </div>
  );
}
