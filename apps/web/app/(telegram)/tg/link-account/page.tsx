'use client';

import { useState, useCallback } from 'react';
import {
  LinkSimple,
  Key,
  CloudArrowDown,
  EnvelopeSimple,
  ArrowRight,
  CheckCircle,
  Warning,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTelegram } from '@/providers/TelegramProvider';
import { useAppStore } from '@/store';
import {
  linkWithMnemonic,
  findAccountByEmail,
  linkWithCloudBackup,
  requestEmailOtp,
  verifyEmailOtp,
} from '@/lib/telegram/accountLink';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LinkMethod = 'select' | 'mnemonic' | 'backup' | 'email';
type Step = 'method' | 'input' | 'pin' | 'verify' | 'success';

// ---------------------------------------------------------------------------
// Telegram Account Linking Page
// ---------------------------------------------------------------------------

export default function TelegramLinkAccountPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { toast } = useToast();
  const { telegramUser } = useTelegram();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const authenticateUser = useAppStore((s) => s.authenticateUser);

  // UI state
  const [method, setMethod] = useState<LinkMethod>('select');
  const [step, setStep] = useState<Step>('method');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [mnemonic, setMnemonic] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Linking result
  const [linkedAddress, setLinkedAddress] = useState<string | null>(null);
  const [linkedName, setLinkedName] = useState<string | null>(null);
  const [backupLookup, setBackupLookup] = useState<{
    existingUserId: string;
    walletAddress: string;
    userName?: string;
  } | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => {
      if (step === 'method' || step === 'success') {
        goBack();
      } else if (step === 'pin') {
        setStep('input');
      } else if (step === 'verify') {
        setStep('input');
      } else {
        setStep('method');
        setMethod('select');
        setError(null);
      }
    }, [step, goBack]),
  });

  // ----- Method Selection -----

  const selectMethod = useCallback((m: LinkMethod) => {
    haptic?.impactOccurred('light');
    setMethod(m);
    setStep('input');
    setError(null);
  }, [haptic]);

  // ----- Mnemonic Flow -----

  const handleMnemonicSubmit = useCallback(() => {
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12) {
      setError('Please enter all 12 words of your recovery phrase');
      return;
    }
    setError(null);
    setStep('pin');
  }, [mnemonic]);

  const handleMnemonicLink = useCallback(async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    if (!userId || !telegramUser) return;

    setLoading(true);
    setError(null);
    try {
      const result = await linkWithMnemonic(
        mnemonic.trim(),
        pin,
        userId,
        telegramUser.id,
        telegramUser.username,
      );

      if (result.success) {
        haptic?.notificationOccurred('success');
        setLinkedAddress(result.walletAddress ?? null);
        setStep('success');
      } else {
        setError(result.error ?? 'Linking failed');
        haptic?.notificationOccurred('error');
      }
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [mnemonic, pin, userId, telegramUser, haptic]);

  // ----- Cloud Backup Flow -----

  const handleBackupLookup = useCallback(async () => {
    if (!email.trim() || !userId || !telegramUser) return;

    setLoading(true);
    setError(null);
    try {
      const result = await findAccountByEmail(
        email.trim(),
        userId,
        telegramUser.id,
        telegramUser.username,
      );

      if (result.success && result.existingUserId) {
        setBackupLookup({
          existingUserId: result.existingUserId,
          walletAddress: result.walletAddress ?? '',
          userName: result.userName,
        });
        setLinkedName(result.userName ?? null);
        setStep('verify'); // "verify" step reused for backup password entry
      } else {
        setError(result.error ?? 'No account or backup found');
      }
    } catch {
      setError('Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [email, userId, telegramUser]);

  const handleBackupRestore = useCallback(async () => {
    if (!backupLookup || !password || pin.length < 4 || !userId || !telegramUser) return;

    setLoading(true);
    setError(null);
    try {
      const result = await linkWithCloudBackup(
        backupLookup.existingUserId,
        password,
        pin,
        userId,
        telegramUser.id,
        telegramUser.username,
      );

      if (result.success) {
        haptic?.notificationOccurred('success');
        setLinkedAddress(result.walletAddress ?? null);
        setStep('success');
      } else {
        setError(result.error ?? 'Restore failed');
        haptic?.notificationOccurred('error');
      }
    } catch {
      setError('Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [backupLookup, password, pin, userId, telegramUser, haptic]);

  // ----- Email OTP Flow -----

  const handleEmailSubmit = useCallback(async () => {
    if (!email.trim() || !userId || !telegramUser) return;

    setLoading(true);
    setError(null);
    try {
      const result = await requestEmailOtp(
        email.trim(),
        userId,
        telegramUser.id,
        telegramUser.username,
      );

      if (result.success) {
        setMaskedEmail(result.maskedEmail ?? email);
        setLinkedName(result.userName ?? null);
        setStep('verify');
        toast({ title: 'Code sent', description: `Check ${result.maskedEmail}`, variant: 'success' });
      } else {
        setError(result.error ?? 'Failed to send code');
      }
    } catch {
      setError('Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [email, userId, telegramUser, toast]);

  const handleOtpVerify = useCallback(async () => {
    if (otp.length !== 6 || !userId || !telegramUser) return;

    setLoading(true);
    setError(null);
    try {
      const result = await verifyEmailOtp(
        otp,
        userId,
        telegramUser.id,
        telegramUser.username,
      );

      if (result.success) {
        haptic?.notificationOccurred('success');
        setLinkedAddress(result.walletAddress ?? null);
        setStep('success');
      } else {
        setError(result.error ?? 'Verification failed');
        haptic?.notificationOccurred('error');
      }
    } catch {
      setError('Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [otp, userId, telegramUser, haptic]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-bold" style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-h2)' }}>
          {step === 'success' ? 'Account Linked' : 'Link Account'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {step === 'success'
            ? 'Your WeSplit account is now connected'
            : 'Connect your existing WeSplit wallet'}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
        >
          <Warning size={18} weight="fill" />
          {error}
        </div>
      )}

      {/* ---- Step: Method Selection ---- */}
      {step === 'method' && (
        <div className="flex flex-col gap-3">
          <MethodCard
            icon={Key}
            title="Recovery Phrase"
            description="Enter your 12-word mnemonic from the mobile app"
            onClick={() => selectMethod('mnemonic')}
          />
          <MethodCard
            icon={CloudArrowDown}
            title="Cloud Backup"
            description="Restore from your encrypted cloud backup"
            onClick={() => selectMethod('backup')}
          />
          <MethodCard
            icon={EnvelopeSimple}
            title="Email Verification"
            description="Verify ownership via your registered email"
            onClick={() => selectMethod('email')}
          />
        </div>
      )}

      {/* ---- Step: Mnemonic Input ---- */}
      {step === 'input' && method === 'mnemonic' && (
        <Card>
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Enter the 12-word recovery phrase from your WeSplit mobile app.
              This will import your existing wallet.
            </p>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value.toLowerCase())}
              placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
              style={{
                backgroundColor: 'var(--color-white-5)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            />
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Separate each word with a space. Your phrase never leaves this device.
            </p>
            <Button
              variant="primary"
              fullWidth
              onClick={handleMnemonicSubmit}
              disabled={mnemonic.trim().split(/\s+/).length !== 12}
            >
              Continue
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* ---- Step: Backup Email Input ---- */}
      {step === 'input' && method === 'backup' && (
        <Card>
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Enter the email address associated with your WeSplit account.
            </p>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              variant="primary"
              fullWidth
              onClick={handleBackupLookup}
              disabled={!email.trim() || loading}
              loading={loading}
            >
              Find My Account
            </Button>
          </div>
        </Card>
      )}

      {/* ---- Step: Backup Password + PIN ---- */}
      {step === 'verify' && method === 'backup' && backupLookup && (
        <Card>
          <div className="flex flex-col gap-4">
            {linkedName && (
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                Found account: <strong>{linkedName}</strong>
              </p>
            )}
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Enter your cloud backup password to decrypt your wallet.
            </p>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Backup password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Input
              type="password"
              placeholder="Set a PIN for Telegram (min 4 digits)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
            />
            <Button
              variant="primary"
              fullWidth
              onClick={handleBackupRestore}
              disabled={!password || pin.length < 4 || loading}
              loading={loading}
            >
              Restore & Link
            </Button>
          </div>
        </Card>
      )}

      {/* ---- Step: Email OTP Input ---- */}
      {step === 'input' && method === 'email' && (
        <Card>
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Enter the email address linked to your WeSplit account.
            </p>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              variant="primary"
              fullWidth
              onClick={handleEmailSubmit}
              disabled={!email.trim() || loading}
              loading={loading}
            >
              Send Verification Code
            </Button>
          </div>
        </Card>
      )}

      {/* ---- Step: Email OTP Verification ---- */}
      {step === 'verify' && method === 'email' && (
        <Card>
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Enter the 6-digit code sent to {maskedEmail}
            </p>
            {linkedName && (
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                Linking to: <strong>{linkedName}</strong>
              </p>
            )}
            <Input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.25rem' }}
            />
            <Button
              variant="primary"
              fullWidth
              onClick={handleOtpVerify}
              disabled={otp.length !== 6 || loading}
              loading={loading}
            >
              Verify & Link
            </Button>
          </div>
        </Card>
      )}

      {/* ---- Step: PIN Setup (mnemonic method) ---- */}
      {step === 'pin' && method === 'mnemonic' && (
        <Card>
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Set a PIN to secure your wallet on Telegram. You&apos;ll need this
              PIN to sign transactions.
            </p>
            <Input
              type="password"
              placeholder="Enter PIN (min 4 digits)"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              inputMode="numeric"
              style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.25rem' }}
            />
            <Button
              variant="primary"
              fullWidth
              onClick={handleMnemonicLink}
              disabled={pin.length < 4 || loading}
              loading={loading}
            >
              Link Account
            </Button>
          </div>
        </Card>
      )}

      {/* ---- Step: Success ---- */}
      {step === 'success' && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-success-20)' }}
            >
              <CheckCircle size={36} weight="fill" color="var(--color-success)" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                Account Linked
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Your mobile wallet is now available in Telegram.
              </p>
            </div>
            {linkedAddress && (
              <p
                className="text-xs font-mono px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-white-5)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {linkedAddress.slice(0, 8)}...{linkedAddress.slice(-8)}
              </p>
            )}
            <Button variant="primary" fullWidth onClick={() => goBack()}>
              Go to Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MethodCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <Card className="flex items-center gap-3 p-4 transition-colors active:bg-white/[0.04]">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'var(--color-white-10)' }}
        >
          <Icon size={22} color="var(--color-text)" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {title}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {description}
          </p>
        </div>
        <ArrowRight size={16} color="var(--color-text-tertiary)" />
      </Card>
    </button>
  );
}
