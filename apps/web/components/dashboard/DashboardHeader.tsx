'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MagnifyingGlass,
  CaretDown,
  List,
  Bell,
  QrCode,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  userName?: string;
  userAvatar?: string | null;
  unreadCount?: number;
  onMobileMenuToggle: () => void;
}

export function DashboardHeader({
  userName = 'User',
  userAvatar,
  unreadCount = 0,
  onMobileMenuToggle,
}: DashboardHeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="flex items-center justify-between h-[72px] px-6 lg:px-8 border-b border-[var(--color-border)] shrink-0">
      {/* Left: Mobile menu + Greeting */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggle}
          aria-label="Open navigation menu"
          className="md:hidden flex items-center justify-center size-10 rounded-xl bg-[var(--color-white-5)] border-none cursor-pointer"
        >
          <List size={20} color="var(--color-text)" />
        </button>
        <div className="hidden sm:flex flex-col">
          <span
            className="text-[13px] font-normal"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Welcome back,
          </span>
          <span
            className="text-[18px] font-bold"
            style={{ color: 'var(--color-text)' }}
          >
            {userName}
          </span>
        </div>
      </div>

      {/* Center: Search */}
      <div
        role="search"
        className={cn(
          'hidden md:flex items-center gap-2 px-4 h-[40px] rounded-xl bg-[var(--color-white-5)] border transition-all duration-200 w-[320px]',
          searchFocused
            ? 'border-[var(--color-primary)]/30 bg-[var(--color-white-10)]'
            : 'border-transparent'
        )}
      >
        <MagnifyingGlass size={16} color="var(--color-text-disabled)" />
        <input
          aria-label="Search transactions and groups"
          className="bg-transparent border-none outline-none flex-1 text-[14px] font-normal placeholder:text-[var(--color-text-disabled)]"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-body)' }}
          placeholder="Search transactions, groups..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <Link
          href="/notifications"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          className="relative flex items-center justify-center size-10 rounded-xl bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] transition-colors cursor-pointer border-none"
        >
          <Bell size={18} color="var(--color-text-secondary)" />
          {unreadCount > 0 && (
            <div
              className="absolute right-2 top-2 size-2 rounded-full"
              style={{
                backgroundImage:
                  'linear-gradient(174deg, var(--color-gradient-start) 0%, var(--color-gradient-end) 100%)',
              }}
            />
          )}
        </Link>

        {/* QR Code */}
        <Link
          href="/wallets"
          aria-label="Show QR code"
          className="hidden sm:flex items-center justify-center size-10 rounded-xl bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] transition-colors cursor-pointer border-none"
        >
          <QrCode size={18} color="var(--color-text-secondary)" />
        </Link>

        {/* Profile pill */}
        <Link
          href="/settings"
          aria-label="Profile settings"
          className="hidden lg:flex items-center gap-2 pl-1 pr-3 h-[40px] rounded-full bg-[var(--color-white-5)] hover:bg-[var(--color-white-10)] transition-colors cursor-pointer border-none"
        >
          {userAvatar ? (
            <div className="size-8 rounded-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={userName}
                className="size-full object-cover"
                src={userAvatar}
              />
            </div>
          ) : (
            <div
              className="size-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))',
                color: 'var(--color-bg)',
              }}
            >
              {userInitial}
            </div>
          )}
          <CaretDown size={14} color="var(--color-text-tertiary)" />
        </Link>
      </div>
    </header>
  );
}
