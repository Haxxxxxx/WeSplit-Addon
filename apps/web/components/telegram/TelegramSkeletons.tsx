'use client';

import { Skeleton, SkeletonAvatar } from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Shared skeleton building blocks for Telegram Mini App pages
// ---------------------------------------------------------------------------

/** Page header: icon box + title lines */
export function SkeletonPageHeader() {
  return (
    <div className="flex items-center gap-3 mb-2">
      <Skeleton width={40} height={40} radius="lg" shimmer />
      <div className="flex flex-col gap-1.5">
        <Skeleton width={100} height={20} radius="sm" shimmer />
        <Skeleton width={160} height={14} radius="sm" shimmer />
      </div>
    </div>
  );
}

/** Hero balance card skeleton */
export function SkeletonHeroBalance() {
  return (
    <div
      className="rounded-[var(--radius-xl)] p-5 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <Skeleton width={90} height={12} radius="sm" shimmer />
      <Skeleton width={180} height={40} radius="md" shimmer />
      <Skeleton width={120} height={28} radius="lg" shimmer />
    </div>
  );
}

/** Quick action grid (4 circles + labels) */
export function SkeletonQuickActions() {
  return (
    <div className="grid grid-cols-4 gap-2 py-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <Skeleton width={48} height={48} radius="lg" shimmer />
          <Skeleton width={40} height={12} radius="sm" shimmer />
        </div>
      ))}
    </div>
  );
}

/** Card with section header + list rows */
export function SkeletonListCard({ rows = 3, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div
      className="rounded-[var(--radius-xl)] p-4 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {title && (
        <div className="flex items-center justify-between mb-1">
          <Skeleton width={120} height={16} radius="sm" shimmer />
          <Skeleton width={50} height={14} radius="sm" shimmer />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1">
          <Skeleton width={36} height={36} radius="full" shimmer />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton width="70%" height={14} radius="sm" shimmer />
            <Skeleton width="40%" height={12} radius="sm" shimmer />
          </div>
          <Skeleton width={60} height={16} radius="sm" shimmer />
        </div>
      ))}
    </div>
  );
}

/** Input card skeleton (label + input box) */
export function SkeletonInputCard({ hasSubtext = false }: { hasSubtext?: boolean }) {
  return (
    <div
      className="rounded-[var(--radius-xl)] p-4 flex flex-col gap-2"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <Skeleton width={80} height={12} radius="sm" shimmer />
      <Skeleton width="100%" height={48} radius="lg" shimmer />
      {hasSubtext && <Skeleton width={140} height={12} radius="sm" shimmer />}
    </div>
  );
}

/** Wallet card skeleton (emoji + name + balance) */
export function SkeletonWalletRow() {
  return (
    <div
      className="rounded-[var(--radius-xl)] p-4 flex items-center gap-3"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <Skeleton width={48} height={48} radius="lg" shimmer />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton width={100} height={16} radius="sm" shimmer />
        <Skeleton width={70} height={12} radius="sm" shimmer />
      </div>
      <Skeleton width={80} height={18} radius="sm" shimmer />
    </div>
  );
}

/** Transaction row skeleton */
export function SkeletonTransactionRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton width={36} height={36} radius="full" shimmer />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton width="60%" height={14} radius="sm" shimmer />
        <Skeleton width="30%" height={12} radius="sm" shimmer />
      </div>
      <Skeleton width={70} height={16} radius="sm" shimmer />
    </div>
  );
}

/** Tab bar skeleton */
export function SkeletonTabBar() {
  return (
    <div
      className="flex gap-1 rounded-xl p-1"
      style={{ backgroundColor: 'var(--color-white-5)' }}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} width="33.333%" height={36} radius="lg" shimmer />
      ))}
    </div>
  );
}

/** Wallet detail hero skeleton */
export function SkeletonWalletHero() {
  return (
    <div
      className="rounded-[var(--radius-xl)] p-5 flex flex-col gap-3 relative overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-start gap-3 mb-1">
        <Skeleton width={48} height={48} radius="lg" shimmer />
        <div className="flex-1 flex flex-col gap-1.5">
          <Skeleton width={140} height={20} radius="sm" shimmer />
          <Skeleton width={100} height={14} radius="sm" shimmer />
        </div>
        <Skeleton width={60} height={24} radius="full" shimmer />
      </div>
      <Skeleton width={70} height={12} radius="sm" shimmer />
      <Skeleton width={160} height={36} radius="md" shimmer />
      <div className="flex items-center justify-between mt-1">
        <div className="flex -space-x-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonAvatar key={i} size={28} />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton width={90} height={32} radius="lg" shimmer />
          <Skeleton width={70} height={32} radius="lg" shimmer />
        </div>
      </div>
    </div>
  );
}

/** Member row skeleton */
export function SkeletonMemberRow() {
  return (
    <div
      className="rounded-[var(--radius-xl)] p-3 flex items-center gap-3"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <SkeletonAvatar size={40} />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton width={100} height={14} radius="sm" shimmer />
        <Skeleton width={60} height={12} radius="sm" shimmer />
      </div>
      <Skeleton width={56} height={22} radius="full" shimmer />
    </div>
  );
}

/** Search + filter bar skeleton */
export function SkeletonSearchBar() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton width="100%" height={44} radius="lg" shimmer />
      <div className="flex items-center gap-2">
        <Skeleton width={14} height={14} radius="sm" shimmer />
        <Skeleton width={44} height={30} radius="full" shimmer />
        <Skeleton width={50} height={30} radius="full" shimmer />
        <Skeleton width={68} height={30} radius="full" shimmer />
      </div>
    </div>
  );
}

