'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, X, Image } from '@phosphor-icons/react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { getSharedWalletById, createExpense } from '@/lib/firebase/queries';
import { storage } from '@/lib/firebase';
import { formatCurrency } from '@/lib/utils';
import { useAppStore } from '@/store';

export default function AddExpensePage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['sharedWallet', walletId],
    queryFn: () => getSharedWalletById(walletId),
    enabled: !!walletId,
  });

  const members = (wallet?.members ?? []).map((m) => ({
    id: m.user_id,
    name: m.name || m.user_id.slice(0, 8),
    isMe: m.user_id === userId,
  }));

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState('');
  const [splitWithIds, setSplitWithIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'details' | 'split'>('details');
  const [submitting, setSubmitting] = useState(false);

  // Receipt photo upload
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReceiptSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate: image only, max 10 MB
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Image must be under 10 MB', variant: 'error' });
      return;
    }
    setReceiptFile(file);
    const objectUrl = URL.createObjectURL(file);
    setReceiptPreview(objectUrl);
  }, [toast]);

  const clearReceipt = useCallback(() => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [receiptPreview]);

  /**
   * Upload the selected receipt to Firebase Storage.
   * Path: sharedWalletReceipts/{walletId}/{expenseId}
   * Returns the download URL, or null if no file selected.
   */
  async function uploadReceiptToStorage(expenseId: string): Promise<string | null> {
    if (!receiptFile) return null;
    setUploadingReceipt(true);
    try {
      const ext = receiptFile.name.split('.').pop() ?? 'jpg';
      const path = `sharedWalletReceipts/${walletId}/${expenseId}.${ext}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, receiptFile, {
        contentType: receiptFile.type,
        customMetadata: { walletId, expenseId },
      });
      const downloadUrl = await getDownloadURL(fileRef);
      return downloadUrl;
    } catch (err) {
      console.error('[AddExpense] Receipt upload failed', err);
      // Non-fatal: expense is still created, just without a receipt
      toast({ title: 'Receipt upload failed', description: 'Expense saved without receipt.', variant: 'warning' });
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  }

  // Split method: equal divides evenly, custom lets each person set their own amount
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  // Custom per-person amounts (userId → string input value)
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Auto-select current user as payer + all members for split when wallet loads
  useEffect(() => {
    if (paidById !== '' || members.length === 0) return;
    const me = members.find((m) => m.isMe);
    setPaidById(me?.id ?? members[0]!.id);
    setSplitWithIds(members.map((m) => m.id));
  }, [wallet]); // eslint-disable-line react-hooks/exhaustive-deps

  const canProceed = title.trim().length > 0 && parseFloat(amount) > 0;
  const parsedAmount = parseFloat(amount) || 0;

  // Custom mode: sum of all entered amounts
  const customTotal = Object.values(customAmounts).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0,
  );
  const customDiff = Math.abs(customTotal - parsedAmount);
  const customAmountsValid = customDiff < 0.01 && Object.values(customAmounts).some((v) => parseFloat(v) > 0);

  // Build the payer's display name
  const payerMember = members.find((m) => m.id === paidById);
  const payerName = payerMember?.isMe ? (currentUser?.name || 'You') : (payerMember?.name || paidById);

  function handleSwitchToCustom() {
    // Pre-fill equal amounts as starting point
    const share = parsedAmount > 0 && members.length > 0
      ? (parsedAmount / members.length).toFixed(2)
      : '';
    const initial: Record<string, string> = {};
    members.forEach((m) => { initial[m.id] = share; });
    setCustomAmounts(initial);
    setSplitMode('custom');
  }

  function handleSwitchToEqual() {
    setSplitMode('equal');
    // Restore all-members selection
    setSplitWithIds(members.map((m) => m.id));
  }

  async function handleAddExpense() {
    if (!userId) {
      toast({ title: 'Not signed in', variant: 'error' });
      return;
    }

    let splitBetween: { userId: string; userName: string; amount: number }[];

    if (splitMode === 'equal') {
      if (splitWithIds.length === 0) {
        toast({ title: 'Select at least one person to split with', variant: 'error' });
        return;
      }
      const sharePerPerson = parsedAmount / splitWithIds.length;
      splitBetween = splitWithIds.map((id) => {
        const member = members.find((m) => m.id === id);
        const name = member?.isMe ? (currentUser?.name || 'You') : (member?.name || id);
        return { userId: id, userName: name, amount: sharePerPerson };
      });
    } else {
      // Custom — include members with amount > 0
      splitBetween = members
        .filter((m) => (parseFloat(customAmounts[m.id] ?? '0') || 0) > 0)
        .map((m) => ({
          userId: m.id,
          userName: m.isMe ? (currentUser?.name || 'You') : m.name,
          amount: parseFloat(customAmounts[m.id]!) || 0,
        }));

      if (splitBetween.length === 0) {
        toast({ title: 'Enter at least one person\'s amount', variant: 'error' });
        return;
      }
      if (customDiff >= 0.01) {
        toast({
          title: 'Amounts don\'t add up',
          description: `Total entered: ${formatCurrency(customTotal)}, expense: ${formatCurrency(parsedAmount)}`,
          variant: 'error',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      // Create the expense first to get the generated ID
      const expenseId = await createExpense({
        walletId,
        name: title.trim(),
        amount: parsedAmount,
        date: new Date().toISOString().split('T')[0]!,
        splitMethod: splitMode,
        splitBetween,
        recordedById: paidById,
        recordedByName: payerName,
        note: note.trim() || undefined,
      });

      // Upload receipt photo if selected (non-fatal if it fails)
      if (receiptFile) {
        const receiptUrl = await uploadReceiptToStorage(expenseId);
        if (receiptUrl) {
          // Update the expense doc with the receipt URL
          const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
          const { db: firestoreDb } = await import('@/lib/firebase');
          await updateDoc(firestoreDoc(firestoreDb, 'sharedWalletExpenses', expenseId), {
            receipt_url: receiptUrl,
            receiptUrl,
            has_receipt: true,
            hasReceipt: true,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['sharedWalletExpenses', walletId] });
      queryClient.invalidateQueries({ queryKey: ['sharedWallet', walletId] });

      toast({
        title: 'Expense added',
        description: `${formatCurrency(parsedAmount)} for "${title.trim()}"`,
        variant: 'success',
      });
      router.push(`/shared-wallets/${walletId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add expense. Please try again.';
      toast({ title: 'Failed to add expense', description: message, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <div className="flex flex-col gap-5 max-w-lg">
          <Skeleton width={200} height={32} radius="sm" />
          <Skeleton width="100%" height={200} radius="lg" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      <div className="flex flex-col gap-5 max-w-lg">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Add Expense</h1>

        {step === 'details' ? (
          <>
            <Card>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>Expense Details</h3>
              <div className="flex flex-col gap-4">
                <Input label="What was it for?" placeholder="e.g. Grocery run, Restaurant, Utilities..." value={title} onChange={(e) => setTitle(e.target.value)} />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Amount</label>
                  <div className="flex items-center gap-2 h-12 rounded-[var(--radius-lg)] px-4" style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-border)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--color-text-disabled)]"
                      style={{ color: 'var(--color-text)' }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Paid by</label>
                  <select
                    value={paidById}
                    onChange={(e) => setPaidById(e.target.value)}
                    className="h-12 w-full rounded-[var(--radius-lg)] px-4 text-sm outline-none"
                    style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id} style={{ backgroundColor: 'var(--color-surface)' }}>
                        {m.isMe ? 'You' : m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Note (optional)</label>
                  <textarea
                    placeholder="Additional details..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-[var(--radius-lg)] px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)] placeholder:text-[var(--color-text-disabled)]"
                    style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>

                {/* Receipt Photo Upload */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Receipt Photo (optional)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReceiptSelect}
                  />
                  {receiptPreview ? (
                    <div className="relative w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={receiptPreview}
                        alt="Receipt preview"
                        className="w-full max-h-48 object-cover rounded-[var(--radius-lg)]"
                        style={{ border: '1px solid var(--color-border)' }}
                      />
                      <button
                        type="button"
                        onClick={clearReceipt}
                        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full shadow-lg transition-opacity hover:opacity-80"
                        style={{ backgroundColor: 'var(--color-error)' }}
                        aria-label="Remove receipt"
                      >
                        <X size={14} color="#fff" weight="bold" />
                      </button>
                      <div
                        className="mt-1 flex items-center gap-1 text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        <Image size={12} />
                        <span>{receiptFile?.name}</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] py-6 transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--color-white-5)',
                        border: '2px dashed var(--color-border)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <Camera size={24} />
                      <span className="text-xs font-medium">Upload receipt photo</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                        JPG, PNG, HEIC up to 10 MB
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </Card>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={!canProceed}
              onClick={() => setStep('split')}
            >
              Continue to Split
            </Button>
          </>
        ) : (
          <>
            <Card>
              {/* Split method toggle */}
              <div className="mb-4">
                <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  Split {formatCurrency(parsedAmount)}
                </h3>
                <div className="flex gap-2">
                  {(['equal', 'custom'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => mode === 'custom' ? handleSwitchToCustom() : handleSwitchToEqual()}
                      className="flex-1 rounded-[var(--radius-md)] py-2 text-sm font-semibold transition-all capitalize"
                      style={{
                        backgroundColor: splitMode === mode ? 'var(--color-primary)' : 'var(--color-white-10)',
                        color: splitMode === mode ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {mode === 'equal' ? 'Equal' : 'Custom'}
                    </button>
                  ))}
                </div>
              </div>

              {splitMode === 'equal' ? (
                <>
                  <p className="mb-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Each person: {splitWithIds.length ? formatCurrency(parsedAmount / splitWithIds.length) : '$0.00'}
                  </p>
                  {members.map((m) => {
                    const included = splitWithIds.includes(m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {m.isMe ? 'You' : m.name}
                        </span>
                        <Switch
                          size="sm"
                          checked={included}
                          onCheckedChange={(v) =>
                            setSplitWithIds((prev) =>
                              v ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                            )
                          }
                        />
                      </div>
                    );
                  })}

                  {splitWithIds.length === 0 && (
                    <p className="mt-3 text-xs text-center" style={{ color: 'var(--color-error)' }}>
                      Select at least one person to split with
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mb-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Enter how much each person owes. Must total {formatCurrency(parsedAmount)}.
                  </p>
                  <div className="flex flex-col gap-3">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }}>
                          {m.isMe ? 'You' : m.name}
                        </span>
                        <div className="flex items-center gap-1.5 h-9 rounded-[var(--radius-md)] px-3 w-32 shrink-0" style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-border)' }}>
                          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={customAmounts[m.id] ?? ''}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                            }
                            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--color-text-disabled)] text-right"
                            style={{ color: 'var(--color-text)' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Running total indicator */}
                  <div className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2" style={{ backgroundColor: 'var(--color-white-5)' }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Total entered
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: customDiff < 0.01 ? 'var(--color-success)' : 'var(--color-error)',
                        fontFamily: 'var(--font-family-number)',
                      }}
                    >
                      {formatCurrency(customTotal)} / {formatCurrency(parsedAmount)}
                    </span>
                  </div>

                  {customDiff >= 0.01 && customTotal > 0 && (
                    <p className="mt-2 text-xs text-center" style={{ color: 'var(--color-error)' }}>
                      {customTotal > parsedAmount
                        ? `Over by ${formatCurrency(customTotal - parsedAmount)}`
                        : `Under by ${formatCurrency(parsedAmount - customTotal)}`}
                    </p>
                  )}
                </>
              )}
            </Card>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStep('details')}>Back</Button>
              <Button
                variant="primary"
                fullWidth
                loading={submitting || uploadingReceipt}
                disabled={
                  splitMode === 'equal'
                    ? splitWithIds.length === 0
                    : !customAmountsValid
                }
                onClick={handleAddExpense}
              >
                {uploadingReceipt ? 'Uploading receipt…' : 'Add Expense'}
              </Button>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}

