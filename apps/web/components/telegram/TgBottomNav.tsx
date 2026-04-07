'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  Wallet,
  AddressBook,
  Star,
  GearSix,
} from '@phosphor-icons/react';

// ---------------------------------------------------------------------------
// Tab routes where the bottom nav is visible
// ---------------------------------------------------------------------------

const TAB_ROUTES = ['/tg', '/tg/wallets', '/tg/contacts', '/tg/rewards', '/tg/settings'] as const;

interface TabItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const TABS: TabItem[] = [
  { label: 'Home',     href: '/tg',          icon: House },
  { label: 'Wallets',  href: '/tg/wallets',  icon: Wallet },
  { label: 'Contacts', href: '/tg/contacts',  icon: AddressBook },
  { label: 'Rewards',  href: '/tg/rewards',  icon: Star },
  { label: 'Settings', href: '/tg/settings',  icon: GearSix },
];

// ---------------------------------------------------------------------------
// Visibility helper — only show nav on top-level tab routes
// ---------------------------------------------------------------------------

export function shouldShowBottomNav(pathname: string): boolean {
  return TAB_ROUTES.some((route) =>
    route === '/tg' ? pathname === '/tg' : pathname === route,
  );
}

// ---------------------------------------------------------------------------
// TgBottomNav
// ---------------------------------------------------------------------------

export default function TgBottomNav() {
  const pathname = usePathname();

  if (!shouldShowBottomNav(pathname)) return null;

  function isActive(href: string): boolean {
    if (href === '/tg') return pathname === '/tg';
    return pathname === href;
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex items-stretch border-t backdrop-blur-xl"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-bg) 85%, transparent)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-label="Main navigation"
    >
      <ul className="flex flex-1 items-center" role="list">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);

          return (
            <li key={tab.href} className="flex flex-1 items-center justify-center">
              <Link
                href={tab.href}
                aria-label={tab.label}
                className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 outline-none transition-all duration-150 active:scale-95"
              >
                <Icon
                  size={22}
                  weight={active ? 'fill' : 'regular'}
                  className="transition-colors duration-150"
                  style={{
                    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  }}
                />
                <span
                  className="text-[10px] font-medium leading-none transition-colors duration-150"
                  style={{
                    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
