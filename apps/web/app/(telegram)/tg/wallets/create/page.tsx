'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Keypair } from '@solana/web3.js';
import { Wallet, Sparkle } from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PinPrompt } from '@/components/telegram/PinPrompt';
import {
  useTelegramBackButton,
  useTelegramMainButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useAppStore } from '@/store';
import { encryptSecretKey } from '@/lib/telegram/crypto';
import { createSharedWallet, storeSharedWalletKey } from '@/lib/firebase/queries';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import { dismissKeyboard } from '@/lib/utils';
import { NoWalletScreen } from '@/components/telegram/NoWalletScreen';

// ---------------------------------------------------------------------------
// Create Shared Wallet Page
// ---------------------------------------------------------------------------

export default function TelegramCreateWalletPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { address: walletAddress, hasWallet, getPinHint } = useTgWallet();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userName = useAppStore((s) => s.user.currentUser?.name);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = name.trim().length >= 1 && !!userId && !!walletAddress && hasWallet;

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack('/tg/wallets'), [goBack]),
  });

  const openPinPrompt = useCallback(() => {
    if (!canCreate || creating) return;
    setError(null);
    setPinError(null);
    setShowPin(true);
    haptic?.impactOccurred('medium');
  }, [canCreate, creating, haptic]);

  const handlePinConfirm = useCallback(
    async (pin: string) => {
      if (!userId || !walletAddress || !userName) return;

      setCreating(true);
      setPinError(null);
      setError(null);

      try {
        // 1. Generate a new Solana keypair for the shared wallet
        const keypair = Keypair.generate();
        const sharedWalletAddress = keypair.publicKey.toBase58();

        // 2. Encrypt the secret key with the creator's PIN
        const encryptedKey = await encryptSecretKey(keypair.secretKey, pin);

        // 3. Write the wallet doc to Firestore
        const walletId = await createSharedWallet({
          name: name.trim(),
          description: description.trim() || undefined,
          creatorId: userId,
          creatorName: userName,
          creatorWalletAddress: walletAddress,
          walletAddress: sharedWalletAddress,
        });

        // 4. Store the encrypted key for the creator
        await storeSharedWalletKey(walletId, userId, encryptedKey);

        setShowPin(false);
        haptic?.notificationOccurred('success');
        queryClient.invalidateQueries({ queryKey: ['sharedWallets'] });

        // Navigate to the new wallet
        router.push(`/tg/wallets/${walletId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create wallet';
        if (msg.toLowerCase().includes('pin') || msg.toLowerCase().includes('decrypt')) {
          setPinError('Invalid PIN. Please try again.');
        } else {
          setShowPin(false);
          setError(msg);
        }
      } finally {
        setCreating(false);
      }
    },
    [userId, walletAddress, userName, name, description, haptic, router],
  );

  const brandColors = useTgBrandColors();

  useTelegramMainButton({
    text: creating ? 'Creating...' : 'Create Wallet',
    onClick: openPinPrompt,
    visible: canCreate && !creating,
    loading: creating,
    disabled: !canCreate || creating,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  if (!hasWallet) {
    return (
      <NoWalletScreen
        icon={<Wallet size={48} weight="fill" style={{ color: 'var(--color-text-tertiary)' }} />}
        message="Create a personal wallet first from the dashboard."
        onBack={() => goBack()}
        backLabel="Back"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Header */}
      <TgPageHeader
        icon={<Sparkle size={20} weight="fill" color="var(--color-bg)" />}
        title="New Shared Wallet"
        subtitle="Split expenses with friends on Solana"
      />

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      {/* Name */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Wallet Name
        </label>
        <Input
          placeholder="e.g. Trip to Miami, Roommates..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          error={name.length > 100 ? 'Max 100 characters' : undefined}
        />
      </Card>

      {/* Description */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Description (optional)
        </label>
        <textarea
          placeholder="What's this wallet for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-disabled)] focus:ring-1 focus:ring-[var(--color-primary)]"
          style={{
            backgroundColor: 'var(--color-white-10)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
      </Card>

      {/* Info banner */}
      <div
        className="rounded-xl px-4 py-3 text-xs"
        style={{ backgroundColor: 'var(--color-white-5)', color: 'var(--color-text-secondary)' }}
      >
        A new Solana wallet will be generated for this shared wallet. You can invite members and fund it after creation.
      </div>

      {/* Fallback button for non-Telegram context */}
      {canCreate && (
        <Button onClick={openPinPrompt} loading={creating} fullWidth className="tg-hide">
          Create Wallet
        </Button>
      )}

      <PinPrompt
        open={showPin}
        onConfirm={handlePinConfirm}
        onCancel={() => { setShowPin(false); setPinError(null); }}
        loading={creating}
        error={pinError}
        title="Confirm Creation"
        description={`Enter your PIN to create "${name.trim()}"`}
        getPinHint={getPinHint}
      />
    </div>
  );
}
