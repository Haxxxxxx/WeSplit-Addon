'use client';

import { Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface StepperProps {
  steps: string[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="mb-8 flex items-center gap-0">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all',
              )}
              style={{
                background: i < currentStep
                  ? 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))'
                  : i === currentStep
                  ? 'var(--color-white-20)'
                  : 'var(--color-white-10)',
                color: i <= currentStep ? (i < currentStep ? 'var(--color-bg)' : 'var(--color-text)') : 'var(--color-text-tertiary)',
                border: i === currentStep ? '2px solid var(--color-primary)' : 'none',
              }}
            >
              {i < currentStep ? <Check size={14} weight="bold" /> : i + 1}
            </div>
            <span
              className="text-xs font-medium hidden sm:block"
              style={{ color: i === currentStep ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="flex-1 h-px mx-2 mt-[-12px] sm:mt-0"
              style={{ backgroundColor: i < currentStep ? 'var(--color-primary)' : 'var(--color-border)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
