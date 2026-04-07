'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import {
  Plus,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  Users,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import { useSplits } from '@/hooks';
import type { Split, SplitStatus } from '@/types';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<SplitStatus, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     variant: 'default', icon: Clock },
  pending:   { label: 'Pending',   variant: 'warning', icon: Clock },
  active:    { label: 'Active',    variant: 'info',    icon: Receipt },
  locked:    { label: 'Locked',    variant: 'orange',  icon: Clock },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'error',   icon: XCircle },
};

function getStatusConfig(status: SplitStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

// ---------------------------------------------------------------------------
// Category emoji
// ---------------------------------------------------------------------------

const CATEGORY_EMOJI: Record<string, string> = {
  trip: '✈️', food: '🍔', home: '🏠', event: '🎉', rocket: '🚀',
};

function getCategoryEmoji(category?: string): string {
  return (category && CATEGORY_EMOJI[category]) ?? '💸';
}

// ---------------------------------------------------------------------------
// Color from name
// ---------------------------------------------------------------------------

const PALETTE = [
  'var(--color-wallet-purple)',
  'var(--color-wallet-green)',
  'var(--color-wallet-orange)',
  'var(--color-wallet-blue)',
  'var(--color-wallet-red)',
  'var(--color-wallet-teal)',
];

function colorFromName(name: string | undefined): string {
  const str = name || 'x';
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length] ?? 'var(--color-wallet-purple)';
}

// ---------------------------------------------------------------------------
// Split row (compact for TG mobile)
// ---------------------------------------------------------------------------

function SplitRow({ split }: { split: Split }) {
  const { label, variant, icon: StatusIcon } = getStatusConfig(split.status);
  const color = colorFromName(split.title);
  const emoji = getCategoryEmoji(split.category);

  const paidCount    = split.participants.filter((p) => p.status === 'paid').length;
  const totalPartic  = split.participants.length;
  const progress     = totalPartic > 0 ? (paidCount / totalPartic) * 100 : 0;
  const isActive     = split.status === 'active' || split.status === 'pending';

  return (
    <Link
      href={`/tg/splits/${split.id}`}
      className="flex flex-col gap-2 rounded-xl p-3 transition-colors active:bg-white/[0.04]"
      style={{ backgroundColor: 'var(--color-white-5)' }}
    >
      {/* Row: icon + title + status */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: `${color}22`, border: `1px solid ${color}44` }}
        >
          {emoji}
        </div>

        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {split.title}
          </p>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            <Users size={10} />
            <span>{totalPartic} people</span>
            <span>·</span>
            <span>{formatDate(split.createdAt, { format: 'short' })}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="text-sm font-semibold"
            style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
          >
            {formatCurrency(split.totalAmount, split.currency as 'USDC')}
          </span>
          <Badge variant={variant} size="sm">
            <StatusIcon size={10} weight="bold" />
            {label}
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      {isActive && totalPartic > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
            <span>{paidCount}/{totalPartic} paid</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            className="h-1 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-white-10)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? 'var(--color-success)'
                  : 'linear-gradient(90deg, var(--color-gradient-start), var(--color-gradient-end))',
              }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SplitRowSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{ backgroundColor: 'var(--color-white-5)' }}
    >
      <Skeleton width={40} height={40} radius="xl" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton height={14} width="60%" radius="sm" />
        <Skeleton height={11} width="40%" radius="sm" />
      </div>
      <div className="flex flex-col items-end gap-1">
        <Skeleton height={14} width={60} radius="sm" />
        <Skeleton height={18} width={50} radius="full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TgSplitsPage() {
  const { splits, isLoading, refetch } = useSplits();

  const handleRefresh = useCallback(async () => { await refetch(); }, [refetch]);

  // Sort: active/pending first, then by date
  const STATUS_ORDER: Record<SplitStatus, number> = {
    active: 0, pending: 1, draft: 2, locked: 3, completed: 4, cancelled: 5,
  };
  const sorted = [...splits].sort((a, b) => {
    const diff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex flex-col gap-4 px-4 pt-5 pb-24 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-display)' }}>
              Splits
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Split expenses with friends
            </p>
          </div>
          <Link href="/tg/splits/create">
            <Button
              size="sm"
              leftIcon={<Plus size={16} weight="bold" />}
            >
              New Split
            </Button>
          </Link>
        </div>

        {/* Content */}
        {isLoading ? (
          <Card>
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => <SplitRowSkeleton key={i} />)}
            </div>
          </Card>
        ) : sorted.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
                style={{ backgroundColor: 'var(--color-white-5)' }}
              >
                💸
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  No splits yet
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Create a split to share expenses with friends
                </p>
              </div>
              <Link href="/tg/splits/create">
                <Button size="sm" leftIcon={<Plus size={15} weight="bold" />}>
                  Create Split
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            {/* Active / pending first */}
            {sorted.filter((s) => s.status === 'active' || s.status === 'pending').length > 0 && (
              <Card>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                  Active
                </p>
                <div className="flex flex-col gap-2">
                  {sorted
                    .filter((s) => s.status === 'active' || s.status === 'pending')
                    .map((s) => <SplitRow key={s.id} split={s} />)}
                </div>
              </Card>
            )}

            {/* Past splits */}
            {sorted.filter((s) => s.status !== 'active' && s.status !== 'pending').length > 0 && (
              <Card>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                  Past
                </p>
                <div className="flex flex-col gap-2">
                  {sorted
                    .filter((s) => s.status !== 'active' && s.status !== 'pending')
                    .map((s) => <SplitRow key={s.id} split={s} />)}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
