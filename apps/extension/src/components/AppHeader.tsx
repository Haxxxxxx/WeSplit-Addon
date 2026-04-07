/**
 * AppHeader Component
 *
 * Main application header shown after authentication.
 * Displays: Logo, User info, Settings, and Sign out button.
 */

import { Gear, SignOut, User } from '@phosphor-icons/react';
import { useStore, AuthMethod } from '../store';
import { shortenAddress, disconnectWallet as disconnect } from '../services/wallet';
import { authService } from '../services/auth';

export function AppHeader() {
  const { wallet, user, authMethod, setView, disconnectWallet, clearUser, currentView } = useStore();

  const handleDisconnect = async () => {
    await disconnect(wallet.provider);
    await authService.signOut();
    clearUser();
    disconnectWallet();
  };

  // Check if user is authenticated via WeSplit account (not just wallet)
  const isAccountAuth = (method: AuthMethod): boolean => {
    return method === 'email' || method === 'google' || method === 'passkey' || method === 'qr' || method === 'phantom';
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white5 border-b border-white10">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img
          src="/images/icon-app-wesplit.png"
          alt="WeSplit"
          className="w-8 h-8 rounded-lg"
        />
        <span className="font-bold text-lg font-archivo gradient-text">WeSplit</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* User info */}
        {user && authMethod && isAccountAuth(authMethod) ? (
          <button
            onClick={() => setView('settings')}
            className="flex items-center gap-1.5 bg-white10 px-2 py-1 rounded-lg hover:bg-white20 transition-all"
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <User size={14} className="text-green" weight="bold" />
            )}
            <span className="text-white text-xs font-satoshi max-w-[80px] truncate">
              {user.name}
            </span>
          </button>
        ) : wallet.address ? (
          <span className="text-white50 text-xs bg-white10 px-2 py-1 rounded-lg">
            {shortenAddress(wallet.address)}
          </span>
        ) : null}

        {/* Settings */}
        <button
          onClick={() => setView('settings')}
          className={`p-2 rounded-lg transition-all ${
            currentView === 'settings' ? 'bg-green10 text-green' : 'hover:bg-white10 text-white70'
          }`}
          aria-label="Settings"
        >
          <Gear size={18} />
        </button>

        {/* Sign out */}
        <button
          onClick={handleDisconnect}
          className="p-2 hover:bg-white10 rounded-lg transition-all text-white70"
          title="Sign out"
          aria-label="Sign out"
        >
          <SignOut size={18} />
        </button>
      </div>
    </header>
  );
}
