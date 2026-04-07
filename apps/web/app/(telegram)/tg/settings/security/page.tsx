'use client';

import { useState, useCallback } from 'react';
import {
  ShieldCheck,
  Key,
  Trash,
  Eye,
  EyeSlash,
  Copy,
  Check,
  WarningCircle,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { unlockWallet } from '@/lib/telegram/wallet';
import { NoWalletScreen } from '@/components/telegram/NoWalletScreen';

// ---------------------------------------------------------------------------
// Security Settings Page
// ---------------------------------------------------------------------------

type ActiveSection = 'none' | 'changePin' | 'exportKey' | 'deleteWallet';

export default function TelegramSecurityPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { hasWallet, address, changePin, remove, getPinHint } = useTgWallet();

  const [active, setActive] = useState<ActiveSection>('none');

  // Change PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  // Export key state
  const [exportPin, setExportPin] = useState('');
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // Delete wallet state
  const [deleteConfirm, setDeleteConfirm] = useState(0); // 0 → 1 → 2 (double confirm)
  const [deleting, setDeleting] = useState(false);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack('/tg/settings'), [goBack]),
  });

  // ---- Change PIN ----
  const handleChangePin = useCallback(async () => {
    setPinError(null);
    if (newPin.length < 4) {
      setPinError('New PIN must be at least 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }
    if (currentPin === newPin) {
      setPinError('New PIN must be different from current PIN');
      return;
    }
    setChangingPin(true);
    try {
      await changePin(currentPin, newPin);
      haptic?.notificationOccurred('success');
      setPinSuccess(true);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        setPinSuccess(false);
        setActive('none');
      }, 2000);
    } catch {
      setPinError('Wrong current PIN');
      haptic?.notificationOccurred('error');
    } finally {
      setChangingPin(false);
    }
  }, [currentPin, newPin, confirmPin, changePin, haptic]);

  // ---- Export Private Key ----
  const handleExportKey = useCallback(async () => {
    setExportError(null);
    if (exportPin.length < 4) {
      setExportError('Enter your PIN');
      return;
    }
    setExportingKey(true);
    try {
      const wallet = await unlockWallet(exportPin);
      // Convert secret key to base58
      const bs58Module = await import('bs58');
      const keyStr = bs58Module.default.encode(wallet.keypair.secretKey);
      setExportedKey(keyStr);
      haptic?.notificationOccurred('success');
    } catch {
      setExportError('Wrong PIN');
      haptic?.notificationOccurred('error');
    } finally {
      setExportingKey(false);
    }
  }, [exportPin, haptic]);

  const handleCopyKey = useCallback(() => {
    if (!exportedKey) return;
    navigator.clipboard.writeText(exportedKey).then(() => {
      haptic?.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [exportedKey, haptic]);

  // ---- Delete Wallet ----
  const handleDelete = useCallback(async () => {
    if (deleteConfirm < 2) {
      setDeleteConfirm((c) => c + 1);
      haptic?.impactOccurred('heavy');
      return;
    }
    setDeleting(true);
    try {
      await remove();
      haptic?.notificationOccurred('success');
      goBack('/tg/settings');
    } catch {
      haptic?.notificationOccurred('error');
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirm, remove, haptic, goBack]);

  function resetSection() {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinError(null);
    setPinSuccess(false);
    setExportPin('');
    setExportedKey(null);
    setExportError(null);
    setShowKey(false);
    setCopied(false);
    setDeleteConfirm(0);
  }

  function openSection(s: ActiveSection) {
    resetSection();
    setActive(active === s ? 'none' : s);
    haptic?.selectionChanged();
  }

  if (!hasWallet) {
    return (
      <NoWalletScreen
        icon={<ShieldCheck size={48} style={{ color: 'var(--color-text-tertiary)' }} />}
        message="Create a wallet first to access security settings."
        onBack={() => goBack('/tg/settings')}
        backLabel="Back to Settings"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<ShieldCheck size={20} weight="fill" color="var(--color-bg)" />}
        title="Security"
        subtitle="Wallet & PIN management"
      />

      {/* Wallet status */}
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--color-text)' }}>Wallet Address</span>
          <span
            className="text-xs font-mono"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '—'}
          </span>
        </div>
      </Card>

      {/* ---- Change PIN ---- */}
      <Card>
        <button
          type="button"
          onClick={() => openSection('changePin')}
          className="flex items-center gap-3 w-full text-left"
        >
          <Key
            size={18}
            weight="fill"
            style={{ color: 'var(--color-primary)' }}
            className="shrink-0"
          />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Change PIN
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Update your wallet PIN
            </p>
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {active === 'changePin' ? '\u2212' : '+'}
          </span>
        </button>

        {active === 'changePin' && (
          <div className="flex flex-col gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            {pinSuccess ? (
              <div
                className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                style={{ backgroundColor: 'var(--color-success-20)', color: 'var(--color-success)' }}
              >
                <Check size={16} weight="bold" /> PIN changed successfully
              </div>
            ) : (
              <>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Current PIN"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="off"
                />
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="New PIN (4-6 digits)"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="off"
                />
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Confirm new PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="off"
                  error={pinError ?? undefined}
                />
                <Button
                  onClick={handleChangePin}
                  loading={changingPin}
                  disabled={currentPin.length < 4 || newPin.length < 4 || confirmPin.length < 4}
                  fullWidth
                >
                  Update PIN
                </Button>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ---- Export Private Key ---- */}
      <Card>
        <button
          type="button"
          onClick={() => openSection('exportKey')}
          className="flex items-center gap-3 w-full text-left"
        >
          <Eye
            size={18}
            weight="fill"
            style={{ color: 'var(--color-warning)' }}
            className="shrink-0"
          />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Export Private Key
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Reveal your base58 private key
            </p>
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {active === 'exportKey' ? '\u2212' : '+'}
          </span>
        </button>

        {active === 'exportKey' && (
          <div className="flex flex-col gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div
              className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
              style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
            >
              <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
              Never share your private key. Anyone with it has full control of your wallet.
            </div>

            {!exportedKey ? (
              <>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Enter PIN to reveal"
                  value={exportPin}
                  onChange={(e) => setExportPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="off"
                  error={exportError ?? undefined}
                />
                <Button
                  onClick={handleExportKey}
                  loading={exportingKey}
                  disabled={exportPin.length < 4}
                  fullWidth
                  variant="outline"
                >
                  Reveal Key
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <div
                  className="rounded-xl px-3 py-3 text-xs font-mono break-all relative"
                  style={{
                    backgroundColor: 'var(--color-white-5)',
                    color: 'var(--color-text)',
                    filter: showKey ? 'none' : 'blur(4px)',
                    userSelect: showKey ? 'text' : 'none',
                  }}
                >
                  {exportedKey}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowKey((v) => !v)}
                    variant="ghost"
                    size="sm"
                    leftIcon={showKey ? <EyeSlash size={14} /> : <Eye size={14} />}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    onClick={handleCopyKey}
                    variant="ghost"
                    size="sm"
                    leftIcon={copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ---- Delete Wallet ---- */}
      <Card>
        <button
          type="button"
          onClick={() => openSection('deleteWallet')}
          className="flex items-center gap-3 w-full text-left"
        >
          <Trash
            size={18}
            weight="fill"
            style={{ color: 'var(--color-error)' }}
            className="shrink-0"
          />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Delete Wallet
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Remove wallet from this device
            </p>
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {active === 'deleteWallet' ? '\u2212' : '+'}
          </span>
        </button>

        {active === 'deleteWallet' && (
          <div className="flex flex-col gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div
              className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
              style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
            >
              <WarningCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
              This action is irreversible. Make sure you have backed up your private key or seed phrase before deleting.
            </div>
            <Button
              onClick={handleDelete}
              loading={deleting}
              fullWidth
              variant="outline"
              style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
            >
              {deleteConfirm === 0 && 'Delete Wallet'}
              {deleteConfirm === 1 && 'Are you sure?'}
              {deleteConfirm === 2 && 'Tap to permanently delete'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
