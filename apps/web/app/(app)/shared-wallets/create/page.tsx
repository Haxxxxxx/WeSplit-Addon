'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Keypair } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';
import { Plus, X, Check, MagnifyingGlass } from '@phosphor-icons/react';
import { useToast } from '@/components/ui/Toast';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { Stepper } from '@/components/ui/Stepper';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  createSharedWallet,
  inviteMembersToWallet,
  searchUsers,
  getRecentContacts,
} from '@/lib/firebase/queries';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMOJI_OPTIONS = ['🏠', '🏖️', '🍕', '🎮', '⚽', '🎉', '✈️', '💼', '🎓', '🏋️', '🛒', '🎵'];
const COLOR_OPTIONS = [
  'var(--color-wallet-purple)',
  'var(--color-wallet-green)',
  'var(--color-wallet-orange)',
  'var(--color-wallet-blue)',
  'var(--color-wallet-red)',
  'var(--color-wallet-pink)',
  'var(--color-wallet-teal)',
  'var(--color-wallet-yellow)',
];
const STEPS = ['Details', 'Members', 'Permissions', 'Review'];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreateSharedWalletPage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Step 1 — Details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [color, setColor] = useState('#9B59B6');

  // Step 2 — Members
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Step 3 — Permissions
  const [requireApproval, setRequireApproval] = useState(false);
  const [withdrawLimit, setWithdrawLimit] = useState('500');

  // Fetch recent contacts for the member picker
  const { data: recentContacts = [] } = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getRecentContacts(userId!, 20),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Search users when typing in the member search
  const { data: searchResults = [] } = useQuery({
    queryKey: ['userSearch', memberSearch],
    queryFn: () => searchUsers(memberSearch, userId),
    enabled: memberSearch.length >= 2,
    staleTime: 30_000,
  });

  // Merge recent contacts with search results (search takes priority)
  const displayContacts = memberSearch.length >= 2 ? searchResults : recentContacts;

  function toggleMember(user: User) {
    setSelectedMembers((prev) =>
      prev.find((m) => m.id === user.id)
        ? prev.filter((m) => m.id !== user.id)
        : [...prev, user],
    );
  }

  const stepValid = [
    name.trim().length > 0,
    true, // members optional
    true,
    true,
  ];

  async function handleCreate() {
    if (!userId || !currentUser) return;

    setCreating(true);
    try {
      // 1. Generate a real Solana keypair for the shared wallet
      const walletKeypair = Keypair.generate();
      const walletAddress = walletKeypair.publicKey.toBase58();
      const secretKeyBase64 = Buffer.from(walletKeypair.secretKey).toString('base64');

      // 2. Create the shared wallet in Firestore
      const walletId = await createSharedWallet({
        name: name.trim(),
        description: description.trim() || undefined,
        creatorId: userId,
        creatorName: currentUser.name || 'Unknown',
        creatorWalletAddress: currentUser.wallet_address || '',
        walletAddress,
        currency: 'USDC',
        settings: {
          requireApprovalForWithdrawals: requireApproval,
          ...(withdrawLimit !== '0' && { perTransactionLimit: parseFloat(withdrawLimit) }),
        },
      });

      // 3. Store the shared wallet private key (secured by Firestore rules)
      await setDoc(
        doc(db, 'splitWalletPrivateKeys', walletId, 'participants', userId),
        {
          encrypted_key: secretKeyBase64,
          encryption_method: 'web_base64',
          user_id: userId,
          wallet_id: walletId,
          created_at: serverTimestamp(),
        },
      );

      // 4. Invite selected members (if any)
      if (selectedMembers.length > 0) {
        await inviteMembersToWallet(
          walletId,
          userId,
          currentUser.name || 'Unknown',
          selectedMembers.map((m) => ({
            userId: m.id,
            name: m.name,
            email: m.email,
            walletAddress: m.wallet_address,
          })),
        );
      }

      toast({
        title: 'Wallet created!',
        description: `"${name}" is ready at ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}. ${
          selectedMembers.length > 0 ? `${selectedMembers.length} member(s) invited.` : ''
        }`,
        variant: 'success',
      });

      router.push(`/shared-wallets/${walletId}`);
    } catch (err: any) {
      console.error('[CreateSharedWallet]', err);
      toast({
        title: 'Failed to create wallet',
        description: err?.message ?? 'Something went wrong. Please try again.',
        variant: 'error',
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageContainer>
      {/* Stepper */}
      <Stepper steps={STEPS} currentStep={step} />

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Step 1 — Details */}
        {step === 0 && (
          <Card>
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Wallet Details</h2>
            <div className="flex flex-col gap-5">
              {/* Emoji picker */}
              <div>
                <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Icon</p>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all"
                      style={{
                        backgroundColor: emoji === e ? 'var(--color-primary-dim)' : 'var(--color-white-5)',
                        border: emoji === e ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Color</p>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        outline: color === c ? `3px solid ${c}` : 'none',
                        outlineOffset: 2,
                      }}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <Input
                label="Wallet name"
                placeholder="e.g. Apartment, Vacation 2026..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Description (optional)</label>
                <textarea
                  placeholder="What is this wallet for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-[var(--radius-lg)] px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)] placeholder:text-[var(--color-text-disabled)]"
                  style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Step 2 — Members */}
        {step === 1 && (
          <Card>
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Add Members</h2>

            {selectedMembers.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {selectedMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: 'var(--color-primary-dim)', border: '1px solid var(--color-primary)' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>{m.name || m.email || m.id.slice(0, 8)}</span>
                    <button type="button" onClick={() => toggleMember(m)} style={{ color: 'var(--color-primary)' }}>
                      <X size={12} weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Input
              placeholder="Search by name, email, or wallet address..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              leftIcon={<MagnifyingGlass size={16} />}
            />

            <div className="mt-3 flex flex-col gap-1">
              {displayContacts.length === 0 && memberSearch.length >= 2 && (
                <p className="py-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No users found
                </p>
              )}
              {displayContacts.map((user) => {
                const isSelected = !!selectedMembers.find((m) => m.id === user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleMember(user)}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
                  >
                    <Avatar fallback={user.name || user.email || '?'} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <span className="block truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {user.name || user.email || user.id.slice(0, 12)}
                      </span>
                      {user.email && (
                        <span className="block truncate text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{user.email}</span>
                      )}
                    </div>
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full shrink-0"
                      style={{
                        backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                        border: isSelected ? 'none' : '1.5px solid var(--color-border)',
                      }}
                    >
                      {isSelected && <Check size={12} weight="bold" color="var(--color-bg)" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Step 3 — Permissions */}
        {step === 2 && (
          <Card>
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Permissions &amp; Limits</h2>
            <div className="flex flex-col gap-5">
              <Switch
                checked={requireApproval}
                onCheckedChange={setRequireApproval}
                label="Require withdrawal approval"
                description="Members need admin sign-off to withdraw"
                labelPosition="left"
              />

              <Input
                label="Per-transaction withdrawal limit (USDC)"
                type="number"
                value={withdrawLimit}
                onChange={(e) => setWithdrawLimit(e.target.value)}
                hint="Set to 0 for no limit"
              />
            </div>
          </Card>
        )}

        {/* Step 4 — Review */}
        {step === 3 && (
          <Card>
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Review &amp; Create</h2>
            <div className="flex items-center gap-4 mb-6 p-4 rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--color-white-5)' }}>
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl"
                style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}
              >
                {emoji}
              </div>
              <div>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{name || 'Untitled Wallet'}</p>
                {description && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>}
              </div>
            </div>

            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Members</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {selectedMembers.length} invited
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Approval required</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{requireApproval ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Withdrawal limit</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
                  {withdrawLimit === '0' ? 'None' : `$${withdrawLimit} USDC`}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              A new Solana wallet will be generated for this shared wallet. Fund it by sending USDC to its address.
            </p>
          </Card>
        )}

        {/* Nav buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button>
          )}
          <Button
            variant="primary"
            fullWidth
            disabled={!stepValid[step]}
            loading={creating}
            onClick={async () => {
              if (step < STEPS.length - 1) {
                setStep((s) => s + 1);
              } else {
                await handleCreate();
              }
            }}
          >
            {step === STEPS.length - 1 ? 'Create Wallet' : 'Continue'}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
