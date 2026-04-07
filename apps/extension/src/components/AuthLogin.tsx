import { useState, useEffect } from 'react';
import {
  Envelope,
  Key,
  GoogleLogo,
  Wallet,
  ArrowLeft,
  Warning,
  PaperPlaneTilt,
  Fingerprint,
  ShieldCheck,
  QrCode,
  DeviceMobile,
  Lightning,
} from '@phosphor-icons/react';
import { authService } from '../services/auth';
import { phantomAuthService, isPhantomInstalled } from '../services/phantomAuth';
import { useStore } from '../store';
import { isFirebaseConfigured } from '../config/firebase';
import { QRLogin } from './QRLogin';
import type { UserProfile } from '../types';

type AuthStep = 'choose' | 'qr' | 'email' | 'verify' | 'passkey';

interface AuthLoginProps {
  onWalletConnect: () => void;
  onBack?: () => void;
}

export function AuthLogin({ onWalletConnect, onBack }: AuthLoginProps) {
  const { setUser, setWallet } = useStore();

  const [step, setStep] = useState<AuthStep>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [phantomAvailable, setPhantomAvailable] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Check passkey support and phantom availability on mount
  useEffect(() => {
    authService.isPasskeySupported().then(setPasskeySupported);
    setPhantomAvailable(isPhantomInstalled());
  }, []);

  // Countdown timer for resend code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await authService.sendLoginCode(email);
      setStep('verify');
      setCountdown(60);
      // Note: In development, codes are logged to Firebase Functions console
      // In production, codes would be sent via email
      setSuccess('Verification code generated. Check your email or Firebase logs.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send code';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code) return;

    setLoading(true);
    setError(null);

    try {
      const { user } = await authService.verifyLoginCode(email, code);
      if (user) {
        const userProfile: UserProfile = {
          id: user.id,
          name: user.name,
          email: user.email,
          wallet_address: user.wallet_address,
          wallet_public_key: user.wallet_public_key,
          phone: user.phone,
          points: user.points,
          total_points_earned: user.total_points_earned,
          avatar: user.avatar,
          emailVerified: user.emailVerified,
          created_at: user.created_at,
          updated_at: user.updated_at,
          referral_code: user.referral_code,
          badges: user.badges,
        };
        setUser(userProfile, 'email');

        if (user.wallet_address) {
          setWallet({
            isConnected: true,
            address: user.wallet_address,
            balance: 0,
            usdcBalance: 0,
            provider: 'none',
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid code';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyAuth = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { user } = await authService.signInWithPasskey(email);
      if (user) {
        const userProfile: UserProfile = {
          id: user.id,
          name: user.name,
          email: user.email,
          wallet_address: user.wallet_address,
          wallet_public_key: user.wallet_public_key,
          phone: user.phone,
          points: user.points,
          total_points_earned: user.total_points_earned,
          avatar: user.avatar,
          emailVerified: user.emailVerified,
          created_at: user.created_at,
          updated_at: user.updated_at,
          referral_code: user.referral_code,
          badges: user.badges,
        };
        setUser(userProfile, 'passkey');

        if (user.wallet_address) {
          setWallet({
            isConnected: true,
            address: user.wallet_address,
            balance: 0,
            usdcBalance: 0,
            provider: 'none',
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Passkey authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { user } = await authService.signInWithGoogle();
      if (user) {
        const userProfile: UserProfile = {
          id: user.id,
          name: user.name,
          email: user.email,
          wallet_address: user.wallet_address,
          wallet_public_key: user.wallet_public_key,
          avatar: user.avatar,
          points: user.points,
          total_points_earned: user.total_points_earned,
          emailVerified: user.emailVerified,
          created_at: user.created_at,
        };
        setUser(userProfile, 'google');

        if (user.wallet_address) {
          setWallet({
            isConnected: true,
            address: user.wallet_address,
            balance: 0,
            usdcBalance: 0,
            provider: 'none',
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhantomAuth = async () => {
    if (!phantomAvailable) {
      window.open(phantomAuthService.getDownloadUrl(), '_blank');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await phantomAuthService.authenticate();

      if (!result.success) {
        setError(result.error || 'Phantom authentication failed');
        return;
      }

      if (result.user) {
        const userProfile: UserProfile = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          wallet_address: result.user.wallet_address,
          wallet_public_key: result.user.wallet_public_key,
          phone: result.user.phone,
          points: result.user.points,
          total_points_earned: result.user.total_points_earned,
          avatar: result.user.avatar,
          emailVerified: result.user.emailVerified,
          created_at: result.user.created_at,
          updated_at: result.user.updated_at,
          referral_code: result.user.referral_code,
          badges: result.user.badges,
        };
        setUser(userProfile, 'phantom');

        if (result.walletAddress) {
          setWallet({
            isConnected: true,
            address: result.walletAddress,
            balance: 0,
            usdcBalance: 0,
            provider: 'phantom',
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Phantom authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 'verify') {
      setStep('email');
      setCode('');
      setError(null);
      setSuccess(null);
    } else if (step === 'email' || step === 'qr') {
      setStep('choose');
      setError(null);
      setSuccess(null);
    } else if (onBack) {
      onBack();
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-warning/20 flex items-center justify-center mb-3">
          <Warning size={28} className="text-warning" />
        </div>
        <h2 className="text-base font-bold mb-1 font-archivo">Account Unavailable</h2>
        <p className="text-white50 text-xs mb-4 font-satoshi">
          Connect with wallet instead
        </p>
        <button onClick={onWalletConnect} className="btn-primary text-sm !py-2.5 !px-6">
          <Wallet size={18} />
          Connect Wallet
        </button>
      </div>
    );
  }

  // QR Code Login Screen
  if (step === 'qr') {
    return <QRLogin onBack={goBack} />;
  }

  // Choose login method
  if (step === 'choose') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 pt-3 pb-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-white50 hover:text-white text-sm transition-all font-satoshi"
            >
              <ArrowLeft size={18} />
              Back
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-5 pb-4 overflow-y-auto">
          {/* Title */}
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold font-archivo">Sign In</h2>
            <p className="text-white50 text-xs mt-0.5 font-satoshi">
              Choose how to access your account
            </p>
          </div>

          {/* Login Options */}
          <div className="space-y-2.5">
            {/* QR Code - Primary/Recommended */}
            <button
              onClick={() => setStep('qr')}
              className="w-full flex items-center gap-3 p-3.5 bg-white5 border border-green/30 rounded-xl hover:border-green/50 hover:bg-green/5 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <QrCode size={20} className="text-black" weight="bold" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm font-satoshi">Scan with Mobile App</p>
                <p className="text-[10px] text-white50 font-satoshi">
                  Quick & secure login via QR code
                </p>
              </div>
              <div className="px-2 py-0.5 bg-green/20 rounded-full">
                <span className="text-[10px] text-green font-satoshi font-medium">Recommended</span>
              </div>
            </button>

            {/* Phantom Wallet SSO */}
            <button
              onClick={handlePhantomAuth}
              disabled={loading}
              className="w-full flex items-center gap-3 p-3.5 bg-[#AB9FF2]/10 border border-[#AB9FF2]/30 rounded-xl hover:border-[#AB9FF2]/50 hover:bg-[#AB9FF2]/15 transition-all disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-[#AB9FF2] flex items-center justify-center">
                <Lightning size={20} className="text-white" weight="fill" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm font-satoshi">
                  {phantomAvailable ? 'Continue with Phantom' : 'Get Phantom Wallet'}
                </p>
                <p className="text-[10px] text-white50 font-satoshi">
                  {phantomAvailable ? 'Sign in with your Phantom wallet' : 'Install Phantom to continue'}
                </p>
              </div>
              {loading && (
                <div className="w-4 h-4 border-2 border-[#AB9FF2] border-t-transparent rounded-full animate-spin" />
              )}
            </button>

            {/* Email Code */}
            <button
              onClick={() => setStep('email')}
              className="w-full flex items-center gap-3 p-3.5 bg-white5 border border-white10 rounded-xl hover:border-white20 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-white10 flex items-center justify-center">
                <Envelope size={20} className="text-white70" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm font-satoshi">Continue with Email</p>
                <p className="text-[10px] text-white50 font-satoshi">
                  We'll send you a verification code
                </p>
              </div>
            </button>

            {/* Google */}
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full flex items-center gap-3 p-3.5 bg-white border border-white/20 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-gray-200">
                <GoogleLogo size={20} className="text-gray-700" weight="bold" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm font-satoshi text-black">Continue with Google</p>
                <p className="text-[10px] text-gray-500 font-satoshi">
                  Sign in with your Google account
                </p>
              </div>
              {loading && (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </button>

            {/* Wallet */}
            <button
              onClick={onWalletConnect}
              className="w-full flex items-center gap-3 p-3.5 bg-white5 border border-white10 rounded-xl hover:border-white20 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-white10 flex items-center justify-center">
                <Wallet size={20} className="text-white70" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm font-satoshi">Connect Wallet</p>
                <p className="text-[10px] text-white50 font-satoshi">
                  Phantom, Solflare, Backpack...
                </p>
              </div>
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 flex items-start gap-2 p-3 bg-white5 rounded-lg">
            <DeviceMobile size={16} className="text-green mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-white50 font-satoshi">
              For the best experience, use the WeSplit mobile app to scan the QR code.
              Your account will sync automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white5">
          <p className="text-white30 text-[10px] text-center font-satoshi">
            Syncs with your WeSplit mobile app
          </p>
        </div>
      </div>
    );
  }

  // Email/Code entry flow
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-white50 hover:text-white text-sm transition-all font-satoshi"
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-4 overflow-y-auto">
        {/* Title */}
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold font-archivo">
            {step === 'email' ? 'Enter Email' : 'Enter Code'}
          </h2>
          <p className="text-white50 text-xs mt-0.5 font-satoshi">
            {step === 'email'
              ? 'We\'ll send you a verification code'
              : `We sent a code to ${email}`}
          </p>
        </div>

        {/* Error/Success */}
        {error && (
          <div className="mb-3 p-2.5 bg-error/10 border border-error/20 rounded-lg">
            <p className="text-error text-xs font-satoshi">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-3 p-2.5 bg-green/10 border border-green/20 rounded-lg">
            <p className="text-green text-xs font-satoshi">{success}</p>
          </div>
        )}

        {/* Email Step */}
        {step === 'email' && (
          <>
            <form onSubmit={handleSendCode} className="space-y-3">
              <div className="relative">
                <Envelope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white50" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  autoFocus
                  className="w-full bg-white5 border border-white10 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-green/50 transition-all font-satoshi placeholder:text-white30"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full btn-primary !py-2.5 text-sm disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <PaperPlaneTilt size={16} weight="bold" />
                    Send Code
                  </span>
                )}
              </button>
            </form>

            {/* Passkey Option */}
            {passkeySupported && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white10" />
                  <span className="text-white30 text-xs font-satoshi">or</span>
                  <div className="flex-1 h-px bg-white10" />
                </div>

                <button
                  onClick={handlePasskeyAuth}
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white5 border border-green/30 text-white text-sm hover:bg-green/10 hover:border-green/50 transition-all disabled:opacity-50 font-satoshi"
                >
                  <Fingerprint size={18} className="text-green" />
                  Use Passkey
                </button>

                <p className="text-white30 text-[10px] text-center mt-2 font-satoshi">
                  Use Face ID, Touch ID, or your device's passkey
                </p>
              </>
            )}
          </>
        )}

        {/* Verification Code Step */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <div className="relative">
              <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white50" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                required
                autoFocus
                maxLength={6}
                className="w-full bg-white5 border border-white10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-center tracking-[0.5em] focus:outline-none focus:border-green/50 transition-all font-archivo placeholder:text-white30 placeholder:tracking-normal"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full btn-primary !py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ShieldCheck size={16} weight="bold" />
                  Verify Code
                </span>
              )}
            </button>

            {/* Resend option */}
            <div className="text-center pt-2">
              {countdown > 0 ? (
                <p className="text-white30 text-xs font-satoshi">
                  Resend code in {countdown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendCode()}
                  disabled={loading}
                  className="text-green text-xs hover:underline font-satoshi disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </div>

            {/* Dev note */}
            {import.meta.env.DEV && (
              <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-warning text-[10px] font-satoshi text-center">
                  Dev mode: Check Firebase Functions logs for code
                </p>
              </div>
            )}

            {/* Passkey alternative */}
            {passkeySupported && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white10" />
                  <span className="text-white30 text-xs font-satoshi">or</span>
                  <div className="flex-1 h-px bg-white10" />
                </div>

                <button
                  type="button"
                  onClick={handlePasskeyAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white5 border border-white10 text-white text-sm hover:bg-white10 transition-all disabled:opacity-50 font-satoshi"
                >
                  <Fingerprint size={18} className="text-green" />
                  Use Passkey Instead
                </button>
              </>
            )}
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white5">
        <p className="text-white30 text-[10px] text-center font-satoshi">
          Syncs with your WeSplit mobile app
        </p>
      </div>
    </div>
  );
}