/** QR code area skeleton */
export function SkeletonQrCode() {
  return (
    <div
      className="rounded-[var(--radius-xl)] p-4 flex flex-col items-center gap-4"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <Skeleton width={176} height={176} radius="lg" shimmer />
      <div className="flex flex-col items-center gap-1">
        <Skeleton width={100} height={12} radius="sm" shimmer />
        <Skeleton width={260} height={14} radius="sm" shimmer />
      </div>
    </div>
  );
}

/** Warning banner skeleton */
export function SkeletonBanner() {
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-3.5"
      style={{ backgroundColor: 'var(--color-white-5)', border: '1px solid var(--color-border)' }}
    >
      <Skeleton width={20} height={20} radius="sm" shimmer />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton width={120} height={14} radius="sm" shimmer />
        <Skeleton width="90%" height={12} radius="sm" shimmer />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composed page-level skeletons
// ---------------------------------------------------------------------------

/** Full dashboard skeleton */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton width={36} height={36} radius="lg" shimmer />
          <div className="flex flex-col gap-1">
            <Skeleton width={80} height={12} radius="sm" shimmer />
            <Skeleton width={60} height={16} radius="sm" shimmer />
          </div>
        </div>
        <SkeletonAvatar size={32} />
      </div>
      <SkeletonHeroBalance />
      <SkeletonQuickActions />
      <SkeletonListCard rows={2} />
      <SkeletonListCard rows={3} />
    </div>
  );
}

/** Full send page skeleton */
export function SendSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-6 animate-fade-in">
      <SkeletonPageHeader />
      <SkeletonInputCard />
      <SkeletonInputCard hasSubtext />
    </div>
  );
}

/** Full request page skeleton */
export function RequestSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-6 animate-fade-in">
      <SkeletonPageHeader />
      <SkeletonInputCard />
      <SkeletonListCard rows={4} />
      <SkeletonInputCard />
    </div>
  );
}

/** Full withdraw page skeleton */
export function WithdrawSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-6 animate-fade-in">
      <SkeletonPageHeader />
      <SkeletonInputCard />
      <SkeletonInputCard hasSubtext />
      <SkeletonInputCard hasSubtext />
      <Skeleton width="100%" height={44} radius="lg" shimmer />
    </div>
  );
}

/** Full deposit page skeleton */
export function DepositSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-6 animate-fade-in">
      <div className="flex flex-col gap-1.5">
        <Skeleton width={80} height={22} radius="sm" shimmer />
        <Skeleton width={200} height={14} radius="sm" shimmer />
      </div>
      <SkeletonBanner />
      <SkeletonQrCode />
      <SkeletonInputCard />
      <div className="flex gap-3">
        <Skeleton width="100%" height={48} radius="lg" shimmer />
        <Skeleton width={80} height={48} radius="lg" shimmer />
      </div>
    </div>
  );
}

/** Full wallets list skeleton */
export function WalletsListSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-6 animate-fade-in">
      <div className="flex flex-col gap-1.5">
        <Skeleton width={130} height={22} radius="sm" shimmer />
        <Skeleton width={200} height={14} radius="sm" shimmer />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonWalletRow key={i} />
        ))}
      </div>
      <Skeleton width="100%" height={48} radius="lg" shimmer />
    </div>
  );
}

/** Full wallet detail skeleton */
export function WalletDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-6 animate-fade-in">
      <SkeletonWalletHero />
      <SkeletonTabBar />
      <SkeletonListCard rows={4} title={false} />
    </div>
  );
}

/** Full transactions page skeleton */
export function TransactionsSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-6 animate-fade-in">
      <div className="flex flex-col gap-1.5">
        <Skeleton width={120} height={22} radius="sm" shimmer />
        <Skeleton width={180} height={14} radius="sm" shimmer />
      </div>
      <SkeletonSearchBar />
      <Skeleton width={100} height={14} radius="sm" shimmer />
      <div
        className="rounded-[var(--radius-xl)] overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonTransactionRow key={i} />
        ))}
      </div>
    </div>
  );
}

/** Leaderboard content skeleton: podium placeholders + list rows (inline, no header/tabs) */
export function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div
        className="rounded-2xl p-4 pb-0 overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-end gap-2 justify-center">
          {[80, 96, 64].map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
              <Skeleton width={i === 1 ? 56 : 44} height={i === 1 ? 56 : 44} radius="full" shimmer />
              <Skeleton width={60} height={12} radius="sm" shimmer />
              <Skeleton width={40} height={12} radius="sm" shimmer />
              <Skeleton width="100%" height={h} radius="sm" shimmer />
            </div>
          ))}
        </div>
      </div>
      <SkeletonListCard rows={5} title={false} />
    </div>
  );
}

/** Quests/badges content skeleton: list rows (inline, no header/tabs) */
export function QuestsSkeleton() {
  return (
    <div className="animate-pulse">
      <SkeletonListCard rows={6} title={false} />
    </div>
  );
}

/** Points history content skeleton: grouped list sections (inline, no header) */
export function PointsHistorySkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <Skeleton width={120} height={14} radius="sm" shimmer />
      <SkeletonListCard rows={4} title={false} />
      <Skeleton width={120} height={14} radius="sm" shimmer />
      <SkeletonListCard rows={3} title={false} />
    </div>
  );
}
