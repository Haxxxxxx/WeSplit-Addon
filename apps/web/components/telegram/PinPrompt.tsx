'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Eye, EyeSlash, LightbulbFilament } from '@phosphor-icons/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PinPromptProps {
  open: boolean;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  /** Optional: show loading state on confirm button */
  loading?: boolean;
  /** Error message from a failed attempt (e.g. wrong PIN) */
  error?: string | null;
  /** Title override */
  title?: string;
  /** Description override */
  description?: string;
  /** Async function that returns the PIN hint (from CloudStorage) */
  getPinHint?: () => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PinPrompt({
  open,
  onConfirm,
  onCancel,
  loading = false,
  error,
  title = 'Enter PIN',
  description = 'Enter your wallet PIN to sign this transaction.',
  getPinHint,
}: PinPromptProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      setPin('');
      setShowPin(false);
      setShowHint(false);
      setHint(null);
      // Small delay so Radix mounts the portal first
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (pin.length < 4 || loading) return;
      onConfirm(pin);
    },
    [pin, loading, onConfirm],
  );

  const handleShowHint = useCallback(async () => {
    if (!getPinHint) return;
    try {
      const h = await getPinHint();
      setHint(h);
      setShowHint(true);
    } catch {
      setHint(null);
      setShowHint(true);
    }
  }, [getPinHint]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      maxWidth="sm"
      closeOnOverlayClick={!loading}
      showCloseButton={!loading}
      footer={
        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="ghost"
            fullWidth
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleSubmit()}
            fullWidth
            loading={loading}
            disabled={pin.length < 4}
          >
            Confirm
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* PIN input */}
        <Input
          ref={inputRef}
          type={showPin ? 'text' : 'password'}
          inputMode="numeric"
          placeholder="Enter 4-6 digit PIN"
          value={pin}
          onChange={(e) => {
            // Only allow digits, max 6
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPin(val);
          }}
          autoComplete="off"
          error={error ?? undefined}
          rightIcon={
            showPin ? <EyeSlash size={18} /> : <Eye size={18} />
          }
          onRightIconClick={() => setShowPin((v) => !v)}
        />

        {/* Hint */}
        {getPinHint && (
          <div>
            {!showHint ? (
              <button
                type="button"
                onClick={handleShowHint}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <LightbulbFilament size={14} />
                Show PIN hint
              </button>
            ) : (
              <p
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Hint: {hint ?? 'No hint was set'}
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
