'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowsLeftRight,
  MagnifyingGlass,
  FunnelSimple,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, toDate } from '@/lib/utils';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTransactions } from '@/hooks';
import { useAppStore } from '@/store';
import { TransactionsSkeleton } from '@/components/telegram/TelegramSkeletons';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import type { Transaction } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FilterType = 'all' | 'send' | 'receive';

function getTxLabel(tx: Transaction, userId?: string): string {
  const isOutgoing = tx.from_user === userId;
  if (tx.type === 'deposit') return 'Deposit';
  if (tx.type === 'withdraw') return 'Withdrawal';
  if (isOutgoing) return tx.recipient_name ? `Sent to ${tx.recipient_name}` : 'Sent';
  return tx.sender_name ? `From ${tx.sender_name}` : 'Received';
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
      style={{
        backgroundColor: active ? 'var(--color-primary)' : 'var(--color-white-10)',
        color: active ? 'var(--color-bg)' : 'var(--color-text-secondary)',
        border: active ? '1px solid transparent' : '1px solid var(--color-border)',
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Telegram Transactions Page
// ---------------------------------------------------------------------------

export default function TelegramTransactionsPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const { transactions, isLoading, refetch } = useTransactions();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const filtered = transactions.filter((tx) => {
    const label = getTxLabel(tx, userId).toLowerCase();
    const matchSearch = label.includes(search.toLowerCase());
    const txOutgoing = tx.from_user === userId;
    const matchType =
      typeFilter === 'all' ||
      (typeFilter === 'send' && txOutgoing) ||
      (typeFilter === 'receive' && !txOutgoing);
    return matchSearch && matchType;
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (isLoading) return <TransactionsSkeleton />;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-bold" style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-h2)' }}>
          Transactions
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Full history of your activity
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<MagnifyingGlass size={16} />}
        />
        <div className="flex items-center gap-2">
          <FunnelSimple size={14} color="var(--color-text-tertiary)" />
          <FilterChip
            label="All"
            active={typeFilter === 'all'}
            onClick={() => { setTypeFilter('all'); haptic?.selectionChanged(); }}
          />
          <FilterChip
            label="Sent"
            active={typeFilter === 'send'}
            onClick={() => { setTypeFilter('send'); haptic?.selectionChanged(); }}
          />
          <FilterChip
            label="Received"
            active={typeFilter === 'receive'}
            onClick={() => { setTypeFilter('receive'); haptic?.selectionChanged(); }}
          />
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <ArrowsLeftRight size={36} color="var(--color-text-tertiary)" />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {transactions.length === 0
                ? 'No transactions yet'
                : 'No transactions match your filters'}
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {filtered.map((tx) => {
              const isSend = tx.from_user === userId;
              return (
                <Link key={tx.id} href={`/tg/transactions/${tx.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-white/[0.04]">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: isSend ? 'var(--color-error-20)' : 'var(--color-success-20)' }}
                  >
                    {isSend ? (
                      <ArrowUpRight size={16} weight="bold" color="var(--color-error)" />
                    ) : (
                      <ArrowDownLeft size={16} weight="bold" color="var(--color-success)" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
                      {getTxLabel(tx, userId)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {formatDate(toDate(tx.created_at), { format: 'relative' })}
                      </span>
                      {tx.status === 'pending' && (
                        <Badge variant="warning" size="sm">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-base font-medium shrink-0"
                    style={{
                      color: isSend ? 'var(--color-error)' : 'var(--color-success)',
                      fontFamily: 'var(--font-family-number)',
                    }}
                  >
                    {isSend ? '-' : '+'}
                    {formatCurrency(tx.amount, 'USDC')}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
    </PullToRefresh>
  );
}
