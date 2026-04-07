'use client';

import { CheckCircle } from '@phosphor-icons/react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface SuccessScreenProps {
  title: string;
  message: string;
  onDone: () => void;
  doneLabel?: string;
  /** Optional link below the done button */
  link?: { href: string; label: string };
}

/**
 * Shared success confirmation screen for TG Mini App.
 * Used after send, withdraw, request, wallet creation, etc.
 */
export function SuccessScreen({
  title,
  message,
  onDone,
  doneLabel = 'Done',
  link,
}: SuccessScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 pt-20 text-center animate-fade-in">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--color-success-20)' }}
      >
        <CheckCircle size={36} weight="fill" color="var(--color-success)" />
      </div>
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
        {title}
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {message}
      </p>
      <div className="flex gap-3 w-full mt-2">
        <Button onClick={onDone} variant="primary" fullWidth>
          {doneLabel}
        </Button>
      </div>
      {link && (
        <Link href={link.href} className="text-xs" style={{ color: 'var(--color-primary)' }}>
          {link.label}
        </Link>
      )}
    </div>
  );
}
