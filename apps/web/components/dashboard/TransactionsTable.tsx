'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft } from '@phosphor-icons/react';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Transaction } from '@/types';

// Handle Firestore Timestamp, ISO strings, and Date objects
function toDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(0);
}

function TypeIcon({ direction }: { direction: 'in' | 'out' }) {
  if (direction === 'out') {
    return (
      <div
        className="size-6 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-error-20)' }}
      >
        <ArrowUpRight size={12} weight="bold" color="var(--color-error)" />
      </div>
    );
  }
  return (
    <div
      className="size-6 rounded-full flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-primary-20)' }}
    >
      <ArrowDownLeft size={12} weight="bold" color="var(--color-primary)" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_1fr_1fr] gap-4 px-5 py-3.5 items-center border-b border-[var(--color-white-5)]">
      <div className="flex items-center gap-3">
        <Skeleton width={36} height={36} radius="full" />
        <Skeleton height={14} width={80} radius="sm" />
      </div>
      <div className="hidden sm:block"><Skeleton height={13} width={50} radius="sm" /></div>
      <div className="hidden sm:block text-right"><Skeleton height={14} width={70} radius="sm" /></div>
      <div className="flex justify-end"><Skeleton height={24} width={24} radius="full" /></div>
    </div>
  );
}

interface TransactionsTableProps {
  transactions: Transaction[];
  userId?: string;
  isLoading: boolean;
}

export function TransactionsTable({
  transactions,
  userId,
  isLoading,
}: TransactionsTableProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-[16px] font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          Transactions
        </span>
        <Link
          href="/transactions"
          className="text-[13px] font-medium transition-colors no-underline"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          View all
        </Link>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden border border-[var(--color-white-5)]"
      >
        {/* Table header */}
        <div
          className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr] gap-4 px-5 py-3 bg-[var(--color-white-5)] border-b border-[var(--color-white-5)]"
        >
          {['Name', 'Date', 'Amount', 'Type'].map((h) => (
            <span
              key={h}
              className={`text-[12px] font-medium uppercase tracking-wider ${
                h === 'Amount' || h === 'Type' ? 'text-right' : ''
              }`}
              style={{ color: 'var(--color-text-disabled)' }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}

        {/* Empty state */}
        {!isLoading && transactions.length === 0 && (
          <div className="py-8 text-center">
            <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              No transactions yet
            </span>
          </div>
        )}

        {/* Rows */}
        {!isLoading &&
          transactions.map((tx, i) => {
            const isSend = tx.from_user === userId;
            const direction: 'in' | 'out' = isSend ? 'out' : 'in';
            const name = isSend
              ? tx.recipient_name || 'Unknown'
              : tx.sender_name || 'Unknown';
            const typeLabel = isSend ? 'Send' : 'Receive';
            const txDate = toDate(tx.created_at);
            const currency = (tx.currency === 'SOL' ? 'SOL' : 'USDC') as 'USDC' | 'SOL';

            return (
              <Link
                key={tx.id}
                href={`/transactions/${tx.id}`}
                className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-[var(--color-white-5)] transition-colors cursor-pointer no-underline ${
                  i < transactions.length - 1
                    ? 'border-b border-[var(--color-white-5)]'
                    : ''
                }`}
              >
                {/* Name + Avatar */}
                <div className="flex items-center gap-3">
                  <div
                    className="size-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-semibold"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))',
                      color: 'var(--color-bg)',
                    }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className="text-[14px] font-medium truncate"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {name}
                  </span>
                </div>

                {/* Date */}
                <div className="hidden sm:flex flex-col">
                  <span
                    className="text-[13px] font-normal"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {formatDate(txDate, { format: 'relative' })}
                  </span>
                  <span
                    className="text-[11px] font-normal"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    {txDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Amount */}
                <div className="hidden sm:block text-right">
                  <span
                    className="text-[14px] font-medium"
                    style={{
                      fontFamily: 'var(--font-family-number)',
                      color:
                        direction === 'in'
                          ? 'var(--color-primary)'
                          : 'var(--color-text)',
                    }}
                  >
                    {direction === 'in' ? '+' : '-'}
                    {formatCurrency(tx.amount, currency)}
                  </span>
                </div>

                {/* Type */}
                <div className="flex items-center gap-2 justify-end">
                  <span
                    className="sm:hidden text-[14px] font-medium"
                    style={{
                      fontFamily: 'var(--font-family-number)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {direction === 'in' ? '+' : '-'}
                    {formatCurrency(tx.amount, currency, { showSymbol: false })}
                  </span>
                  <TypeIcon direction={direction} />
                  <span
                    className="hidden sm:inline text-[13px] font-normal"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {typeLabel}
                  </span>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
