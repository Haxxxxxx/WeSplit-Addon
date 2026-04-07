'use client';

import * as React from 'react';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowUp,
  CalendarBlank,
  Camera,
  CaretRight,
  Check,
  CheckCircle,
  CheckSquare,
  ClipboardText,
  Clock,
  ClockCounterClockwise,
  Copy,
  CreditCard,
  Crown,
  DeviceMobile,
  DotsThree,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  GearSix,
  GoogleLogo,
  HandCoins,
  House,
  Image,
  Info,
  Key,
  LightbulbFilament,
  LinkSimple,
  LockSimple,
  MagnifyingGlass,
  Medal,
  Note,
  PaperPlaneTilt,
  Plus,
  QrCode,
  Receipt,
  ShareNetwork,
  Shield,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Spinner,
  Square,
  Star,
  Trash,
  Trophy,
  TwitterLogo,
  User,
  UserPlus,
  Users,
  Wallet,
  Warning,
  WarningCircle,
  WarningOctagon,
  WhatsappLogo,
  X,
  XCircle,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Icon map — explicit named imports only (no barrel import)
// ---------------------------------------------------------------------------

const ICON_MAP = {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowUp,
  CalendarBlank,
  Camera,
  CaretRight,
  Check,
  CheckCircle,
  CheckSquare,
  ClipboardText,
  Clock,
  ClockCounterClockwise,
  Copy,
  CreditCard,
  Crown,
  DeviceMobile,
  DotsThree,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  GearSix,
  GoogleLogo,
  HandCoins,
  House,
  Image,
  Info,
  Key,
  LightbulbFilament,
  LinkSimple,
  LockSimple,
  MagnifyingGlass,
  Medal,
  Note,
  PaperPlaneTilt,
  Plus,
  QrCode,
  Receipt,
  ShareNetwork,
  Shield,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Spinner,
  Square,
  Star,
  Trash,
  Trophy,
  TwitterLogo,
  User,
  UserPlus,
  Users,
  Wallet,
  Warning,
  WarningCircle,
  WarningOctagon,
  WhatsappLogo,
  X,
  XCircle,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhosphorIconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
export type PhosphorIconName = keyof typeof ICON_MAP;

export interface IconProps {
  /** Phosphor icon name, e.g. "Wallet", "ArrowLeft", "User" */
  name: PhosphorIconName;
  size?: number;
  weight?: PhosphorIconWeight;
  color?: string;
  className?: string;
  /** aria-label for accessibility */
  label?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  (
    {
      name,
      size = 24,
      weight = 'regular',
      color,
      className,
      label,
    },
    ref
  ) => {
    const IconComponent = ICON_MAP[name] as React.ComponentType<{
      size?: number;
      weight?: PhosphorIconWeight;
      color?: string;
      className?: string;
      ref?: React.Ref<SVGSVGElement>;
      'aria-label'?: string;
      'aria-hidden'?: boolean | 'true' | 'false';
    }>;

    if (!IconComponent) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[Icon] Unknown icon name: "${String(name)}"`);
      }
      return null;
    }

    return (
      <IconComponent
        ref={ref}
        size={size}
        weight={weight}
        color={color}
        className={cn('shrink-0', className)}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      />
    );
  }
);

Icon.displayName = 'Icon';

// ---------------------------------------------------------------------------
// IconButton — icon wrapped in a clickable surface
// ---------------------------------------------------------------------------

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: PhosphorIconName;
  iconSize?: number;
  iconWeight?: PhosphorIconWeight;
  label: string;
  variant?: 'ghost' | 'surface' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const buttonSizePx: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-11 h-11',
};

const iconButtonVariantClasses: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost: 'bg-transparent hover:bg-[var(--color-white-10)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
  surface: 'bg-[var(--color-white-10)] hover:bg-[var(--color-white-20)] text-[var(--color-text)]',
  outline: 'bg-transparent border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-white-5)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      iconSize = 20,
      iconWeight = 'regular',
      label,
      variant = 'ghost',
      size = 'md',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          'inline-flex items-center justify-center rounded-[var(--radius-md)]',
          'transition-all duration-[var(--duration-fast)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'active:scale-95',
          buttonSizePx[size],
          iconButtonVariantClasses[variant],
          className
        )}
        {...props}
      >
        <Icon name={icon} size={iconSize} weight={iconWeight} />
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export { Icon, IconButton };
