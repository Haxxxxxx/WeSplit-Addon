import { Users, Wallet } from '@phosphor-icons/react';
import type { SharedWallet } from '../types';

interface SharedWalletCardProps {
  wallet: SharedWallet;
  onClick?: () => void;
}

export function SharedWalletCard({ wallet, onClick }: SharedWalletCardProps) {
  const activeMembers = wallet.members.filter((m) => m.status === 'active').length;

  // Default color if none specified
  const accentColor = wallet.customColor || '#22c55e';

  return (
    <button
      onClick={onClick}
      className="w-full glass-card p-3 text-left hover:bg-white10 transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Wallet icon with custom color */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          {wallet.customLogo ? (
            <img
              src={wallet.customLogo}
              alt={wallet.name}
              className="w-6 h-6 rounded-md object-cover"
            />
          ) : (
            <Wallet size={20} style={{ color: accentColor }} />
          )}
        </div>

        {/* Wallet info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium font-satoshi truncate">{wallet.name}</p>
            {wallet.status !== 'active' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-white10 text-white50 capitalize">
                {wallet.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-white50 font-satoshi">
            <Users size={12} />
            <span>{activeMembers} member{activeMembers !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Balance */}
        <div className="text-right">
          <p className="font-medium font-archivo text-green">
            ${wallet.totalBalance.toFixed(2)}
          </p>
          <p className="text-xs text-white50 font-satoshi">{wallet.currency}</p>
        </div>
      </div>
    </button>
  );
}
