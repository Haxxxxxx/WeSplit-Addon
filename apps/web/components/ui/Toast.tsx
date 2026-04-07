'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface ToastData {
  id?: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProviderContextValue {
  toast: (data: ToastData) => void;
  dismiss: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = React.createContext<ToastProviderContextValue | null>(null);

export function useToast(): ToastProviderContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Variant config
// ---------------------------------------------------------------------------

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; classes: string; iconColor: string }
> = {
  success: {
    icon: (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx={8} cy={8} r={8} fill="#53EF97" fillOpacity={0.2} />
        <path d="M4.5 8.5l2.5 2.5 4.5-5" stroke="#53EF97" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    classes: 'border-[var(--color-success)]',
    iconColor: 'text-[var(--color-success)]',
  },
  error: {
    icon: (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx={8} cy={8} r={8} fill="#DC3434" fillOpacity={0.2} />
        <path d="M10 6L6 10M6 6l4 4" stroke="#DC3434" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
    classes: 'border-[var(--color-error)]',
    iconColor: 'text-[var(--color-error)]',
  },
  warning: {
    icon: (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 2L1.5 14h13L8 2z" fill="#FFD700" fillOpacity={0.2} stroke="#FFD700" strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M8 6v3M8 11v.5" stroke="#FFD700" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
    classes: 'border-[var(--color-warning)]',
    iconColor: 'text-[var(--color-warning)]',
  },
  info: {
    icon: (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx={8} cy={8} r={8} fill="#2196F3" fillOpacity={0.2} />
        <path d="M8 7v5M8 5v.5" stroke="#2196F3" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
    classes: 'border-[var(--color-info)]',
    iconColor: 'text-[var(--color-info)]',
  },
  default: {
    icon: null,
    classes: 'border-[var(--color-border)]',
    iconColor: '',
  },
};

// ---------------------------------------------------------------------------
// Close icon
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Single Toast item
// ---------------------------------------------------------------------------

function ToastItem({
  title,
  description,
  variant = 'default',
  duration = 5000,
  action,
  onOpenChange,
}: ToastData & { onOpenChange?: (open: boolean) => void }) {
  const config = variantConfig[variant];

  return (
    <ToastPrimitive.Root
      duration={duration}
      onOpenChange={onOpenChange}
      className={cn(
        // Layout
        'relative flex items-start gap-3 w-full max-w-sm pointer-events-auto',
        'px-4 py-3',

        // Appearance
        'bg-[var(--color-surface)]',
        'border rounded-[var(--radius-xl)]',
        'shadow-[var(--shadow-modal)]',
        config.classes,

        // Animation
        'data-[state=open]:animate-slide-up',
        'data-[state=closed]:opacity-0 data-[state=closed]:translate-x-4',
        'data-[state=closed]:transition-all data-[state=closed]:duration-[var(--duration-normal)]',
        'transition-all'
      )}
    >
      {/* Icon */}
      {config.icon && (
        <span className="shrink-0 mt-0.5">{config.icon}</span>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="text-sm font-semibold text-[var(--color-text)] leading-tight">
          {title}
        </ToastPrimitive.Title>
        {description && (
          <ToastPrimitive.Description className="mt-0.5 text-xs text-[var(--color-text-secondary)] leading-normal">
            {description}
          </ToastPrimitive.Description>
        )}
        {action && (
          <ToastPrimitive.Action
            altText={action.label}
            asChild
          >
            <button
              onClick={action.onClick}
              className="mt-2 text-xs font-semibold text-[var(--color-primary)] hover:opacity-80 transition-opacity"
            >
              {action.label}
            </button>
          </ToastPrimitive.Action>
        )}
      </div>

      {/* Close */}
      <ToastPrimitive.Close
        aria-label="Dismiss"
        className={cn(
          'shrink-0 flex items-center justify-center',
          'w-5 h-5 rounded-[var(--radius-sm)]',
          'text-[var(--color-text-tertiary)]',
          'hover:bg-[var(--color-white-10)] hover:text-[var(--color-text)]',
          'transition-colors duration-[var(--duration-fast)]'
        )}
      >
        <CloseIcon />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Provider + Viewport
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<(ToastData & { id: string; open: boolean })[]>([]);

  const toast = React.useCallback((data: ToastData) => {
    const id = data.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...data, id, open: true }]);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open: false } : t))
    );
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}

        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            {...t}
            onOpenChange={(open) => {
              if (!open) {
                // Remove after animation
                setTimeout(() => {
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }, 300);
                setToasts((prev) =>
                  prev.map((x) => (x.id === t.id ? { ...x, open: false } : x))
                );
              }
            }}
          />
        ))}

        {/* Viewport — top-right on desktop, top-center on mobile */}
        <ToastPrimitive.Viewport
          className={cn(
            'fixed top-4 right-4 z-[var(--z-toast)]',
            'flex flex-col gap-2',
            'w-full max-w-sm',
            'pointer-events-none',
            // Mobile: center
            'max-sm:right-0 max-sm:left-0 max-sm:mx-auto max-sm:px-4'
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export { ToastItem };
