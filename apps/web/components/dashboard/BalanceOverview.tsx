'use client';

import { useId } from 'react';
import Link from 'next/link';
import {
  PaperPlaneTilt,
  HandCoins,
  ArrowDown,
  QrCode,
} from '@phosphor-icons/react';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/lib/utils';

interface BalanceOverviewProps {
  usdcBalance: number;
  totalSent: number;
  totalReceived: number;
  isLoading: boolean;
}

function ActionButton({
  icon,
  label,
  href,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-5 h-[42px] rounded-xl cursor-pointer border-none transition-all duration-200 no-underline ${
        primary
          ? 'hover:opacity-90'
          : 'bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] border border-[var(--color-white-10)]'
      }`}
      style={
        primary
          ? {
              backgroundImage:
                'linear-gradient(174deg, var(--color-gradient-start) 0%, var(--color-gradient-end) 100%)',
            }
          : undefined
      }
    >
      {icon}
      <span
        className={`text-[14px] font-medium ${primary ? 'text-[var(--color-bg)]' : 'text-[var(--color-text)]'}`}
      >
        {label}
      </span>
    </Link>
  );
}

export function BalanceOverview({
  usdcBalance,
  totalSent,
  totalReceived,
  isLoading,
}: BalanceOverviewProps) {
  const gradientId = useId();

  const balanceData = [
    { label: 'Total Balance', amount: usdcBalance, change: '', up: true, highlight: true },
    { label: 'Total Sent', amount: totalSent, change: 'Recent', up: false, highlight: false },
    { label: 'Total Received', amount: totalReceived, change: 'Recent', up: true, highlight: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {balanceData.map((item) => (
          <div
            key={item.label}
            className="relative rounded-2xl p-5 overflow-hidden"
            style={{
              background: item.highlight
                ? 'linear-gradient(135deg, var(--color-primary-20) 0%, rgba(83,239,151,0.06) 100%)'
                : 'var(--color-white-5)',
              border: item.highlight
                ? '1px solid rgba(165,234,21,0.15)'
                : '1px solid var(--color-white-5)',
            }}
          >
            {item.highlight && (
              <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-20">
                <svg viewBox="0 0 128 128" fill="none" className="size-full">
                  <defs>
                    <radialGradient id={gradientId}>
                      <stop stopColor="var(--color-primary)" />
                      <stop offset="1" stopColor="transparent" />
                    </radialGradient>
                  </defs>
                  <circle cx="96" cy="32" r="64" fill={`url(#${gradientId})`} />
                </svg>
              </div>
            )}
            <div className="flex flex-col gap-3 relative z-10">
              <span
                className="text-[13px] font-normal"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {item.label}
              </span>
              <div className="flex items-end gap-2">
                {isLoading ? (
                  <Skeleton height={28} width={120} radius="md" />
                ) : (
                  <>
                    <span
                      className="text-[28px] font-semibold leading-none"
                      style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
                    >
                      {formatCurrency(item.amount, 'USDC', { showSymbol: false })}
                    </span>
                    <span
                      className="text-[16px] font-normal mb-[2px]"
                      style={{ color: 'var(--color-text-disabled)' }}
                    >
                      USDC
                    </span>
                  </>
                )}
              </div>
              {item.change && (
                <span
                  className="text-[12px] font-medium"
                  style={{ color: item.up ? 'var(--color-primary)' : 'var(--color-text-disabled)' }}
                >
                  {item.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <ActionButton
          primary
          label="Send"
          href="/send"
          icon={<PaperPlaneTilt size={16} weight="fill" color="var(--color-bg)" />}
        />
        <ActionButton
          label="Request"
          href="/request"
          icon={<HandCoins size={16} color="var(--color-text)" />}
        />
        <ActionButton
          label="Deposit"
          href="/deposit"
          icon={<ArrowDown size={16} color="var(--color-text)" />}
        />
        <ActionButton
          label="QR Code"
          href="/wallets"
          icon={<QrCode size={16} color="var(--color-text)" />}
        />
      </div>
    </div>
  );
}
