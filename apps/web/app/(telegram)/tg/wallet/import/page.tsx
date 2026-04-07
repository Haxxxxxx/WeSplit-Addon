'use client';

import { useState, useCallback } from 'react';
import {
  ArrowsClockwise,
  Eye,
  EyeSlash,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
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
// Import (Restore) Wallet Page
// ---------------------------------------------------------------------------

export default function TelegramWalletImportPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { restore, hasWallet } = useTgWallet();

  const [mnemonic, setMnemonic] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hint, setHint] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // Validate mnemonic: 12 words, all lowercase alpha
  const words = mnemonic.trim().split(/\s+/).filter(Boolean);
  const mnemonicValid = words.length === 12 && words.every((w) => /^[a-z]+$/.test(w));
  const pinValid = pin.length >= 4 && pin.length <= 6;
  const pinsMatch = pin === confirmPin;
  const canImport = mnemonicValid && pinValid && pinsMatch && !importing;

  const handleImport = useCallback(async () => {
    if (!canImport) return;
    setError(null);
    setImporting(true);
    try {
      await restore(mnemonic.trim(), pin, hint.trim() || undefined);
      haptic?.notificationOccurred('success');
      goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import wallet');
      haptic?.notificationOccurred('error');
    } finally {
      setImporting(false);
    }
  }, [canImport, mnemonic, pin, hint, restore, haptic, goBack]);

  const brandColors = useTgBrandColors();

  useTelegramMainButton({
    text: importing ? 'Importing...' : 'Restore Wallet',
    onClick: handleImport,
    visible: canImport,
    loading: importing,
    disabled: !canImport,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Header */}
      <TgPageHeader
        icon={<ArrowsClockwise size={20} weight="bold" color="var(--color-bg)" />}
        title="Import Wallet"
        subtitle="Restore from your 12-word seed phrase"
      />

      {hasWallet && (
        <div
          className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
          style={{ backgroundColor: 'var(--color-warning-20)', color: 'var(--color-warning)' }}
        >
          <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
          You already have a wallet. Importing will replace it.
        </div>
      )}

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
        >
          {error}
        </div>
      )}

      {/* Mnemonic input */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Seed Phrase (12 words)
        </label>
        <textarea
          placeholder="Enter your 12-word seed phrase separated by spaces..."
          value={mnemonic}
          onChange={(e) => setMnemonic(e.target.value.toLowerCase())}
          rows={3}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full resize-none rounded-xl px-4 py-3 text-sm font-mono outline-none transition-all placeholder:text-[var(--color-text-disabled)] focus:ring-1 focus:ring-[var(--color-primary)]"
          style={{
            backgroundColor: 'var(--color-white-10)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          {words.length > 0 && (
            <>
              {mnemonicValid ? (
                <CheckCircle size={12} weight="fill" style={{ color: 'var(--color-success)' }} />
              ) : (
                <WarningCircle size={12} weight="fill" style={{ color: 'var(--color-text-tertiary)' }} />
              )}
              <span
                className="text-xs"
                style={{ color: mnemonicValid ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}
              >
                {words.length}/12 words
              </span>
            </>
          )}
        </div>
      </Card>

      {/* PIN */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Set a PIN (4-6 digits)
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

      {canImport && (
        <Button onClick={handleImport} loading={importing} fullWidth className="tg-hide">
          Restore Wallet
        </Button>
      )}
    </div>
  );
}
