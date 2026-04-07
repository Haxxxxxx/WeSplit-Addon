'use client';

import * as React from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  /** Visual style variant */
  variant?: 'underline' | 'pill';
}

export interface TabPanelProps extends RadixTabs.TabsContentProps {
  className?: string;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  children,
  className,
  variant = 'underline',
}: TabsProps) {
  return (
    <RadixTabs.Root
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={cn('flex flex-col', className)}
    >
      {/* Tab list */}
      <RadixTabs.List
        className={cn(
          'flex shrink-0',
          variant === 'underline' && [
            'border-b border-[var(--color-border)]',
            'gap-0',
          ],
          variant === 'pill' && [
            'gap-1.5 p-1',
            'bg-[var(--color-white-5)]',
            'rounded-[var(--radius-xl)]',
          ]
        )}
        aria-label="Navigation tabs"
      >
        {items.map((tab) => (
          <TabTrigger key={tab.value} tab={tab} variant={variant} />
        ))}
      </RadixTabs.List>

      {/* Panels */}
      {children}
    </RadixTabs.Root>
  );
}

// ---------------------------------------------------------------------------
// Individual trigger
// ---------------------------------------------------------------------------

function TabTrigger({
  tab,
  variant,
}: {
  tab: TabItem;
  variant: 'underline' | 'pill';
}) {
  return (
    <RadixTabs.Trigger
      value={tab.value}
      disabled={tab.disabled}
      className={cn(
        'group relative flex items-center justify-center gap-1.5',
        'text-sm font-medium',
        'transition-all duration-[var(--duration-normal)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset',
        'disabled:opacity-40 disabled:cursor-not-allowed',

        variant === 'underline' && [
          'flex-1 sm:flex-none px-4 py-3',
          'text-[var(--color-text-secondary)]',
          'hover:text-[var(--color-text)]',
          // Active indicator — gradient bottom border via pseudo
          'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5',
          'after:rounded-full after:transition-opacity after:duration-[var(--duration-normal)]',
          'after:opacity-0 after:bg-gradient-to-r after:from-[var(--color-gradient-start)] after:to-[var(--color-gradient-end)]',
          'data-[state=active]:text-[var(--color-text)] data-[state=active]:after:opacity-100',
        ],

        variant === 'pill' && [
          'flex-1 sm:flex-none px-4 py-2 rounded-[var(--radius-lg)]',
          'text-[var(--color-text-secondary)]',
          'hover:text-[var(--color-text)] hover:bg-[var(--color-white-5)]',
          'data-[state=active]:bg-[var(--color-white-10)] data-[state=active]:text-[var(--color-text)]',
        ]
      )}
    >
      {tab.icon && (
        <span className="shrink-0 text-current opacity-70 group-data-[state=active]:opacity-100">
          {tab.icon}
        </span>
      )}
      {tab.label}
      {tab.badge != null && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-[var(--color-primary)] text-[var(--color-black)]">
          {tab.badge}
        </span>
      )}
    </RadixTabs.Trigger>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

function TabPanel({ children, className, ...props }: TabPanelProps) {
  return (
    <RadixTabs.Content
      className={cn(
        'flex-1 outline-none',
        'data-[state=active]:animate-fade-in',
        className
      )}
      {...props}
    >
      {children}
    </RadixTabs.Content>
  );
}

export { Tabs, TabPanel };
