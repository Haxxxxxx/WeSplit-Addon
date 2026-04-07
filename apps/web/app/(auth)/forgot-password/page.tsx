'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import Link from 'next/link';
import { ArrowLeft, EnvelopeSimple, CheckCircle } from '@phosphor-icons/react';
import { auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found') {
        // Don't leak whether email exists — show success anyway
        setSent(true);
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Back link */}
        <Link
          href="/login"
          className="mb-8 flex items-center gap-2 text-sm transition-colors hover:opacity-70"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={16} />
          Back to login
        </Link>

        {sent ? (
          /* Success state */
          <div className="flex flex-col items-center gap-5 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)' }}
            >
              <CheckCircle size={32} weight="fill" style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                Check your email
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset
                link. It may take a minute to arrive.
              </p>
            </div>
            <Link
              href="/login"
              className="text-sm font-medium transition-colors hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              Return to login
            </Link>
          </div>
        ) : (
          /* Email form */
          <>
            <div className="mb-8 flex flex-col gap-2">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                Forgot password?
              </h1>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  Email
                </label>
                <div className="relative">
                  <EnvelopeSimple
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={cn(
                      'w-full rounded-xl py-2.5 pl-9 pr-4 text-sm outline-none transition-all',
                      'border focus:ring-2',
                    )}
                    style={{
                      backgroundColor: 'var(--color-white-5)',
                      borderColor: error ? 'var(--color-error)' : 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                    disabled={loading}
                  />
                </div>
                {error && (
                  <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))',
                  color: 'var(--color-bg)',
                }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
