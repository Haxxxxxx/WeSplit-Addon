import { useState, useEffect } from 'react';
import {
  Wallet,
  Ghost,
  Fire,
  Lightning,
  Cube,
  ShieldCheck,
  Compass,
  CheckCircle,
  ArrowSquareOut,
  ArrowLeft,
  User,
} from '@phosphor-icons/react';
import { useStore } from '../store';
import {
  connectWallet,
  getBalances,
  getAvailableWallets,
  autoReconnect,
} from '../services/wallet';
import { authService } from '../services/auth';
import { isFirebaseConfigured } from '../config/firebase';
import { AuthLogin } from './AuthLogin';
import type { WalletProvider, WalletInfo, UserProfile } from '../types';

type ConnectMode = 'choose' | 'wallet' | 'account';

function WalletIcon({ wallet }: { wallet: WalletInfo }) {
  const iconProps = { size: 24, weight: 'fill' as const, className: 'text-white' };

  switch (wallet.id) {
    case 'phantom':
      return <Ghost {...iconProps} />;
    case 'solflare':
      return <Fire {...iconProps} />;
    case 'backpack':
      return <Cube {...iconProps} />;
    case 'glow':
      return <Lightning {...iconProps} />;
    case 'coinbase':
      return <Wallet {...iconProps} />;
    case 'trust':
      return <ShieldCheck {...iconProps} />;
    case 'exodus':
      return <Compass {...iconProps} />;
    case 'brave':
      return <ShieldCheck {...iconProps} />;
    default:
      return <Wallet {...iconProps} />;
  }
}

