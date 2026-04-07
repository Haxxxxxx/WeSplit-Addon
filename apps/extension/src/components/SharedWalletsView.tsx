import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Users,
  ArrowsClockwise,
  Copy,
  Check,
  CaretRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Warning,
  User,
  Crown,
  ShieldCheck,
} from '@phosphor-icons/react';
import { useStore } from '../store';
import { sharedWalletService } from '../services/sharedWallets';
import { shortenAddress } from '../services/wallet';
import type { SharedWallet } from '../types';
import { logger } from '../utils/logger';

type ViewState = 'list' | 'detail';

export function SharedWalletsView() {
  const { user, sharedWallets, sharedWalletsLoading, setSharedWallets, setSharedWalletsLoading } = useStore();

  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedWallet, setSelectedWallet] = useState<SharedWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch shared wallets
  const fetchWallets = useCallback(async () => {
    if (!user?.id) {
      logger.log('[SharedWalletsView] No user ID available');
      return;
    }

    setSharedWalletsLoading(true);
    setError(null);

    try {
      logger.log('[SharedWalletsView] Fetching wallets for user:', user.id);
      const wallets = await sharedWalletService.getUserSharedWallets(user.id);
      logger.log('[SharedWalletsView] Fetched wallets:', wallets.length);
      setSharedWallets(wallets);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load shared wallets';
      logger.error('[SharedWalletsView] Error fetching wallets:', err);
      setError(message);
    } finally {
      setSharedWalletsLoading(false);
    }
  }, [user?.id, setSharedWallets, setSharedWalletsLoading]);

  // Initial fetch
  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // Copy wallet address
  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'creator':
        return <Crown size={12} className="text-yellow-400" weight="fill" />;
      case 'admin':
        return <ShieldCheck size={12} className="text-blue-400" weight="fill" />;
      default:
        return <User size={12} className="text-white50" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green/20 text-green';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'archived':
        return 'bg-white20 text-white50';
      default:
        return 'bg-white10 text-white50';
    }
  };

  // Detail View
  if (viewState === 'detail' && selectedWallet) {
    const activeMembers = selectedWallet.members.filter((m) => m.status === 'active');
    const invitedMembers = selectedWallet.members.filter((m) => m.status === 'invited');
    const accentColor = selectedWallet.customColor || '#22c55e';
    const isCreator = user?.id === selectedWallet.creatorId;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-white10">
          <button
            onClick={() => {
              setViewState('list');
              setSelectedWallet(null);
            }}
            className="flex items-center gap-1.5 text-white50 hover:text-white text-sm transition-all font-satoshi"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Wallet Header */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              {selectedWallet.customLogo ? (
                <img
                  src={selectedWallet.customLogo}
                  alt={selectedWallet.name}
                  className="w-7 h-7 rounded-lg object-cover"
                />
              ) : (
                <Wallet size={24} style={{ color: accentColor }} weight="duotone" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-archivo truncate">{selectedWallet.name}</h2>
                {isCreator && (
                  <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                    <Crown size={10} weight="fill" />
                    Creator
                  </span>
                )}
              </div>
              {selectedWallet.description && (
                <p className="text-sm text-white50 font-satoshi mt-0.5 line-clamp-2">
                  {selectedWallet.description}
                </p>
              )}
              <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(selectedWallet.status)}`}>
                {selectedWallet.status}
              </span>
            </div>
          </div>

          {/* Balance Card */}
          <div className="glass-card p-4 mb-4" style={{ borderColor: `${accentColor}30` }}>
            <p className="text-sm text-white50 font-satoshi mb-1">Total Balance</p>
            <p className="text-2xl font-bold font-archivo gradient-text">
              ${selectedWallet.totalBalance.toFixed(2)}
            </p>
            <p className="text-xs text-white50 font-satoshi">{selectedWallet.currency}</p>

            {/* Wallet Address */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white10">
              <span className="text-xs text-white50 font-satoshi">Wallet:</span>
              <code className="text-xs text-white70 font-mono bg-white5 px-2 py-1 rounded">
                {shortenAddress(selectedWallet.walletAddress)}
              </code>
              <button
                onClick={() => handleCopy(selectedWallet.walletAddress)}
                className="p-1 hover:bg-white10 rounded transition-all"
                title="Copy address"
              >
                {copied ? (
                  <Check size={14} className="text-green" />
                ) : (
                  <Copy size={14} className="text-white50" />
                )}
              </button>
            </div>
          </div>

          {/* Members Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold font-archivo">
                Members ({activeMembers.length})
              </h3>
            </div>

            <div className="space-y-2">
              {activeMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 glass-card p-3"
                >
                  <div className="w-9 h-9 rounded-full bg-white10 flex items-center justify-center">
                    <span className="text-sm font-medium font-satoshi">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium font-satoshi text-sm truncate">{member.name}</p>
                      {getRoleIcon(member.role)}
                      {member.userId === user?.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green/20 text-green">You</span>
                      )}
                    </div>
                    <p className="text-xs text-white50 font-satoshi">
                      {member.walletAddress ? shortenAddress(member.walletAddress) : 'No wallet'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-green">
                      <ArrowUp size={10} />
                      <span>${member.totalContributed.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-white50">
                      <ArrowDown size={10} />
                      <span>${member.totalWithdrawn.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Invited Members */}
            {invitedMembers.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-white50 font-satoshi mb-2">
                  Pending Invitations ({invitedMembers.length})
                </p>
                <div className="space-y-2">
                  {invitedMembers.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-3 glass-card p-2.5 opacity-60"
                    >
                      <div className="w-8 h-8 rounded-full bg-white10 flex items-center justify-center">
                        <span className="text-xs font-medium font-satoshi">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium font-satoshi text-sm truncate">{member.name}</p>
                        <p className="text-xs text-yellow-400 font-satoshi">Invited</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Created Info */}
          <div className="text-xs text-white30 font-satoshi text-center pt-2 border-t border-white5">
            Created by {selectedWallet.creatorName} on{' '}
            {new Date(selectedWallet.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white10">
        <h2 className="text-lg font-bold font-archivo">Shared Wallets</h2>
        <button
          onClick={fetchWallets}
          disabled={sharedWalletsLoading}
          className="p-2 hover:bg-white10 rounded-lg transition-all disabled:opacity-50"
          title="Refresh"
        >
          <ArrowsClockwise
            size={18}
            className={`text-white70 ${sharedWalletsLoading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Error State */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-lg mb-4">
            <Warning size={18} className="text-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-error text-sm font-satoshi">{error}</p>
              <button
                onClick={fetchWallets}
                className="text-xs text-error/70 hover:text-error underline mt-1 font-satoshi"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {sharedWalletsLoading && sharedWallets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white50 text-sm font-satoshi">Loading wallets...</p>
          </div>
        )}

        {/* Empty State */}
        {!sharedWalletsLoading && sharedWallets.length === 0 && !error && (
          <div className="text-center py-12 glass-card">
            <div className="w-16 h-16 rounded-full bg-white10 flex items-center justify-center mx-auto mb-4">
              <Wallet size={28} className="text-white50" />
            </div>
            <p className="text-white70 mb-1 font-satoshi">No shared wallets yet</p>
            <p className="text-white50 text-sm mb-4 font-satoshi max-w-[200px] mx-auto">
              Create a shared wallet in the mobile app to see it here
            </p>
          </div>
        )}

        {/* Wallet List */}
        {sharedWallets.length > 0 && (
          <div className="space-y-2">
            {sharedWallets.map((wallet) => {
              const activeMembers = wallet.members.filter((m) => m.status === 'active').length;
              const accentColor = wallet.customColor || '#22c55e';
              const isCreator = user?.id === wallet.creatorId;

              return (
                <button
                  key={wallet.id}
                  onClick={() => {
                    setSelectedWallet(wallet);
                    setViewState('detail');
                  }}
                  className="w-full glass-card p-3 text-left hover:bg-white10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {/* Wallet Icon */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${accentColor}20` }}
                    >
                      {wallet.customLogo ? (
                        <img
                          src={wallet.customLogo}
                          alt={wallet.name}
                          className="w-6 h-6 rounded-md object-cover"
                        />
                      ) : (
                        <Wallet size={22} style={{ color: accentColor }} weight="duotone" />
                      )}
                    </div>

                    {/* Wallet Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium font-satoshi truncate">{wallet.name}</p>
                        {isCreator && (
                          <Crown size={12} className="text-yellow-400 flex-shrink-0" weight="fill" />
                        )}
                        {wallet.status !== 'active' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${getStatusColor(wallet.status)}`}>
                            {wallet.status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white50 font-satoshi">
                        <Users size={12} />
                        <span>{activeMembers} member{activeMembers !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Balance & Arrow */}
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="font-medium font-archivo text-green">
                          ${wallet.totalBalance.toFixed(2)}
                        </p>
                        <p className="text-xs text-white50 font-satoshi">{wallet.currency}</p>
                      </div>
                      <CaretRight size={16} className="text-white30 group-hover:text-white50 transition-all" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white5">
        <p className="text-white30 text-[10px] text-center font-satoshi">
          Manage shared wallets in the WeSplit mobile app
        </p>
      </div>
    </div>
  );
}
