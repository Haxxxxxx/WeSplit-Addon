'use client';

import Link from 'next/link';
import { ArrowLeft, Plus, CreditCard, DotsThree } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

const MOCK_CARDS = [
  { id: 'card1', type: 'spend', name: 'WeSplit SPEND Card', last4: '4242', expiry: '12/27', status: 'active', gradient: 'spend' },
  { id: 'card2', type: 'debit', name: 'Visa Debit',         last4: '9012', expiry: '08/26', status: 'active', gradient: 'default' },
];

export default function LinkedCardsPage() {
  const { toast } = useToast();

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back
        </Link>
        <Button variant="primary" size="sm" leftIcon={<Plus size={15} weight="bold" />} onClick={() => {
          toast({ title: 'Coming soon', description: 'Card linking will be available in a future update', variant: 'info' });
        }}>
          Add Card
        </Button>
      </div>

      <div className="flex flex-col gap-6 max-w-md">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Linked Cards</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Manage your payment methods and SPEND cards</p>
        </div>

        <div className="flex flex-col gap-4">
          {MOCK_CARDS.map((card) => (
            <div
              key={card.id}
              className="relative rounded-[var(--radius-2xl)] p-5 overflow-hidden"
              style={{
                background: card.gradient === 'spend'
                  ? 'linear-gradient(135deg, var(--color-spend-start), var(--color-spend-end))'
                  : 'linear-gradient(135deg, var(--color-surface), var(--color-black-white-5))',
                border: '1px solid var(--color-border)',
                minHeight: 140,
              }}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-xs font-semibold opacity-70" style={{ color: card.gradient === 'spend' ? 'var(--color-bg)' : 'var(--color-text-secondary)' }}>
                    {card.name}
                  </p>
                  <Badge
                    variant={card.status === 'active' ? 'success' : 'warning'}
                    size="sm"
                    className="mt-1"
                  >
                    {card.status}
                  </Badge>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
                  style={{ color: card.gradient === 'spend' ? 'var(--color-bg)' : 'var(--color-text-secondary)' }}
                  onClick={() => toast({ title: 'Card options', description: `Manage ${card.name}`, variant: 'info' })}
                >
                  <DotsThree size={20} weight="bold" />
                </button>
              </div>

              <div className="flex items-end justify-between">
                <p
                  className="text-xl font-semibold tracking-widest"
                  style={{ fontFamily: 'var(--font-family-number)', color: card.gradient === 'spend' ? 'var(--color-bg)' : 'var(--color-text)' }}
                >
                  •••• •••• •••• {card.last4}
                </p>
                <div className="text-right">
                  <p className="text-xs opacity-70" style={{ color: card.gradient === 'spend' ? 'var(--color-bg)' : 'var(--color-text-secondary)' }}>Expires</p>
                  <p className="text-sm font-semibold" style={{ color: card.gradient === 'spend' ? 'var(--color-bg)' : 'var(--color-text)' }}>{card.expiry}</p>
                </div>
              </div>

              {/* Decorative circles */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10" style={{ backgroundColor: card.gradient === 'spend' ? '#fff' : 'var(--color-primary)' }} />
              <div className="pointer-events-none absolute -right-4 -bottom-4 h-20 w-20 rounded-full opacity-10" style={{ backgroundColor: card.gradient === 'spend' ? '#fff' : 'var(--color-primary)' }} />
            </div>
          ))}
        </div>

        {/* Add card placeholder */}
        <button
          type="button"
          onClick={() => toast({ title: 'Coming soon', description: 'Card linking will be available in a future update', variant: 'info' })}
          className="flex items-center gap-4 rounded-[var(--radius-2xl)] p-5 text-left transition-all hover:bg-white/[0.04]"
          style={{ border: '2px dashed var(--color-border)', minHeight: 80 }}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--color-white-10)' }}
          >
            <Plus size={22} color="var(--color-text-secondary)" />
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Add new card</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Debit, credit, or SPEND card</p>
          </div>
        </button>

        <Card>
          <div className="flex items-start gap-3">
            <CreditCard size={20} color="var(--color-primary)" className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Get a SPEND Card</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                Spend your USDC balance anywhere Visa is accepted. Earn rewards on every purchase.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                toast({ title: 'SPEND Card', description: 'Application will open in a new tab', variant: 'info' });
              }}>Apply Now</Button>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
