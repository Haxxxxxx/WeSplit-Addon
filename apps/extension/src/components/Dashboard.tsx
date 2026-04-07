import { useEffect, useState, useCallback } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  ArrowsClockwise,
  Wallet,
} from '@phosphor-icons/react';
import { useStore } from '../store';
import { getBalances, shortenAddress } from '../services/wallet';
import { sharedWalletService } from '../services/sharedWallets';
import { SharedWalletCard } from './SharedWalletCard';
import { appConfig } from '../config/app';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  icon: string;
}

export function Dashboard() {
  const {
    wallet,
    setWallet,
    setView,
    transactions,
    splits,
    user,
    sharedWallets,
    sharedWalletsLoading,
    setSharedWallets,
    setSharedWalletsLoading,
  } = useStore();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('USDC');

  // Token balances
  const tokens: TokenBalance[] = [
    { symbol: 'SOL', name: 'Solana', balance: wallet.balance, icon: '◎' },
    { symbol: 'USDC', name: 'USD Coin', balance: wallet.usdcBalance, icon: '$' },
  ];

  const refreshBalances = useCallback(async () => {
    if (!wallet.address) return;
    setRefreshing(true);
    try {
      const balances = await getBalances(wallet.address, true);
      setWallet({
        balance: balances.sol,
        usdcBalance: balances.usdc,
      });
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    } finally {
      setRefreshing(false);
    }
  }, [wallet.address, setWallet]);

  useEffect(() => {
    if (wallet.address) {
      refreshBalances();
    }
  }, [wallet.address, refreshBalances]);

  // Load shared wallets when user changes
  useEffect(() => {
    async function loadSharedWallets() {
      if (!user?.id) {
        setSharedWallets([]);
        return;
      }

      setSharedWalletsLoading(true);
      try {
        const wallets = await sharedWalletService.getUserSharedWallets(user.id);
        setSharedWallets(wallets);
      } catch (error) {
        console.error('Failed to load shared wallets:', error);
      } finally {
        setSharedWalletsLoading(false);
      }
    }

    loadSharedWallets();
  }, [user?.id, setSharedWallets, setSharedWalletsLoading]);

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeSplits = splits.filter((s) => s.status === 'active');
  const recentTransactions = transactions.slice(0, 3);

  // Calculate total USD value (using fallback price)
  // TODO: Fetch real-time SOL price from API endpoint
  const solPriceUsd = appConfig.solPriceUsd.fallback;
  const totalUsdValue = wallet.usdcBalance + (wallet.balance * solPriceUsd);

  return (
    <div className="p-4 space-y-4">
      {/* Balance Card */}
      <div className="glass-card p-4 border-green/30 relative overflow-hidden">
        {/* Gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />

        <div className="flex items-center justify-between mb-3">
          <span className="text-white70 text-sm font-satoshi">Portfolio Value</span>
          <button
            onClick={refreshBalances}
            disabled={refreshing}
            className="p-1.5 hover:bg-white10 rounded-lg transition-all"
          >
            <ArrowsClockwise
              size={18}
              className={`text-white70 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-3xl font-bold gradient-text font-archivo">
            ${totalUsdValue.toFixed(2)}
          </p>
        </div>

        {/* Token Balances */}
        <div className="space-y-2 mb-4">
          {tokens.map((token) => (
            <button
              key={token.symbol}
              onClick={() => setSelectedToken(token.symbol)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                selectedToken === token.symbol
                  ? 'bg-green/10 border border-green/30'
                  : 'bg-white5 border border-white10 hover:bg-white10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  token.symbol === 'SOL' ? 'bg-purple-500/20' : 'bg-green/20'
                }`}>
                  <span className={`text-sm font-bold ${
                    token.symbol === 'SOL' ? 'text-purple-400' : 'text-green'
                  }`}>
                    {token.icon}
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-medium font-satoshi text-sm">{token.name}</p>
                  <p className="text-white50 text-xs font-satoshi">{token.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium font-archivo">
                  {token.balance.toFixed(token.symbol === 'SOL' ? 4 : 2)}
                </p>
                <p className="text-white50 text-xs font-satoshi">
                  ${token.symbol === 'SOL'
                    ? (token.balance * solPriceUsd).toFixed(2)
                    : token.balance.toFixed(2)
                  }
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Wallet Address */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyAddress}
            className="flex items-center gap-1.5 text-xs text-white50 hover:text-white70 bg-white5 hover:bg-white10 px-3 py-1.5 rounded-lg transition-all border border-white10"
          >
            {wallet.address && shortenAddress(wallet.address, 6)}
            {copied ? (
              <Check size={14} className="text-green" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Shared Wallets */}
      {(sharedWallets.length > 0 || sharedWalletsLoading) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-green" />
              <h3 className="font-semibold font-archivo">Shared Wallets</h3>
            </div>
            {sharedWallets.length > 2 && (
              <button
                onClick={() => setView('sharedWallets')}
                className="text-green text-sm hover:underline font-satoshi"
              >
                View all
              </button>
            )}
          </div>
          {sharedWalletsLoading ? (
            <div className="glass-card p-4 text-center">
              <ArrowsClockwise size={20} className="animate-spin mx-auto text-white50" />
              <p className="text-sm text-white50 mt-2 font-satoshi">Loading wallets...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sharedWallets.slice(0, 3).map((sharedWallet) => (
                <SharedWalletCard
                  key={sharedWallet.id}
                  wallet={sharedWallet}
                  onClick={() => setView('sharedWallets')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setView('send')}
          className="flex flex-col items-center gap-2 p-4 glass-card"
        >
          <div className="icon-container !w-10 !h-10">
            <ArrowUp size={20} className="text-green" />
          </div>
          <span className="text-sm font-medium font-satoshi">Send</span>
        </button>

        <button
          onClick={() => setView('request')}
          className="flex flex-col items-center gap-2 p-4 glass-card"
        >
          <div className="icon-container !w-10 !h-10">
            <ArrowDown size={20} className="text-greenBlue" />
          </div>
          <span className="text-sm font-medium font-satoshi">Request</span>
        </button>

        <button
          onClick={() => setView('sharedWallets')}
          className="flex flex-col items-center gap-2 p-4 glass-card"
        >
          <div className="icon-container !w-10 !h-10">
            <Wallet size={20} className="text-green" />
          </div>
          <span className="text-sm font-medium font-satoshi">Wallets</span>
        </button>
      </div>

      {/* Active Splits */}
      {activeSplits.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold font-archivo">Active Splits</h3>
            <button
              onClick={() => setView('sharedWallets')}
              className="text-green text-sm hover:underline font-satoshi"
            >
              View all
            </button>
          </div>
          <div className="space-y-2">
            {activeSplits.slice(0, 2).map((split) => (
              <div key={split.id} className="glass-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium font-satoshi">{split.name}</span>
                  <span className="text-green text-sm font-medium font-archivo">
                    ${split.total_amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white50 font-satoshi">
                  <span>{split.participants.length} people</span>
                  <span>•</span>
                  <span>
                    {split.participants.filter((p) => p.paid).length}/
                    {split.participants.length} paid
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold font-archivo">Recent Activity</h3>
          {recentTransactions.length > 0 && (
            <button
              onClick={() => setView('history')}
              className="text-green text-sm hover:underline font-satoshi"
            >
              View all
            </button>
          )}
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-6 text-white50 glass-card">
            <p className="text-sm font-satoshi">No recent transactions</p>
            <p className="text-xs mt-1 font-satoshi">
              Start by sending or requesting crypto
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 glass-card p-3"
              >
                <div
                  className={`icon-container !w-9 !h-9 ${
                    tx.type === 'send' || tx.type === 'withdraw'
                      ? '!bg-error/20'
                      : ''
                  }`}
                >
                  {tx.type === 'send' || tx.type === 'withdraw' ? (
                    <ArrowUp size={16} className="text-error" />
                  ) : (
                    <ArrowDown size={16} className="text-green" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize font-satoshi">{tx.type}</p>
                  <p className="text-xs text-white50 font-satoshi">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`font-medium font-archivo ${
                    tx.type === 'send' || tx.type === 'withdraw'
                      ? 'text-error'
                      : 'text-green'
                  }`}
                >
                  {tx.type === 'send' || tx.type === 'withdraw' ? '-' : '+'}
                  {tx.amount.toFixed(tx.currency === 'SOL' ? 4 : 2)} {tx.currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
