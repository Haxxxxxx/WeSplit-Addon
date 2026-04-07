'use client';

import Link from 'next/link';
import { Plus, Users, Receipt, Clock, CheckCircle, XCircle, CalendarBlank } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { AvatarGroup } from '@/components/ui/Avatar';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSplits } from '@/hooks';
import type { Split, SplitStatus } from '@/types';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<SplitStatus, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  draft: { label: 'Draft', variant: 'default', icon: Clock },
  pending: { label: 'Pending', variant: 'warning', icon: Clock },
  active: { label: 'Active', variant: 'info', icon: Receipt },
  locked: { label: 'Locked', variant: 'orange', icon: Clock },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'error', icon: XCircle },
};

function getStatusConfig(status: SplitStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

// ---------------------------------------------------------------------------
// Category emoji helper
// ---------------------------------------------------------------------------

const CATEGORY_EMOJI = {
  trip: '✈️',
  food: '🍔',
  home: '🏠',
  event: '🎉',
  rocket: '🚀',
  default: '💸',
} as const;

const DEFAULT_EMOJI = '💸';

function getCategoryEmoji(category?: string): string {
  if (!category) return DEFAULT_EMOJI;
  const key = category as keyof typeof CATEGORY_EMOJI;
  return CATEGORY_EMOJI[key] ?? DEFAULT_EMOJI;
}

// ---------------------------------------------------------------------------
// Color from string (deterministic palette)
// ---------------------------------------------------------------------------

const PALETTE = [
  'var(--color-wallet-purple)',
  'var(--color-wallet-green)',
  'var(--color-wallet-orange)',
  'var(--color-wallet-blue)',
  'var(--color-wallet-red)',
  'var(--color-wallet-teal)',
  'var(--color-wallet-yellow)',
  'var(--color-wallet-pink)',
] as const;

const DEFAULT_COLOR = 'var(--color-wallet-purple)';

function colorFromName(name: string | undefined): string {
  const str = name || 'default';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx] ?? DEFAULT_COLOR;
}

// ---------------------------------------------------------------------------
// Skeleton placeholder for loading state
// ---------------------------------------------------------------------------

function SplitSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Skeleton width={48} height={48} radius="xl" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton height={16} width="70%" radius="sm" />
            <Skeleton height={12} width="40%" radius="sm" />
          </div>
        </div>
        {/* Amount + status */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton height={10} width="25%" radius="sm" />
            <Skeleton height={28} width="50%" radius="sm" />
          </div>
          <Skeleton height={20} width={70} radius="full" />
        </div>
        {/* Participants row */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={24} height={24} radius="full" />
            ))}
          </div>
          <Skeleton height={12} width={60} radius="sm" />
        </div>
      </div>
    </SkeletonCard>
  );
}

// ---------------------------------------------------------------------------
// Split Card Component
// ---------------------------------------------------------------------------

interface SplitCardProps {
  split: Split;
}

function SplitCard({ split }: SplitCardProps) {
  const { label, variant, icon: StatusIcon } = getStatusConfig(split.status);
  const color = colorFromName(split.title);
  const emoji = getCategoryEmoji(split.category);

  // Calculate progress
  const paidCount = split.participants.filter((p) => p.status === 'paid').length;
  const totalParticipants = split.participants.length;
  const progressPercent = totalParticipants > 0 ? (paidCount / totalParticipants) * 100 : 0;

  // Avatars for the group
  const avatars = split.participants.map((p) => ({
    fallback: p.name?.charAt(0).toUpperCase() || p.userId.slice(0, 2),
    src: p.avatar,
  }));

  return (
    <Link href={`/splits/${split.id}`}>
      <Card hoverable className="h-full transition-all">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: `${color}22`, border: `1px solid ${color}44` }}
            >
              {emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold" style={{ color: 'var(--color-text)' }}>
                  {split.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <CalendarBlank size={12} />
                <span>{formatDate(split.createdAt, { format: 'short' })}</span>
                {split.merchant?.name && (
                  <>
                    <span>·</span>
                    <span className="truncate">{split.merchant.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Amount + Status */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                Total
              </p>
              <p
                className="text-2xl font-semibold"
                style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
              >
                {formatCurrency(split.totalAmount, split.currency as 'USDC')}
              </p>
            </div>
            <Badge variant={variant} size="sm" leftIcon={<StatusIcon size={12} weight="bold" />}>
              {label}
            </Badge>
          </div>

          {/* Progress bar (only for active/pending splits) */}
          {(split.status === 'active' || split.status === 'pending') && totalParticipants > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {paidCount} of {totalParticipants} paid
                </span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--color-white-10)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    background: progressPercent === 100
                      ? 'var(--color-success)'
                      : 'linear-gradient(90deg, var(--color-gradient-start), var(--color-gradient-end))',
                  }}
                />
              </div>
            </div>
          )}

          {/* Participants */}
          <div className="flex items-center justify-between">
            <AvatarGroup avatars={avatars} max={4} size="xs" />
            <div className="flex items-center gap-1.5">
              <Users size={14} color="var(--color-text-tertiary)" />
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {totalParticipants}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
        style={{ backgroundColor: 'var(--color-white-5)' }}
      >
        💸
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          No splits yet
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Create a split to share expenses with friends
        </p>
      </div>
      <Link href="/splits/create">
        <Button variant="primary" leftIcon={<Plus size={18} weight="bold" />}>
          Create Split
        </Button>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SplitsPage() {
  const { splits, isLoading, error } = useSplits();

  // Sort splits by status priority (active/pending first) then by date
  const sortedSplits = [...splits].sort((a, b) => {
    const statusPriority: Record<SplitStatus, number> = {
      active: 0,
      pending: 1,
      draft: 2,
      locked: 3,
      completed: 4,
      cancelled: 5,
    };
    const aPriority = statusPriority[a.status] ?? 99;
    const bPriority = statusPriority[b.status] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <PageContainer>
      <PageHeader
        title="Splits"
        subtitle="Split expenses with friends"
        rightElement={
          <Link href="/splits/create">
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} weight="bold" />}>
              Create
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        /* Loading state — 4 skeleton cards in the same grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <SplitSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        /* Error state */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
            style={{ backgroundColor: 'var(--color-error-20)' }}
          >
            ⚠️
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Failed to load splits
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {error.message}
            </p>
          </div>
        </div>
      ) : sortedSplits.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedSplits.map((split) => (
            <SplitCard key={split.id} split={split} />
          ))}

          {/* Create new CTA */}
          <Link href="/splits/create">
            <div
              className="flex h-full min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] p-5 text-center transition-all hover:bg-white/[0.04]"
              style={{ border: '2px dashed var(--color-border)' }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--color-white-10)' }}
              >
                <Plus size={22} color="var(--color-text-secondary)" />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Create new split
              </p>
            </div>
          </Link>
        </div>
      )}
    </PageContainer>
  );
}
