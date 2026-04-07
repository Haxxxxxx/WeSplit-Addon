'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isNavActive } from '@/lib/nav';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  userAvatar?: string | null;
}

export function MobileNavDrawer({
  open,
  onClose,
  userName = 'User',
  userAvatar,
}: MobileNavDrawerProps) {
  const pathname = usePathname();

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <nav
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="fixed left-0 top-0 bottom-0 w-[280px] z-50 flex flex-col md:hidden"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 h-[72px]"
          style={{ borderBottom: '1px solid var(--color-white-5)' }}
        >
          <div className="flex items-center gap-3">
            <Image
              src="/wesplit-logo.png"
              alt="WeSplit"
              width={36}
              height={36}
              className="rounded-[7px]"
            />
            <span
              className="text-[20px] font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              WeSplit
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="size-9 rounded-xl bg-[var(--color-white-5)] flex items-center justify-center cursor-pointer border-none"
          >
            <X size={18} color="var(--color-text-secondary)" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex flex-col gap-1 px-3 mt-4 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 h-[48px] transition-all cursor-pointer no-underline',
                  active
                    ? 'bg-[var(--color-white-10)]'
                    : 'bg-transparent hover:bg-[var(--color-white-5)]'
                )}
              >
                <Icon
                  size={20}
                  weight={active ? 'fill' : 'regular'}
                  style={{
                    color: active
                      ? 'var(--color-primary)'
                      : 'var(--color-text-tertiary)',
                  }}
                />
                <span
                  className="text-[15px] font-medium"
                  style={{
                    color: active
                      ? 'var(--color-text)'
                      : 'var(--color-text-tertiary)',
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Profile */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderTop: '1px solid var(--color-white-5)' }}
        >
          {userAvatar ? (
            <div className="size-10 rounded-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={userName}
                className="size-full object-cover"
                src={userAvatar}
              />
            </div>
          ) : (
            <div
              className="size-10 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))',
                color: 'var(--color-bg)',
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <span
              className="text-[14px] font-semibold"
              style={{ color: 'var(--color-text)' }}
            >
              {userName}
            </span>
          </div>
        </div>
      </nav>
    </>
  );
}
