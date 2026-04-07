/**
 * AppNav Component
 *
 * Horizontal tab navigation for the main app views.
 * Shows different tabs based on authentication method.
 */

import {
  House,
  PaperPlaneRight,
  HandCoins,
  Wallet,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { useStore } from '../store';
import type { View } from '../types';

interface NavItem {
  id: View;
  label: string;
  icon: typeof House;
  requiresAccount?: boolean; // Only show for WeSplit account users
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: House },
  { id: 'send', label: 'Send', icon: PaperPlaneRight },
  { id: 'request', label: 'Request', icon: HandCoins, requiresAccount: true },
  { id: 'sharedWallets', label: 'Wallets', icon: Wallet, requiresAccount: true },
  { id: 'history', label: 'History', icon: ClockCounterClockwise },
];

export function AppNav() {
  const { currentView, setView, authMethod, user } = useStore();

  // Check if user is a WeSplit account user (not just wallet-only)
  const isWeSplitUser = user && (
    authMethod === 'qr' ||
    authMethod === 'email' ||
    authMethod === 'passkey' ||
    authMethod === 'phantom'
  );

  // Filter nav items based on user type
  const visibleNavItems = navItems.filter(item => {
    if (item.requiresAccount) {
      return isWeSplitUser;
    }
    return true;
  });

  return (
    <nav className="flex items-center bg-white5 border-b border-white10 overflow-x-auto scrollbar-hide">
      <div className="flex items-center px-2 min-w-max">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? 'text-green border-green'
                  : 'text-white50 border-transparent hover:text-white70 hover:bg-white5'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
              <span className="font-satoshi">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
