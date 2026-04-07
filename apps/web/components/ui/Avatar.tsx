'use client';

import * as React from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
  /** Show a green online indicator dot */
  online?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Size map (px)
// ---------------------------------------------------------------------------

const sizePx: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const fallbackFontSize: Record<AvatarSize, string> = {
  xs: 'text-[9px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-xl',
};

const dotSize: Record<AvatarSize, string> = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

// ---------------------------------------------------------------------------
// Fallback color from initials (consistent per name)
// ---------------------------------------------------------------------------

const WALLET_COLORS = [
  '#9B59B6', // purple
  '#2ECC71', // green
  '#E67E22', // orange
  '#3498DB', // blue
  '#E74C3C', // red
  '#E91E63', // magenta
  '#1ABC9C', // teal
  '#5C6BC0', // indigo
  '#00BCD4', // cyan
  '#FFC107', // amber
];

function getColorForInitials(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WALLET_COLORS[Math.abs(hash) % WALLET_COLORS.length]!;
}

function getInitials(text: string): string {
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Avatar = React.forwardRef<
  React.ElementRef<typeof RadixAvatar.Root>,
  AvatarProps
>(({ src, alt, fallback, size = 'md', online = false, className }, ref) => {
  const px = sizePx[size];
  const initials = fallback ? getInitials(fallback) : '?';
  const bgColor = getColorForInitials(initials);

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <RadixAvatar.Root
        ref={ref}
        className="overflow-hidden rounded-full"
        style={{ width: px, height: px }}
      >
        {src && (
          <RadixAvatar.Image
            src={src}
            alt={alt ?? fallback ?? 'Avatar'}
            className="h-full w-full object-cover"
          />
        )}

        <RadixAvatar.Fallback
          delayMs={src ? 600 : 0}
          className={cn(
            'flex h-full w-full items-center justify-center',
            'font-semibold font-[family-name:var(--font-family-body)]',
            'text-[var(--color-black)]',
            fallbackFontSize[size]
          )}
          style={{ backgroundColor: bgColor }}
        >
          {initials}
        </RadixAvatar.Fallback>
      </RadixAvatar.Root>

      {/* Online indicator */}
      {online && (
        <span
          className={cn(
            'absolute bottom-0 right-0',
            'rounded-full',
            'border-2 border-[var(--color-bg)]',
            'bg-[var(--color-success)]',
            dotSize[size]
          )}
          aria-label="Online"
        />
      )}
    </span>
  );
});

Avatar.displayName = 'Avatar';

// ---------------------------------------------------------------------------
// Avatar group (stacked)
// ---------------------------------------------------------------------------

export interface AvatarGroupProps {
  avatars: Array<{ src?: string; alt?: string; fallback?: string }>;
  max?: number;
  size?: AvatarSize;
  className?: string;
}

function AvatarGroup({ avatars, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible.map((a, i) => (
        <span
          key={i}
          className="ring-2 ring-[var(--color-bg)] rounded-full"
        >
          <Avatar {...a} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full',
            'ring-2 ring-[var(--color-bg)]',
            'bg-[var(--color-white-20)]',
            'text-[var(--color-text-secondary)] text-xs font-medium'
          )}
          style={{ width: sizePx[size], height: sizePx[size] }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export { Avatar, AvatarGroup };
