'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FunnelSimple,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowsLeftRight,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getUserTransactions } from '@/lib/firebase/queries';
import { useAppStore } from '@/store';
import type { Transaction } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
}

type FilterType = 'all' | 'send' | 'receive' | 'withdraw' | 'deposit';
type FilterStatus = 'all' | 'completed' | 'pending';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TransactionsPage() {
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', userId],
    queryFn: () => getUserTransactions(userId!, 100),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const filtered = transactions.filter((tx: Transaction) => {
    // Derive txType from tx.type field, fall back to from_user comparison
    let txType: FilterType;
    const rawType = (tx as unknown as Record<string, unknown>).type as string | undefined;
    if (rawType === 'withdraw' || rawType === 'withdrawal') {
      txType = 'withdraw';
    } else if (rawType === 'deposit') {
      txType = 'deposit';
    } else {
      txType = tx.from_user === userId ? 'send' : 'receive';
    }

    const isSend = txType === 'send';
    const label = isSend
      ? `Sent${tx.recipient_name ? ` to ${tx.recipient_name}` : ''}`
      : txType === 'withdraw'
      ? 'Withdrawal'
      : txType === 'deposit'
      ? 'Deposit'
      : `Received${tx.sender_name ? ` from ${tx.sender_name}` : ''}`;

    const matchSearch =
      label.toLowerCase().includes(search.toLowerCase()) ||
      (tx.note ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (tx.recipient_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (tx.sender_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || txType === typeFilter;
    const matchStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  function FilterButton({ value, label, current, onChange }: { value: string; label: string; current: string; onChange: (v: any) => void }) {
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
        style={{
          backgroundColor: current === value ? 'var(--color-primary)' : 'var(--color-white-10)',
          color: current === value ? 'var(--color-bg)' : 'var(--color-text-secondary)',
          border: '1px solid ' + (current === value ? 'transparent' : 'var(--color-border)'),
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Transactions" subtitle="Full history of your activity" />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3">
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<MagnifyingGlass size={16} />}
        />
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <FunnelSimple size={14} color="var(--color-text-tertiary)" />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Type:</span>
          </div>
          <FilterButton value="all"      label="All"       current={typeFilter} onChange={setTypeFilter} />
          <FilterButton value="send"     label="Sent"      current={typeFilter} onChange={setTypeFilter} />
          <FilterButton value="receive"  label="Received"  current={typeFilter} onChange={setTypeFilter} />
          <FilterButton value="withdraw" label="Withdraw"  current={typeFilter} onChange={setTypeFilter} />
          <FilterButton value="deposit"  label="Deposit"   current={typeFilter} onChange={setTypeFilter} />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Status:</span>
          </div>
          <FilterButton value="all"       label="All"       current={statusFilter} onChange={setStatusFilter} />
          <FilterButton value="completed" label="Confirmed" current={statusFilter} onChange={setStatusFilter} />
          <FilterButton value="pending"   label="Pending"   current={statusFilter} onChange={setStatusFilter} />
        </div>
      </div>

      {/* Results count */}
      <p className="mb-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {isLoading ? '...' : `${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* Transaction list */}
      <Card padding="none" className="overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <Skeleton width={40} height={40} radius="full" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton height={14} width="60%" radius="sm" />
                  <Skeleton height={12} width="30%" radius="sm" />
                </div>
                <Skeleton height={14} width={60} radius="sm" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ArrowsLeftRight size={40} color="var(--color-text-tertiary)" />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
            </p>
            {transactions.length === 0 && (
              <Link
                href="/send"
                className="mt-1 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors"
                style={{ background: 'var(--color-primary)', color: 'var(--color-black)' }}
              >
                Send USDC
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {filtered.map((tx: Transaction) => {
              const isSend = tx.from_user === userId;
              const label = isSend
                ? tx.recipient_name ? `Sent to ${tx.recipient_name}` : `Sent`
                : tx.sender_name ? `Received from ${tx.sender_name}` : `Received`;

              return (
                <Link key={tx.id} href={`/transactions/${tx.id}`}>
                  <div className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: isSend ? 'var(--color-error-20)' : 'var(--color-success-20)' }}
                    >
                      {isSend
                        ? <ArrowUpRight size={18} weight="bold" color="var(--color-error)" />
                        : <ArrowDownLeft size={18} weight="bold" color="var(--color-success)" />
                      }
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <span className="truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {formatDate(toDate(tx.created_at), { format: 'relative' })}
                        </span>
                        {tx.status === 'pending' && <Badge variant="warning" size="sm">Pending</Badge>}
                      </div>
                    </div>
                    <span
                      className="text-sm font-semibold shrink-0"
                      style={{
                        color: isSend ? 'var(--color-error)' : 'var(--color-success)',
                        fontFamily: 'var(--font-family-number)',
                      }}
                    >
                      {isSend ? '-' : '+'}{formatCurrency(tx.amount, (tx.currency as 'USDC' | 'SOL') || 'USDC')}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
