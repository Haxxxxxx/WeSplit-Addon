'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleLogo, Wallet } from '@phosphor-icons/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '@/providers';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Login page — passwordless (Phone OTP / Email Link / Google / Wallet)
// ---------------------------------------------------------------------------

type AuthMode = 'phone' | 'email';

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    signInWithGoogle, signInWithWallet,
    sendPhoneOtp, confirmPhoneOtp,
    sendEmailLink, completeEmailLink,
    walletLoading,
  } = useAuth();

  // If already authenticated (e.g. Firebase restored session from IndexedDB
  // after middleware cookie expired), redirect to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [authMode, setAuthMode] = useState<AuthMode>('phone');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phone OTP states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Email link states
  const [email, setEmail] = useState('');
  const [emailLinkSent, setEmailLinkSent] = useState(false);

  // Wallet auth states
  const pendingWalletAuth = useRef(false);
  const [showWalletChoice, setShowWalletChoice] = useState(false);
  const [linkingExisting, setLinkingExisting] = useState(false);

  // On mount: check if user is arriving back from an email sign-in link
  useEffect(() => {
    const url = window.location.href;
    const params = new URLSearchParams(window.location.search);
    if (params.get('finishEmailLink') !== '1') return;

    // Email from URL (set by our API route) > localStorage fallback
    const emailFromUrl = params.get('email');
    const storedEmail = window.localStorage.getItem('wesplit-email-for-signin');
    const resolvedEmail = emailFromUrl || storedEmail;

    if (resolvedEmail) {
      setEmail(resolvedEmail);
      setLoading(true);
      completeEmailLink(resolvedEmail, url)
        .then(() => router.push('/dashboard'))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Email link sign-in failed. Please try again.');
          setLoading(false);
        });
    } else {
      // Edge case: no email anywhere — ask user to re-enter
      setError('Please enter your email to complete sign-in.');
      setAuthMode('email');
      setEmailLinkSent(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhoneLoading(true);
    try {
      const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      await sendPhoneOtp(formatted, 'recaptcha-container');
      setOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code.');
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleConfirmOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhoneLoading(true);
    try {
      await confirmPhoneOtp(otpCode);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleSendEmailLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendEmailLink(email);
      setEmailLinkSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send sign-in link.');
    } finally {
      setLoading(false);
    }
  }

  // If user lands back on this page without the stored email, let them re-enter it
  async function handleCompleteEmailLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await completeEmailLink(email, window.location.href);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Email link sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  // When wallet connects after user clicked "Connect Wallet", trigger SIWS
  useEffect(() => {
    if (connected && pendingWalletAuth.current) {
      pendingWalletAuth.current = false;
      handleWalletAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  async function handleWalletAuth() {
    setError(null);
    setShowWalletChoice(false);
    try {
      const result = await signInWithWallet();
      if (result === 'no_match') {
        // No existing account found — show choice UI
        setShowWalletChoice(true);
        return;
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wallet sign in failed.');
    }
  }

  async function handleCreateNewWithWallet() {
    setError(null);
    setShowWalletChoice(false);
    try {
      const result = await signInWithWallet({ createNew: true });
      if (result === 'ok') {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account.');
    }
  }

  async function handleLinkExistingWithEmail() {
    // User wants to sign in with email first, then link their wallet
    setShowWalletChoice(false);
    setLinkingExisting(true);
    setError(null);
    // The form is now visible — user enters email/password.
    // After email sign-in succeeds, they'll be on the dashboard
    // and can link via /wallets/connect.
  }

  function handleConnectWallet() {
    setError(null);
    setShowWalletChoice(false);
    if (connected) {
      handleWalletAuth();
    } else {
      pendingWalletAuth.current = true;
      setVisible(true);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Cookie is set inside signInWithGoogle() — navigate after it's ready
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign in failed.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div
      className="rounded-[var(--radius-2xl)] p-8"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-modal)',
      }}
    >
      <div className="mb-7 flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
          Welcome back
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Sign in to your WeSplit account
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mb-5 rounded-[var(--radius-md)] px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
        >
          {error}
        </div>
      )}

      {/* No-match wallet choice — shown when SIWS finds no existing account */}
      {showWalletChoice && (
        <div
          className="mb-5 rounded-[var(--radius-lg)] p-5 flex flex-col gap-4"
          style={{ backgroundColor: 'var(--color-white-5)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              No account found for this wallet
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              We couldn&apos;t find a WeSplit account linked to this wallet address.
              What would you like to do?
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              loading={walletLoading}
              onClick={handleCreateNewWithWallet}
            >
              Create New Account
            </Button>
            <Button
              variant="secondary"
              fullWidth
              size="lg"
              onClick={handleLinkExistingWithEmail}
            >
              I have an account — sign in another way
            </Button>
            <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              Sign in with phone or email first, then link this wallet in Settings
            </p>
          </div>
        </div>
      )}

      {/* Linking hint banner */}
      {linkingExisting && (
        <div
          className="mb-5 rounded-[var(--radius-md)] px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-primary-20)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
        >
          Sign in with your email below. After login, go to Wallets &rarr; Connect to link your browser wallet.
        </div>
      )}

      {/* Auth mode tabs */}
      <div className="mb-4 flex rounded-[var(--radius-lg)] p-1" style={{ backgroundColor: 'var(--color-white-5)' }}>
        <button
          type="button"
          onClick={() => { setAuthMode('phone'); setError(null); }}
          className={cn(
            'flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-all',
          )}
          style={{
            backgroundColor: authMode === 'phone' ? 'var(--color-primary)' : 'transparent',
            color: authMode === 'phone' ? 'var(--color-bg)' : 'var(--color-text-secondary)',
          }}
        >
          Phone
        </button>
        <button
          type="button"
          onClick={() => { setAuthMode('email'); setError(null); }}
          className={cn(
            'flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-medium transition-all',
          )}
          style={{
            backgroundColor: authMode === 'email' ? 'var(--color-primary)' : 'transparent',
            color: authMode === 'email' ? 'var(--color-bg)' : 'var(--color-text-secondary)',
          }}
        >
          Email
        </button>
      </div>

      {/* Phone OTP form */}
      {authMode === 'phone' && !otpSent && (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="phone"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 234 567 8900"
              className={cn(
                'h-12 w-full rounded-[var(--radius-lg)] px-4 text-sm outline-none transition-all',
                'placeholder:text-[var(--color-text-tertiary)]',
                'focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[var(--color-surface)]'
              )}
              style={{
                backgroundColor: 'var(--color-white-10)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
          <Button type="submit" variant="primary" fullWidth loading={phoneLoading} size="lg">
            Send verification code
          </Button>
        </form>
      )}

      {/* OTP confirmation form */}
      {authMode === 'phone' && otpSent && (
        <form onSubmit={handleConfirmOtp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="otp"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Verification code
            </label>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Sent to {phoneNumber}
            </p>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className={cn(
                'h-12 w-full rounded-[var(--radius-lg)] px-4 text-center text-lg font-mono tracking-[0.3em] outline-none transition-all',
                'placeholder:text-[var(--color-text-tertiary)]',
                'focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[var(--color-surface)]'
              )}
              style={{
                backgroundColor: 'var(--color-white-10)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
          <Button type="submit" variant="primary" fullWidth loading={phoneLoading} size="lg">
            Verify &amp; sign in
          </Button>
          <button
            type="button"
            onClick={() => { setOtpSent(false); setOtpCode(''); }}
            className="text-sm font-medium transition-colors hover:underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Use a different number
          </button>
        </form>
      )}

      {/* Email link form — send link */}
      {authMode === 'email' && !emailLinkSent && (
        <form onSubmit={handleSendEmailLink} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={cn(
                'h-12 w-full rounded-[var(--radius-lg)] px-4 text-sm outline-none transition-all',
                'placeholder:text-[var(--color-text-tertiary)]',
                'focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[var(--color-surface)]'
              )}
              style={{
                backgroundColor: 'var(--color-white-10)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>
          <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
            Send sign-in link
          </Button>
        </form>
      )}

      {/* Email link sent — confirmation */}
      {authMode === 'email' && emailLinkSent && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-[var(--radius-lg)] p-5 flex flex-col gap-2"
            style={{ backgroundColor: 'var(--color-primary-20)', border: '1px solid var(--color-primary)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Check your inbox
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              We sent a sign-in link to <strong style={{ color: 'var(--color-text)' }}>{email}</strong>.
              Click the link in the email to sign in — no password needed.
            </p>
          </div>

          {/* Fallback: if user opened link on different device/browser, let them enter email here */}
          {new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('finishEmailLink') === '1' && (
            <form onSubmit={handleCompleteEmailLink} className="flex flex-col gap-3">
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Opened from a different browser? Enter your email to finish:
              </p>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={cn(
                  'h-12 w-full rounded-[var(--radius-lg)] px-4 text-sm outline-none transition-all',
                  'placeholder:text-[var(--color-text-tertiary)]',
                  'focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[var(--color-surface)]'
                )}
                style={{
                  backgroundColor: 'var(--color-white-10)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
                Complete sign-in
              </Button>
            </form>
          )}

          <button
            type="button"
            onClick={() => { setEmailLinkSent(false); setEmail(''); }}
            className="text-sm font-medium transition-colors hover:underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Use a different email
          </button>
        </div>
      )}

      {/* Invisible reCAPTCHA container for phone auth */}
      <div id="recaptcha-container" />

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>or continue with</span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>

      {/* Social/wallet buttons */}
      <div className="flex flex-col gap-3">
        <Button
          variant="secondary"
          fullWidth
          size="lg"
          loading={googleLoading}
          onClick={handleGoogle}
          leftIcon={<GoogleLogo size={20} weight="bold" />}
        >
          Continue with Google
        </Button>

        <Button
          variant="secondary"
          fullWidth
          size="lg"
          loading={walletLoading}
          onClick={handleConnectWallet}
          leftIcon={<Wallet size={20} weight="bold" />}
        >
          Connect Wallet
        </Button>
      </div>

      {/* Tip for mobile users */}
      <p className="mt-4 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        Already have a WeSplit mobile account? Sign in with your phone number above,
        then link your browser wallet in Settings.
      </p>

      {/* Sign up link */}
      <p className="mt-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-medium transition-colors hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
