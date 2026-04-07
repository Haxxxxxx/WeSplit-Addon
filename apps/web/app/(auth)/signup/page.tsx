'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeSlash, GoogleLogo, CheckSquare, Square } from '@phosphor-icons/react';
import { useAuth } from '@/providers';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Signup page
// ---------------------------------------------------------------------------

export default function SignupPage() {
  const router = useRouter();
  const { signUp, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError('You must agree to the Terms of Service to continue.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password, name);
      // Cookie is set inside signUp() — navigate after it's ready
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Account creation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Cookie is set inside signInWithGoogle() — navigate after it's ready
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Google sign in failed.');
    } finally {
      setGoogleLoading(false);
    }
  }

  const inputBase = cn(
    'h-12 w-full rounded-[var(--radius-lg)] px-4 text-sm outline-none transition-all',
    'placeholder:text-[var(--color-text-tertiary)]',
    'focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 focus:ring-offset-[var(--color-surface)]'
  );
  const inputStyle = {
    backgroundColor: 'var(--color-white-10)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
  };

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
          Create account
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Join WeSplit and start splitting on Solana
        </p>
      </div>

      {error && (
        <div
          className="mb-5 rounded-[var(--radius-md)] px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Satoshi Nakamoto"
            className={inputBase}
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
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
            className={inputBase}
            style={inputStyle}
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className={cn(inputBase, 'pr-12')}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors hover:text-[var(--color-text)]"
              style={{ color: 'var(--color-text-secondary)' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Use at least 8 characters with a mix of letters and numbers
          </p>
        </div>

        {/* Terms checkbox */}
        <button
          type="button"
          onClick={() => setAgreed((v) => !v)}
          className="flex items-start gap-3 rounded-[var(--radius-md)] p-3 text-left transition-colors hover:bg-white/5"
          style={{ border: '1px solid var(--color-border)' }}
        >
          {agreed ? (
            <CheckSquare size={20} weight="fill" color="var(--color-primary)" className="mt-0.5 shrink-0" />
          ) : (
            <Square size={20} weight="regular" color="var(--color-text-tertiary)" className="mt-0.5 shrink-0" />
          )}
          <span className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            I agree to the{' '}
            <Link href="#" className="font-medium" style={{ color: 'var(--color-primary)' }} onClick={(e) => e.stopPropagation()}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="#" className="font-medium" style={{ color: 'var(--color-primary)' }} onClick={(e) => e.stopPropagation()}>
              Privacy Policy
            </Link>
          </span>
        </button>

        <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
          Create Account
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>or</span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>

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

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium transition-colors hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
