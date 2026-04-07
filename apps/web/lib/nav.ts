import {
  House,
  PaperPlaneTilt,
  HandCoins,
  Wallet,
  Divide,
  ClockCounterClockwise,
  AddressBook,
  Trophy,
  GearSix,
} from '@phosphor-icons/react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: House },
  { id: 'send', label: 'Send', href: '/send', icon: PaperPlaneTilt },
  { id: 'request', label: 'Request', href: '/request', icon: HandCoins },
  { id: 'splits', label: 'Splits', href: '/splits', icon: Divide },
  { id: 'wallets', label: 'Shared Wallets', href: '/shared-wallets', icon: Wallet },
  { id: 'transactions', label: 'Transactions', href: '/transactions', icon: ClockCounterClockwise },
  { id: 'contacts', label: 'Contacts', href: '/contacts', icon: AddressBook },
  { id: 'rewards', label: 'Rewards', href: '/rewards', icon: Trophy },
  { id: 'settings', label: 'Settings', href: '/settings', icon: GearSix },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
