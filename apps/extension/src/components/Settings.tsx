import {
  Wallet,
  Globe,
  Bell,
  Shield,
  Info,
  CaretRight,
  Copy,
  Check,
  SignOut,
  User,
  Link,
  Star,
  Envelope,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { useStore } from '../store';
import {
  shortenAddress,
  disconnectWallet as disconnect,
  connectWallet,
  getBalances,
  getAvailableWallets,
} from '../services/wallet';
import { authService } from '../services/auth';
import type { WalletProvider } from '../types';

export function Settings() {
  const { wallet, user, authMethod, disconnectWallet, setWallet, clearUser } = useStore();
  const [copied, setCopied] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [showWalletLink, setShowWalletLink] = useState(false);

  const handleCopyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    await disconnect(wallet.provider);
    await authService.signOut();
    clearUser();
    disconnectWallet();
  };

  const handleLinkWallet = async (providerId: string) => {
    setLinkingWallet(true);
    try {
      const result = await connectWallet(providerId as WalletProvider);
      if (result) {
        // Update wallet state
        const balances = await getBalances(result.address);
        setWallet({
          isConnected: true,
          address: result.address,
          balance: balances.sol,
          usdcBalance: balances.usdc,
          provider: result.provider,
        });

        // Link wallet to user account
        if (user) {
          await authService.linkWallet(result.address);
        }

        localStorage.setItem('wesplit_wallet_provider', result.provider);
        setShowWalletLink(false);
      }
    } catch (error) {
      console.error('Failed to link wallet:', error);
    } finally {
      setLinkingWallet(false);
    }
  };

  const openSolscan = () => {
    if (wallet.address) {
      window.open(`https://solscan.io/account/${wallet.address}`, '_blank');
    }
  };

  const detectedWallets = getAvailableWallets().filter((w) => w.detected);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4 font-archivo">Settings</h2>

      {/* User Account Info (if logged in with account) */}
      {user && (authMethod === 'email' || authMethod === 'google' || authMethod === 'passkey' || authMethod === 'qr' || authMethod === 'phantom') && (
        <div className="glass-card p-4 mb-4 border-green/30">
          <div className="flex items-center gap-3 mb-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                <User size={24} className="text-black" />
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold font-satoshi">{user.name}</p>
              <p className="text-sm text-white50 font-satoshi flex items-center gap-1">
                <Envelope size={12} />
                {user.email}
              </p>
            </div>
            {user.emailVerified && (
              <Check size={16} className="text-green" weight="bold" />
            )}
          </div>

          {/* Points/Rewards */}
          {(user.points !== undefined || user.total_points_earned !== undefined) && (
            <div className="flex items-center justify-between py-2 border-t border-white10">
              <span className="text-white70 font-satoshi flex items-center gap-1">
                <Star size={14} className="text-warning" weight="fill" />
                Reward Points
              </span>
              <span className="font-archivo text-green">{user.points || 0}</span>
            </div>
          )}

          <p className="text-xs text-green mt-2 font-satoshi flex items-center gap-1">
            <Check size={12} weight="bold" />
            {authMethod === 'phantom' ? 'Signed in with Phantom' : 'Synced with mobile app'}
          </p>
        </div>
      )}

      {/* Wallet Info */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
            <Wallet size={24} className="text-black" />
          </div>
          <div className="flex-1">
            <p className="font-semibold capitalize font-satoshi">
              {wallet.provider !== 'none' ? `${wallet.provider} Wallet` : 'Wallet'}
            </p>
            <p className="text-sm text-white50 font-satoshi">
              {wallet.isConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>

        {wallet.isConnected && wallet.address ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-t border-white10">
              <span className="text-white70 font-satoshi">Address</span>
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-1 text-sm text-white hover:text-green transition-all font-satoshi"
              >
                {shortenAddress(wallet.address)}
                {copied ? (
                  <Check size={14} className="text-green" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-white10">
              <span className="text-white70 font-satoshi">SOL Balance</span>
              <span className="font-archivo">{wallet.balance.toFixed(4)} SOL</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-white10">
              <span className="text-white70 font-satoshi">USDC Balance</span>
              <span className="font-archivo">${wallet.usdcBalance.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-white10">
            <p className="text-white50 text-sm mb-3 font-satoshi">
              Link a wallet to send and receive crypto
            </p>
            <button
              onClick={() => setShowWalletLink(!showWalletLink)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-green/20 text-green rounded-lg hover:bg-green/30 transition-all font-satoshi text-sm"
            >
              <Link size={16} />
              Link Wallet
            </button>

            {/* Wallet Link Options */}
            {showWalletLink && (
              <div className="mt-3 space-y-2">
                {detectedWallets.length > 0 ? (
                  detectedWallets.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleLinkWallet(w.id)}
                      disabled={linkingWallet}
                      className="w-full flex items-center gap-3 p-3 bg-white5 rounded-lg hover:bg-white10 transition-all disabled:opacity-50"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: w.color }}
                      >
                        <Wallet size={16} className="text-white" />
                      </div>
                      <span className="font-satoshi text-sm">{w.name}</span>
                      {linkingWallet && (
                        <div className="ml-auto w-4 h-4 border-2 border-green border-t-transparent rounded-full animate-spin" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-white50 text-xs text-center font-satoshi">
                    No wallets detected. Install Phantom or another Solana wallet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings Options */}
      <div className="glass-card overflow-hidden mb-4">
        <button
          onClick={openSolscan}
          className="w-full flex items-center gap-3 p-4 hover:bg-white10 transition-all text-left"
        >
          <Globe size={20} className="text-white70" />
          <span className="flex-1 font-satoshi">View on Solscan</span>
          <CaretRight size={18} className="text-white50" />
        </button>

        <button className="w-full flex items-center gap-3 p-4 hover:bg-white10 transition-all text-left border-t border-white10">
          <Bell size={20} className="text-white70" />
          <span className="flex-1 font-satoshi">Notifications</span>
          <CaretRight size={18} className="text-white50" />
        </button>

        <button className="w-full flex items-center gap-3 p-4 hover:bg-white10 transition-all text-left border-t border-white10">
          <Shield size={20} className="text-white70" />
          <span className="flex-1 font-satoshi">Security</span>
          <CaretRight size={18} className="text-white50" />
        </button>
      </div>

      {/* About */}
      <div className="glass-card overflow-hidden mb-4">
        <button className="w-full flex items-center gap-3 p-4 hover:bg-white10 transition-all text-left">
          <Info size={20} className="text-white70" />
          <span className="flex-1 font-satoshi">About WeSplit</span>
          <span className="text-white50 text-sm font-satoshi">v1.0.0</span>
        </button>
      </div>

      {/* Network Info */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-white50 font-satoshi">Network</span>
          <span className="text-sm font-medium flex items-center gap-1 font-satoshi">
            <span className="w-2 h-2 bg-green rounded-full" />
            Solana Mainnet
          </span>
        </div>
        <p className="text-xs text-white50 font-satoshi">
          All transactions are processed on Solana mainnet
        </p>
      </div>

      {/* Disconnect */}
      <button
        onClick={handleDisconnect}
        className="w-full flex items-center justify-center gap-2 p-4 bg-error/10 hover:bg-error/20 text-error rounded-xl transition-all"
      >
        <SignOut size={20} />
        <span className="font-medium font-satoshi">Disconnect Wallet</span>
      </button>

      {/* Footer */}
      <div className="text-center mt-6">
        <p className="text-xs text-white50 font-satoshi">
          Made with love by the WeSplit team
        </p>
        <p className="text-xs text-white50 mt-1 font-satoshi">
          © 2024 WeSplit. All rights reserved.
        </p>
      </div>
    </div>
  );
}