export function ConnectWallet() {
  const { setWallet, setUser, setLoading, setError, isLoading } = useStore();
  const [mode, setMode] = useState<ConnectMode>('choose');
  const [selectedProvider, setSelectedProvider] = useState<WalletProvider | null>(null);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const detectWallets = () => {
      const available = getAvailableWallets();
      setWallets(available);
    };

    detectWallets();
    const timeout = setTimeout(detectWallets, 500);
    window.addEventListener('load', detectWallets);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('load', detectWallets);
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      setCheckingSession(true);

      try {
        if (isFirebaseConfigured) {
          const session = await authService.checkSession();
          if (session.user && session.authMethod) {
            const userProfile: UserProfile = {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
              wallet_address: session.user.wallet_address,
              wallet_public_key: session.user.wallet_public_key,
              points: session.user.points,
              avatar: session.user.avatar,
              emailVerified: session.user.emailVerified,
            };
            setUser(userProfile, session.authMethod);

            if (session.user.wallet_address) {
              setWallet({
                isConnected: true,
                address: session.user.wallet_address,
                balance: 0,
                usdcBalance: 0,
                provider: 'none',
              });
              try {
                const balances = await getBalances(session.user.wallet_address);
                setWallet({
                  isConnected: true,
                  address: session.user.wallet_address,
                  balance: balances.sol,
                  usdcBalance: balances.usdc,
                  provider: 'none',
                });
              } catch (error) {
                console.error('Failed to fetch balances for linked wallet:', error);
              }
            }
            setCheckingSession(false);
            return;
          }
        }

        const lastProvider = localStorage.getItem('wesplit_wallet_provider') as WalletProvider;
        if (lastProvider && lastProvider !== 'none') {
          const result = await autoReconnect(lastProvider);
          if (result) {
            const balances = await getBalances(result.address);
            setWallet({
              isConnected: true,
              address: result.address,
              balance: balances.sol,
              usdcBalance: balances.usdc,
              provider: result.provider,
            });
            localStorage.setItem('wesplit_auth_method', 'wallet');
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [setWallet, setUser]);

  const handleConnect = async (provider: WalletProvider) => {
    setSelectedProvider(provider);
    setLoading(true);
    setError(null);
    setConnectionError(null);

    try {
      const result = await connectWallet(provider);

      if (result) {
        localStorage.setItem('wesplit_wallet_provider', provider);
        localStorage.setItem('wesplit_auth_method', 'wallet');

        const balances = await getBalances(result.address);

        setWallet({
          isConnected: true,
          address: result.address,
          balance: balances.sol,
          usdcBalance: balances.usdc,
          provider: result.provider,
        });

        if (isFirebaseConfigured) {
          const existingUser = await authService.findAccountByWallet(result.address);
          if (existingUser) {
            const userProfile: UserProfile = {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              wallet_address: existingUser.wallet_address,
              points: existingUser.points,
              avatar: existingUser.avatar,
            };
            setUser(userProfile, 'wallet');
          }
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setConnectionError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setSelectedProvider(null);
    }
  };

  const detectedWallets = wallets.filter((w) => w.detected);
  const otherWallets = wallets.filter((w) => !w.detected);

  // Loading state
  if (checkingSession) {
    return (
      <div className="flex flex-col h-[600px] bg-bg items-center justify-center">
        <img
          src="/images/icon-app-wesplit.png"
          alt="WeSplit"
          className="w-14 h-14 rounded-2xl mb-3"
        />
        <div className="w-5 h-5 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Account login mode
  if (mode === 'account') {
    return (
      <div className="flex flex-col h-[600px] bg-bg">
        <AuthLogin
          onWalletConnect={() => setMode('wallet')}
          onBack={() => setMode('choose')}
        />
      </div>
    );
  }

  // Wallet connection mode
  if (mode === 'wallet') {
    return (
      <div className="flex flex-col h-[600px] bg-bg">
        {/* Header */}
        <div className="px-4 pt-3 pb-2">
          <button
            onClick={() => setMode('choose')}
            className="flex items-center gap-1.5 text-white50 hover:text-white text-sm transition-all font-satoshi"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 pb-4 overflow-y-auto">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold font-archivo">Connect Wallet</h2>
            <p className="text-white50 text-xs mt-0.5 font-satoshi">
              Select your Solana wallet
            </p>
          </div>

          {connectionError && (
            <div className="mb-3 p-2.5 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-error text-xs font-satoshi">{connectionError}</p>
            </div>
          )}

          {/* Detected Wallets */}
          {detectedWallets.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-white30 mb-2 font-satoshi uppercase tracking-wider">
                Detected
              </p>
              <div className="space-y-2">
                {detectedWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => handleConnect(wallet.id)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-3 bg-white5 border border-white10 rounded-xl hover:border-green/30 transition-all disabled:opacity-50"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <WalletIcon wallet={wallet} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm font-satoshi">{wallet.name}</p>
                      <p className="text-[10px] text-green font-satoshi">Ready</p>
                    </div>
                    {selectedProvider === wallet.id && isLoading && (
                      <div className="w-4 h-4 border-2 border-green border-t-transparent rounded-full animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Other Wallets */}
          {otherWallets.length > 0 && (
            <div>
              <p className="text-[10px] text-white30 mb-2 font-satoshi uppercase tracking-wider">
                {detectedWallets.length > 0 ? 'Other' : 'Available'}
              </p>
              <div className="space-y-2">
                {otherWallets.slice(0, 4).map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => handleConnect(wallet.id)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-3 bg-white5 border border-white10 rounded-xl opacity-60 hover:opacity-80 transition-all disabled:opacity-40"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center opacity-70"
                      style={{ backgroundColor: wallet.color }}
                    >
                      <WalletIcon wallet={wallet} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm text-white70 font-satoshi">{wallet.name}</p>
                      <p className="text-[10px] text-white30 font-satoshi">Install</p>
                    </div>
                    <ArrowSquareOut size={14} className="text-white30" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {wallets.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div className="w-12 h-12 rounded-full bg-white10 flex items-center justify-center mb-3">
                <Wallet size={24} className="text-white50" />
              </div>
              <p className="text-white70 text-sm mb-1 font-satoshi">No wallets found</p>
              <p className="text-white50 text-xs mb-4 font-satoshi">
                Install a Solana wallet to continue
              </p>
              <a
                href="https://phantom.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm !py-2.5 !px-5"
              >
                Get Phantom
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Choose mode (landing page)
  return (
    <div className="flex flex-col h-[600px] bg-bg">
      {/* Logo Section */}
      <div className="flex-none pt-10 pb-6 text-center">
        <img
          src="/images/icon-app-wesplit.png"
          alt="WeSplit"
          className="w-16 h-16 rounded-2xl mx-auto mb-3"
        />
        <h1 className="text-xl font-bold font-archivo gradient-text">WeSplit</h1>
        <p className="text-white50 text-xs mt-1 font-satoshi">Split expenses with crypto</p>
      </div>

      {/* Connection Options */}
      <div className="flex-1 px-5 overflow-y-auto">
        <div className="space-y-2.5">
          {/* Account Login */}
          {isFirebaseConfigured && (
            <button
              onClick={() => setMode('account')}
              className="w-full flex items-center gap-3 p-3.5 bg-white5 border border-green/20 rounded-xl hover:border-green/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <User size={20} className="text-black" weight="bold" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm font-satoshi">Sign in with Account</p>
                <p className="text-[10px] text-white50 font-satoshi">
                  Sync with mobile app
                </p>
              </div>
              <div className="px-2 py-0.5 bg-green/20 rounded-full">
                <span className="text-[10px] text-green font-satoshi font-medium">Recommended</span>
              </div>
            </button>
          )}

          {/* Wallet Connect */}
          <button
            onClick={() => setMode('wallet')}
            className="w-full flex items-center gap-3 p-3.5 bg-white5 border border-white10 rounded-xl hover:border-white20 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-white10 flex items-center justify-center">
              <Wallet size={20} className="text-green" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-sm font-satoshi">Connect Wallet</p>
              <p className="text-[10px] text-white50 font-satoshi">
                Phantom, Solflare, Backpack...
              </p>
            </div>
            {detectedWallets.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-white10 rounded-full">
                <CheckCircle size={10} className="text-green" weight="fill" />
                <span className="text-[10px] text-white50 font-satoshi">{detectedWallets.length}</span>
              </div>
            )}
          </button>
        </div>

        {/* Quick Connect */}
        {detectedWallets.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] text-white30 text-center mb-2.5 font-satoshi uppercase tracking-wider">
              Quick connect
            </p>
            <div className="flex justify-center gap-2">
              {detectedWallets.slice(0, 4).map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => handleConnect(wallet.id)}
                  disabled={isLoading}
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
                  style={{ backgroundColor: wallet.color }}
                  title={wallet.name}
                >
                  <WalletIcon wallet={wallet} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mt-6 space-y-2">
          {[
            'Send & receive crypto instantly',
            'Split bills with friends',
            'Track all your transactions',
          ].map((text) => (
            <div key={text} className="flex items-center gap-2.5 px-3 py-2 bg-white5 rounded-lg">
              <CheckCircle size={14} className="text-green" weight="fill" />
              <span className="text-xs text-white60 font-satoshi">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-none px-5 py-3 border-t border-white5">
        <p className="text-white30 text-[10px] text-center font-satoshi">
          Powered by Solana
        </p>
      </div>
    </div>
  );
}
