'use client';

import { useState, useCallback } from 'react';
import {
  Wallet,
  ShieldCheck,
  CopySimple,
  Check,
  Eye,
  EyeSlash,
  WarningCircle,
} from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  useTelegramBackButton,
  useTelegramMainButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import { dismissKeyboard } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Wallet Setup Page — multi-step: PIN → Create → Mnemonic Backup
// ---------------------------------------------------------------------------

type Step = 'pin' | 'creating' | 'backup' | 'done';

export default function TelegramWalletSetupPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { create, hasWallet } = useTgWallet();

  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hint, setHint] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backup state
  const [mnemonic, setMnemonic] = useState('');
  const [address, setAddress] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  useTelegramBackButton({
    visible: step === 'pin',
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // Validation
  const pinValid = pin.length >= 4 && pin.length <= 6;
  const pinsMatch = pin === confirmPin;
  const canCreate = pinValid && pinsMatch && step === 'pin';

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    setError(null);
    setStep('creating');
    try {
      const result = await create(pin, hint.trim() || undefined);
      setMnemonic(result.mnemonic);
      setAddress(result.address);
      haptic?.notificationOccurred('success');
      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
      haptic?.notificationOccurred('error');
      setStep('pin');
    }
  }, [canCreate, pin, hint, create, haptic]);

  const handleCopyMnemonic = useCallback(() => {
    navigator.clipboard.writeText(mnemonic).then(() => {
      haptic?.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [mnemonic, haptic]);

  const handleFinish = useCallback(() => {
    setStep('done');
    haptic?.notificationOccurred('success');
    goBack();
  }, [goBack, haptic]);

  const brandColors = useTgBrandColors();

  useTelegramMainButton({
    text: step === 'pin' ? 'Create Wallet' : step === 'backup' ? 'I\'ve Backed It Up' : '',
    onClick: step === 'pin' ? handleCreate : step === 'backup' ? handleFinish : () => {},
    visible: (step === 'pin' && canCreate) || (step === 'backup' && backedUp),
    loading: step === 'creating',
    disabled: step === 'creating' || (step === 'backup' && !backedUp),
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  // Already has a wallet → redirect
  if (hasWallet && step === 'pin') {
    return (
      <div className="flex flex-col items-center gap-4 px-6 pt-20 text-center animate-fade-in">
        <Wallet size={48} weight="fill" style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          Wallet Already Exists
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          You already have a wallet set up.
        </p>
        <Button onClick={() => goBack()} variant="outline">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Header */}
      <TgPageHeader
        icon={step === 'backup'
          ? <ShieldCheck size={20} weight="fill" color="var(--color-bg)" />
          : <Wallet size={20} weight="fill" color="var(--color-bg)" />}
        title={step === 'backup' ? 'Backup Seed Phrase' : 'Create Wallet'}
        subtitle={step === 'backup'
          ? 'Write down these 12 words in order'
          : 'Set up your non-custodial Solana wallet'}
      />

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
        >
          {error}
        </div>
      )}

      {/* ---- Step 1: PIN entry ---- */}
      {step === 'pin' && (
        <>
          <Card>
            <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Choose a PIN (4-6 digits)
            </label>
            <Input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="off"
              rightIcon={showPin ? <EyeSlash size={18} /> : <Eye size={18} />}
              onRightIconClick={() => setShowPin((v) => !v)}
            />

            <label className="block mt-3 mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Confirm PIN
            </label>
            <Input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="off"
              error={confirmPin.length >= 4 && !pinsMatch ? 'PINs do not match' : undefined}
            />

            <label className="block mt-3 mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              PIN Hint (optional)
            </label>
            <Input
              placeholder="e.g. My birthday..."
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              maxLength={100}
            />
          </Card>

          <div
            className="rounded-xl px-4 py-3 text-xs"
            style={{ backgroundColor: 'var(--color-white-5)', color: 'var(--color-text-secondary)' }}
          >
            Your PIN encrypts your wallet locally. WeSplit never has access to your keys. If you lose your PIN, you can restore with your seed phrase.
          </div>

          {canCreate && (
            <Button onClick={handleCreate} fullWidth className="tg-hide">
              Create Wallet
            </Button>
          )}
        </>
      )}

      {/* ---- Step: Creating ---- */}
      {step === 'creating' && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Generating your wallet...
            </p>
          </div>
        </Card>
      )}

      {/* ---- Step 2: Mnemonic Backup ---- */}
      {step === 'backup' && (
        <>
          <div
            className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
            style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
          >
            <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
            Write these words down and store them safely. This is the ONLY way to recover your wallet if you lose access.
          </div>

          <HeroCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Your 12-word seed phrase
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowMnemonic((v) => !v)}
                  className="p-1 rounded"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {showMnemonic ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyMnemonic}
                  className="p-1 rounded"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {copied ? <Check size={16} weight="bold" /> : <CopySimple size={16} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {mnemonic.split(' ').map((word, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
                  style={{ backgroundColor: 'var(--color-white-5)' }}
                >
                  <span
                    className="text-[10px] font-mono w-4 text-right"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="text-sm font-mono"
                    style={{
                      color: 'var(--color-text)',
                      filter: showMnemonic ? 'none' : 'blur(4px)',
                      userSelect: showMnemonic ? 'text' : 'none',
                    }}
                  >
                    {word}
                  </span>
                </div>
              ))}
            </div>
          </HeroCard>

          {/* Wallet address */}
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Your wallet address
              </span>
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--color-text)' }}
              >
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>
          </Card>

          {/* Confirmation checkbox */}
          <button
            type="button"
            onClick={() => {
              setBackedUp((v) => !v);
              haptic?.selectionChanged();
            }}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-left"
            style={{ backgroundColor: 'var(--color-white-5)' }}
          >
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors"
              style={{
                backgroundColor: backedUp ? 'var(--color-primary)' : 'transparent',
                border: backedUp ? 'none' : '2px solid var(--color-text-tertiary)',
              }}
            >
              {backedUp && <Check size={12} weight="bold" style={{ color: 'var(--color-bg)' }} />}
            </div>
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>
              I&apos;ve written down my seed phrase and stored it safely
            </span>
          </button>

          {backedUp && (
            <Button onClick={handleFinish} fullWidth className="tg-hide">
              Continue to Dashboard
            </Button>
          )}
        </>
      )}
    </div>
  );
}
