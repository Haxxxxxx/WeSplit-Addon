'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { Key, Eye, EyeSlash, CheckCircle, Warning } from '@phosphor-icons/react';
import { ArrowLeft } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store';
import { validateMnemonic } from '@/lib/crypto/walletCrypto';
import { importFromMnemonic } from '@/lib/web-wallet/wallet';

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type Step = 'mnemonic' | 'pin' | 'confirm-pin' | 'importing' | 'success';

export default function ImportWalletPage() {
  const router = useRouter();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const [step, setStep] = useState<Step>('mnemonic');
  const [mnemonic, setMnemonic] = useState('');
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [resultAddress, setResultAddress] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Step 1: Validate mnemonic
  // -----------------------------------------------------------------------

  const handleMnemonicNext = useCallback(async () => {
    const trimmed = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    const wordCount = trimmed.split(' ').length;

    if (wordCount !== 12 && wordCount !== 24) {
      setMnemonicError('Enter a 12 or 24-word recovery phrase');
      return;
    }

    const valid = await validateMnemonic(trimmed);
    if (!valid) {
      setMnemonicError('Invalid recovery phrase. Check for typos.');
      return;
    }

    setMnemonic(trimmed);
    setMnemonicError(null);
    setStep('pin');
  }, [mnemonic]);

  // -----------------------------------------------------------------------
  // Step 2: Set PIN
  // -----------------------------------------------------------------------

  const handlePinNext = useCallback(() => {
    if (pin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    setPinError(null);
    setStep('confirm-pin');
  }, [pin]);

  // -----------------------------------------------------------------------
  // Step 3: Confirm PIN
  // -----------------------------------------------------------------------

  const handleConfirmPin = useCallback(async () => {
    if (confirmPin !== pin) {
      setPinError('PINs do not match');
      return;
    }

    if (!userId) {
      setImportError('Not authenticated');
      return;
    }

    setPinError(null);
    setStep('importing');

    try {
      const address = await importFromMnemonic(userId, mnemonic, pin);

      // Update user doc with the imported wallet address (dual format)
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        web_wallet_address: address,
        webWalletAddress: address,
        web_wallet_type: 'imported',
        webWalletType: 'imported',
      });

      // Clear mnemonic from memory
      setMnemonic('');

      // Add to Zustand wallets array
      useAppStore.getState().addWallet({
        id: `imported-${address.slice(0, 8)}`,
        address,
        name: 'Imported Wallet',
        type: 'external',
        status: 'healthy',
        isPreferred: false,
        createdAt: new Date().toISOString(),
        provider: 'imported',
      });

      setResultAddress(address);
      setStep('success');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setStep('confirm-pin');
    }
  }, [confirmPin, pin, mnemonic, userId]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <PageContainer>
      <PageHeader
        title="Import Wallet"
        subtitle="Use your mobile wallet on the web"
        rightElement={
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        }
      />

      {/* Step: Mnemonic Entry */}
      {step === 'mnemonic' && (
        <Card>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--color-white-10)' }}
              >
                <Key size={20} color="var(--color-primary)" />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Recovery Phrase</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Enter the 12 or 24-word phrase from your mobile app
                </p>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={mnemonic}
                onChange={(e) => {
                  setMnemonic(e.target.value);
                  setMnemonicError(null);
                }}
                placeholder="word1 word2 word3 ..."
                rows={4}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                className="w-full rounded-xl border px-4 py-3 text-sm font-mono resize-none outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  borderColor: mnemonicError ? 'var(--color-error)' : 'var(--color-border)',
                  color: showMnemonic ? 'var(--color-text)' : 'transparent',
                  textShadow: showMnemonic ? 'none' : '0 0 8px var(--color-text-secondary)',
                  caretColor: 'var(--color-text)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowMnemonic((v) => !v)}
                className="absolute top-3 right-3 p-1 rounded-md transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {showMnemonic ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {mnemonicError && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-error)' }}>
                <Warning size={14} />
                {mnemonicError}
              </div>
            )}

            <div
              className="rounded-xl p-3 text-xs"
              style={{
                backgroundColor: 'var(--color-warning-bg, rgba(255,180,0,0.1))',
                color: 'var(--color-warning, #FFB400)',
              }}
            >
              Your recovery phrase never leaves this device. It is used only to derive your wallet key, then immediately discarded.
            </div>

            <Button
              onClick={handleMnemonicNext}
              fullWidth
              disabled={!mnemonic.trim()}
            >
              Continue
            </Button>
          </div>
        </Card>
      )}

      {/* Step: Set PIN */}
      {step === 'pin' && (
        <Card>
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Set a PIN</p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                This PIN encrypts your wallet key on this device. You&apos;ll need it to sign transactions.
              </p>
            </div>

            <Input
              type="password"
              inputMode="numeric"
              placeholder="Enter 4-6 digit PIN"
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPin(val);
                setPinError(null);
              }}
              autoComplete="off"
              error={pinError ?? undefined}
            />

            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setStep('mnemonic')}>
                Back
              </Button>
              <Button fullWidth onClick={handlePinNext} disabled={pin.length < 4}>
                Continue
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step: Confirm PIN */}
      {step === 'confirm-pin' && (
        <Card>
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Confirm PIN</p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Re-enter your PIN to confirm.
              </p>
            </div>

            <Input
              type="password"
              inputMode="numeric"
              placeholder="Re-enter PIN"
              value={confirmPin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setConfirmPin(val);
                setPinError(null);
              }}
              autoComplete="off"
              error={pinError ?? undefined}
            />

            {importError && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-error)' }}>
                <Warning size={14} />
                {importError}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => { setConfirmPin(''); setStep('pin'); }}>
                Back
              </Button>
              <Button fullWidth onClick={handleConfirmPin} disabled={confirmPin.length < 4}>
                Import Wallet
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
              Importing wallet...
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              Deriving keypair and encrypting with your PIN
            </p>
          </div>
        </Card>
      )}

      {/* Step: Success */}
      {step === 'success' && (
        <Card>
          <div className="flex flex-col items-center gap-4 py-8">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-success-bg, rgba(0,200,100,0.1))' }}
            >
              <CheckCircle size={32} weight="fill" color="var(--color-success)" />
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                Wallet Imported
              </p>
              <p className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                {resultAddress ? `${resultAddress.slice(0, 6)}...${resultAddress.slice(-4)}` : ''}
              </p>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              Your wallet key is encrypted and stored locally. Use your PIN to sign transactions.
            </p>
            <Button fullWidth onClick={() => router.push('/wallets')}>
              Done
            </Button>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
