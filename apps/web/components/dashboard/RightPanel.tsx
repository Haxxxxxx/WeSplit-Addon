'use client';

import Link from 'next/link';
import {
  TrendUp,
  Users,
  CaretRight,
  Plus,
  Wallet,
} from '@phosphor-icons/react';
import { Skeleton } from '@/components/ui/Skeleton';
import type { SharedWallet } from '@/types';

interface RightPanelProps {
  sharedWallets: SharedWallet[];
  swLoading: boolean;
  currentUserName?: string;
}

function GroupRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton width={40} height={40} radius="full" />
      <div className="flex flex-col gap-1.5 flex-1">
        <Skeleton height={14} width="60%" radius="sm" />
        <Skeleton height={11} width="30%" radius="sm" />
      </div>
    </div>
  );
}

export function RightPanel({
  sharedWallets,
  swLoading,
  currentUserName: _currentUserName,
}: RightPanelProps) {
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Leaderboard card */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, rgba(165,234,21,0.08) 0%, rgba(83,239,151,0.03) 100%)',
          border: '1px solid rgba(165,234,21,0.1)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendUp size={16} color="var(--color-primary)" />
          <span
            className="text-[14px] font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            Leaderboard
          </span>
        </div>

        {/* Placeholder until rewards/leaderboard API is wired */}
        <div className="flex flex-col items-center py-4 gap-2">
          <TrendUp size={32} color="var(--color-text-disabled)" />
          <p className="text-[13px] font-normal text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            Leaderboard coming soon
          </p>
          <p className="text-[11px] font-normal text-center" style={{ color: 'var(--color-text-disabled)' }}>
            Earn points by sending, splitting, and inviting friends
          </p>
        </div>

        <Link
          href="/rewards"
          className="mt-3 w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] transition-colors cursor-pointer no-underline"
        >
          <span
            className="text-[12px] font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            View rewards
          </span>
          <CaretRight size={12} color="var(--color-text-disabled)" />
        </Link>
      </div>

      {/* Recent Groups */}
      <div
        className="rounded-2xl p-5 border border-[var(--color-white-5)]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} color="var(--color-text-tertiary)" />
            <span
              className="text-[14px] font-semibold"
              style={{ color: 'var(--color-text)' }}
            >
              Recent Groups
            </span>
          </div>
          <Link
            href="/shared-wallets"
            className="text-[12px] font-medium transition-colors no-underline"
            style={{ color: 'var(--color-text-disabled)' }}
          >
            See all
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          {swLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <GroupRowSkeleton key={i} />
            ))}

          {!swLoading && sharedWallets.length === 0 && (
            <p
              className="py-4 text-center text-sm"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              No shared wallets yet
            </p>
          )}

          {!swLoading &&
            sharedWallets.slice(0, 4).map((sw) => {
              const memberCount = sw.members?.length ?? 0;
              return (
                <Link
                  key={sw.id}
                  href={`/shared-wallets/${sw.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--color-white-5)] transition-colors cursor-pointer no-underline"
                >
                  <div
                    className="size-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--color-primary-dim)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <Wallet
                      size={20}
                      weight="duotone"
                      color="var(--color-primary)"
                    />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className="text-[14px] font-medium truncate"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {sw.name}
                    </span>
                    <span
                      className="text-[11px] font-normal"
                      style={{ color: 'var(--color-text-disabled)' }}
                    >
                      {memberCount} member{memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <CaretRight
                    size={14}
                    color="var(--color-text-disabled)"
                  />
                </Link>
              );
            })}
        </div>
      </div>

      {/* Quick create */}
      <Link
        href="/shared-wallets/create"
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl cursor-pointer border-none transition-all duration-200 hover:opacity-90 no-underline"
        style={{
          backgroundImage:
            'linear-gradient(174deg, var(--color-gradient-start) 0%, var(--color-gradient-end) 100%)',
          boxShadow: '0px 4px 24px 0px rgba(165,234,21,0.15)',
        }}
      >
        <Plus size={18} weight="bold" color="var(--color-bg)" />
        <span
          className="text-[14px] font-semibold"
          style={{ color: 'var(--color-bg)' }}
        >
          Create New Group
        </span>
      </Link>
    </div>
  );
}
