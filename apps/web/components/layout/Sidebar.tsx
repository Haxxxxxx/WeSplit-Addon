'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  SignOut,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useAuth } from '@/providers';
import { useRealtimeNotifications } from '@/hooks/web/useRealtimeNotifications';
import { NAV_ITEMS, isNavActive } from '@/lib/nav';
import type { NavItem } from '@/lib/nav';

// ---------------------------------------------------------------------------
// NavLink — single sidebar item
// ---------------------------------------------------------------------------

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}

function NavLink({ item, isActive, collapsed }: NavLinkProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
        'text-sm font-medium outline-none',
        // Default state
        'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
        'hover:bg-white/[0.06]',
        // Active state
        isActive && [
          'text-[var(--color-text)]',
          'bg-[var(--color-primary)]/10',
          'hover:bg-[var(--color-primary)]/10',
        ],
        // Collapsed layout
        collapsed && 'justify-center px-0 py-3'
      )}
    >
      {/* Active gradient left border */}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-r-full"
          style={{
            background: 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-end) 100%)',
          }}
        />
      )}

      {/* Icon */}
      <Icon
        size={20}
        weight={isActive ? 'fill' : 'regular'}
        className={cn(
          'flex-shrink-0 transition-colors duration-200',
          isActive
            ? 'text-[var(--color-primary)]'
            : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]'
        )}
      />

      {/* Label — hidden when collapsed */}
      {!collapsed && (
        <span className="truncate leading-none">{item.label}</span>
      )}

      {/* Tooltip for collapsed mode */}
      {collapsed && (
        <span
          className={cn(
            'pointer-events-none absolute left-[calc(100%+12px)] z-50 whitespace-nowrap',
            'rounded-lg bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)]',
            'shadow-lg ring-1 ring-white/10',
            'opacity-0 translate-x-[-4px] transition-all duration-150',
            'group-hover:opacity-100 group-hover:translate-x-0'
          )}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userName = currentUser?.name || 'My Account';
  const userInitial = userName.charAt(0).toUpperCase();

  // Unread notification count for badge
  const { unreadCount } = useRealtimeNotifications(currentUser?.id);

  const isActive = (href: string) => isNavActive(pathname, href);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col',
        'bg-[var(--color-surface)] border-r border-[var(--color-border)]',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-14' : 'w-60'
      )}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Logo */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={cn(
          'flex items-center border-b border-[var(--color-border)] px-4',
          'h-16 flex-shrink-0',
          collapsed && 'justify-center px-0'
        )}
      >
        {collapsed ? (
          <Image
            src="/wesplit-logo.png"
            alt="WeSplit"
            width={32}
            height={32}
            className="rounded-lg"
          />
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2 outline-none">
            <Image
              src="/wesplit-logo.png"
              alt="WeSplit"
              width={32}
              height={32}
              className="rounded-lg flex-shrink-0"
            />
            <span
              className="text-lg font-bold tracking-tight"
              style={{
                background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-end) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              WeSplit
            </span>
          </Link>
        )}
      </div>

      {/* Collapse toggle */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            'absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full',
            'bg-[var(--color-surface)] border border-[var(--color-border)]',
            'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-white-10)]',
            'transition-colors shadow-sm'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <CaretRight size={12} weight="bold" /> : <CaretLeft size={12} weight="bold" />}
        </button>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Navigation links */}
      {/* ------------------------------------------------------------------ */}
      <nav
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden py-4',
          collapsed ? 'px-1' : 'px-3'
        )}
      >
        <ul className="flex flex-col gap-0.5" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                isActive={isActive(item.href)}
                collapsed={collapsed}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom section — notifications + user + sign out */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={cn(
          'flex flex-col gap-1 border-t border-[var(--color-border)] py-3',
          collapsed ? 'px-1 items-center' : 'px-3'
        )}
      >
        {/* Notifications shortcut */}
        <Link
          href="/notifications"
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 w-full transition-all duration-200',
            'text-sm font-medium text-[var(--color-text-secondary)]',
            'hover:bg-white/[0.06] hover:text-[var(--color-text)]',
            collapsed && 'justify-center px-0 py-3'
          )}
          aria-label="Notifications"
        >
          <span className="relative flex-shrink-0">
            <Bell size={20} weight="regular" className="transition-colors duration-200 group-hover:text-[var(--color-text)]" />
            {collapsed && unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-surface)]"
                style={{ background: 'var(--color-error)' }}
              />
            )}
          </span>
          {!collapsed && <span className="flex-1 truncate leading-none">Notifications</span>}
          {!collapsed && unreadCount > 0 && (
            <span
              className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
              style={{ background: 'var(--color-error)', color: 'var(--color-white)' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User profile row */}
        <Link
          href="/settings/profile"
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200',
            'hover:bg-white/[0.06]',
            collapsed && 'justify-center px-0 py-3'
          )}
        >
          {/* Avatar */}
          {currentUser?.avatar ? (
            <img
              src={currentUser.avatar}
              alt={userName}
              className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-end) 100%)',
                color: 'var(--color-bg)',
              }}
              aria-hidden="true"
            >
              {userInitial}
            </div>
          )}

          {/* Name + handle */}
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium leading-tight text-[var(--color-text)]">
                {userName}
              </span>
              <span className="truncate text-xs leading-tight text-[var(--color-text-secondary)]">
                View profile
              </span>
            </div>
          )}
        </Link>

        {/* Sign out */}
        <button
          type="button"
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2.5 w-full transition-all duration-200',
            'text-sm font-medium text-[var(--color-text-secondary)]',
            'hover:bg-red-500/10 hover:text-red-400',
            collapsed && 'justify-center px-0 py-3'
          )}
          aria-label="Sign out"
          onClick={async () => {
            await signOut();
            router.push('/login');
          }}
        >
          <SignOut size={20} weight="regular" className="flex-shrink-0 transition-colors duration-200" />
          {!collapsed && <span className="truncate leading-none">Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
