'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Render content inside the modal body */
  children: React.ReactNode;
  /** Footer content — buttons etc. */
  footer?: React.ReactNode;
  /** Max width of the modal card */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether clicking the overlay closes the modal */
  closeOnOverlayClick?: boolean;
  /** Show close X button in header */
  showCloseButton?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Width map
// ---------------------------------------------------------------------------

const maxWidthClass: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
};

// ---------------------------------------------------------------------------
// Close icon
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 5L5 15M5 5l10 10"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      title,
      description,
      children,
      footer,
      maxWidth = 'md',
      closeOnOverlayClick = true,
      showCloseButton = true,
      className,
    },
    ref
  ) => {
    return (
      <Dialog.Root
        open={open}
        onOpenChange={(val) => {
          if (!val) onClose();
        }}
      >
        <Dialog.Portal>
          {/* Overlay */}
          <Dialog.Overlay
            className={cn(
              'fixed inset-0 z-[var(--z-modal)]',
              'bg-[var(--color-black-overlay)]',
              'backdrop-blur-sm',
              // Radix data-state animations
              'data-[state=open]:animate-fade-in',
              'data-[state=closed]:opacity-0 data-[state=closed]:transition-opacity data-[state=closed]:duration-[var(--duration-normal)]'
            )}
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* Content */}
          <Dialog.Content
            ref={ref}
            onInteractOutside={(e) => {
              if (!closeOnOverlayClick) e.preventDefault();
            }}
            className={cn(
              // Positioning — centered on desktop, slide-up on mobile
              'fixed z-[calc(var(--z-modal)+1)]',
              // Mobile: bottom sheet
              'bottom-0 left-0 right-0 rounded-t-[var(--radius-2xl)]',
              // Desktop: centered card
              'sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-2xl)]',
              'w-full sm:w-auto',
              maxWidthClass[maxWidth],

              // Appearance
              'bg-[var(--color-surface)]',
              'border border-[var(--color-border)]',
              'shadow-[var(--shadow-modal)]',

              // Layout
              'flex flex-col',
              'max-h-[90dvh] sm:max-h-[85vh]',
              'outline-none',

              // Animations
              'data-[state=open]:animate-slide-up sm:data-[state=open]:animate-scale-in',

              className
            )}
          >
            {/* Drag handle — mobile */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--color-white-20)]" />
            </div>

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between gap-4 px-6 py-4 shrink-0">
                <div className="flex flex-col gap-0.5 min-w-0">
                  {title && (
                    <Dialog.Title className="text-lg font-bold text-[var(--color-text)] truncate leading-tight">
                      {title}
                    </Dialog.Title>
                  )}
                  {description && (
                    <Dialog.Description className="text-sm text-[var(--color-text-secondary)] leading-normal">
                      {description}
                    </Dialog.Description>
                  )}
                </div>

                {showCloseButton && (
                  <Dialog.Close
                    className={cn(
                      'shrink-0 flex items-center justify-center',
                      'w-9 h-9 rounded-[var(--radius-md)]',
                      'bg-[var(--color-white-10)]',
                      'text-[var(--color-text-secondary)]',
                      'hover:bg-[var(--color-white-20)] hover:text-[var(--color-text)]',
                      'transition-colors duration-[var(--duration-fast)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                    )}
                    aria-label="Close modal"
                  >
                    <CloseIcon />
                  </Dialog.Close>
                )}
              </div>
            )}

            {/* Divider */}
            {(title || showCloseButton) && (
              <div className="h-px bg-[var(--color-border)] mx-6 shrink-0" />
            )}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <>
                <div className="h-px bg-[var(--color-border)] mx-6 shrink-0" />
                <div className="px-6 py-4 shrink-0">{footer}</div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
);

Modal.displayName = 'Modal';

export { Modal };
