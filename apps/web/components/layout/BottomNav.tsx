'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  PaperPlaneTilt,
  Divide,
  Trophy,
  GearSix,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tab item definition
// ---------------------------------------------------------------------------

interface TabItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Renders the Send button as a gradient circle in the center */
  isCta?: boolean;
}

const BOTTOM_NAV_ITEMS: TabItem[] = [
  { label: 'Dashboard', href: '/dashboard',  icon: House },
  { label: 'Splits',    href: '/splits',     icon: Divide },
  { label: 'Send',      href: '/send',       icon: PaperPlaneTilt, isCta: true },
  { label: 'Rewards',   href: '/rewards',    icon: Trophy },
  { label: 'Settings',  href: '/settings',   icon: GearSix },
];

// ---------------------------------------------------------------------------
// BottomNav
// ---------------------------------------------------------------------------

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      className={cn(
        // Positioning — fixed to bottom, full width, above system chrome
        'fixed bottom-0 inset-x-0 z-50',
        // Glass-morphism surface
        'border-t border-[var(--color-border)]',
        'bg-[var(--color-surface)]/80 backdrop-blur-xl',
        // Flex layout
        'flex items-stretch',
        // Safe area padding for devices with home indicator
        'pb-safe'
      )}
      aria-label="Main navigation"
    >
      <ul className="flex flex-1 items-center" role="list">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          if (item.isCta) {
            // Center gradient Send button
            return (
              <li key={item.href} className="flex flex-1 items-center justify-center">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className="group flex flex-col items-center gap-0.5 outline-none"
                >
                  {/* Raised gradient circle */}
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full',
                      'shadow-lg ring-2 ring-[var(--color-bg)]/60',
                      'transition-transform duration-150 active:scale-95 group-hover:scale-105'
                    )}
                    style={{
                      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-end) 100%)',
                      // Lift the button slightly above the bar
                      marginBottom: '16px',
                    }}
                  >
                    <Icon size={22} weight="fill" color="var(--color-bg)" />
                  </span>
                  <span
                    className="text-[10px] font-medium leading-none"
                    style={{
                      // The label sits below the lifted circle, so pull it up
                      marginTop: '-10px',
                      color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex flex-1 items-center justify-center">
              <Link
                href={item.href}
                aria-label={item.label}
                className={cn(
                  'group flex flex-col items-center gap-1 rounded-lg px-3 py-2 outline-none',
                  'transition-all duration-150 active:scale-95'
                )}
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
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
