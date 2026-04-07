'use client';

import type { ReactElement } from 'react';
import { Wallet } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';

interface NoWalletScreenProps {
  /** Override the default wallet icon */
  icon?: ReactElement;
  /** Override the message text */
  message?: string;
  /** Button handler — typically goBack() */
  onBack: () => void;
  /** Button label (default: "Back to Dashboard") */
  backLabel?: string;
}

/**
 * Empty state shown when a TG page requires a wallet but none exists.
 * Used across send, withdraw, deposit, splits/create, wallets/create, etc.
 */
export function NoWalletScreen({
  icon,
  message = 'Create a wallet first from the dashboard to get started.',
  onBack,
  backLabel = 'Back to Dashboard',
}: NoWalletScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 pt-20 text-center animate-fade-in">
      {icon ?? <Wallet size={48} weight="fill" style={{ color: 'var(--color-text-tertiary)' }} />}
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
        No Wallet Found
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {message}
      </p>
      <Button onClick={onBack} variant="outline">
        {backLabel}
      </Button>
    </div>
  );
}
