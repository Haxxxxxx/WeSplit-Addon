/**
 * Split Storage Service
 * Manages split data storage and retrieval in Firebase
 * Handles the complete lifecycle of splits from creation to completion
 *
 * Ported from mobile: src/services/splits/splitStorageService.ts
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  FIRESTORE_COLLECTIONS,
  SPLIT_STATUS,
  type Split,
  type SplitParticipant,
  type SplitResult,
  type SplitListResult,
  type SplitStatus,
  type SplitStorageStatus,
} from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Remove undefined values from an object (Firebase rejects undefined)
 */
function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedValues) as unknown as T;

  const cleaned = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (cleaned as Record<string, unknown>)[key] = removeUndefinedValues(
        value as Record<string, unknown>
      );
    }
  }
  return cleaned;
}

/**
 * Generate a unique split ID
 */
function generateSplitId(): string {
  return `split_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ---------------------------------------------------------------------------
// Create Split
// ---------------------------------------------------------------------------

export interface CreateSplitParams {
  billId: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency?: string;
  category?: string;
  splitType?: 'spend';
  splitMethod?: 'equal' | 'manual';
  creatorId: string;
  creatorName: string;
  participants: SplitParticipant[];
  items?: Split['items'];
  merchant?: Split['merchant'];
  date?: string;
  /** Telegram group this split was created from (e.g. "tg_group_-100123") */
  telegramGroupId?: string;
}

/**
 * Create a new split in Firestore
 */
export async function createSplit(
  params: CreateSplitParams
): Promise<SplitResult> {
  try {
    const now = new Date().toISOString();
    const splitId = generateSplitId();

    const split: Omit<Split, 'firebaseDocId'> = {
      id: splitId,
      billId: params.billId,
      title: params.title.trim(),
      description: params.description?.trim(),
      totalAmount: params.totalAmount,
      currency: params.currency ?? 'USDC',
      category: params.category,
      splitType: params.splitType ?? 'spend',
      splitMethod: params.splitMethod ?? 'equal',
      status: SPLIT_STATUS.DRAFT as SplitStatus,
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      participants: params.participants,
      items: params.items,
      merchant: params.merchant,
      date: params.date ?? now,
      createdAt: now,
      updatedAt: now,
    };

    // Remove undefined values to prevent Firebase errors
    // Include snake_case fields for mobile app compatibility
    // participantIds: top-level array for Firestore array-contains queries (AR-A7)
    const participantIds = params.participants.map((p) => p.userId).filter(Boolean);
    const cleanedSplit = removeUndefinedValues({
      ...split,
      bill_id: params.billId,
      created_by: params.creatorId,
      creator_name: params.creatorName,
      total_amount: params.totalAmount,
      split_type: params.splitType ?? 'spend',
      split_method: params.splitMethod ?? 'equal',
      per_person_amount: params.totalAmount / Math.max(params.participants.length, 1),
      created_at: now,
      updated_at: now,
      description: params.description?.trim(),
      // Denormalized participant IDs for efficient Firestore queries
      participantIds,
      participant_ids: participantIds,
      // Telegram group association (if created from group context)
      ...(params.telegramGroupId ? { telegram_group_id: params.telegramGroupId } : {}),
    });
    const docRef = await addDoc(
      collection(db, FIRESTORE_COLLECTIONS.SPLITS),
      cleanedSplit
    );

    const createdSplit: Split = {
      ...split,
      firebaseDocId: docRef.id,
    };

    return {
      success: true,
      split: createdSplit,
    };
  } catch (error) {
    console.error('[SplitStorageService] Error creating split:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ---------------------------------------------------------------------------
// Get Split
// ---------------------------------------------------------------------------

/**
 * Get a split by its internal ID or Firebase document ID
 */
export async function getSplit(splitId: string): Promise<SplitResult> {
  try {
    // First try by Firebase document ID (if it looks like one)
    if (splitId.length > 20 && !splitId.startsWith('split_')) {
      const splitDoc = await getDoc(
        doc(db, FIRESTORE_COLLECTIONS.SPLITS, splitId)
      );

      if (splitDoc.exists()) {
        const splitData = splitDoc.data() as Split;
        return {
          success: true,
          split: { ...splitData, firebaseDocId: splitDoc.id },
        };
      }
    }

    // Try by internal ID field
    const splitsRef = collection(db, FIRESTORE_COLLECTIONS.SPLITS);
    const q = query(splitsRef, where('id', '==', splitId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty && querySnapshot.docs[0]) {
      const splitDoc = querySnapshot.docs[0];
      const splitData = splitDoc.data() as Split;
      return {
        success: true,
        split: { ...splitData, firebaseDocId: splitDoc.id },
      };
    }

    return {
      success: false,
      error: 'Split not found',
    };
  } catch (error) {
    console.error('[SplitStorageService] Error getting split:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get a split by billId
 */
export async function getSplitByBillId(billId: string): Promise<SplitResult> {
  try {
    const splitsRef = collection(db, FIRESTORE_COLLECTIONS.SPLITS);
    const q = query(
      splitsRef,
      where('billId', '==', billId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty || !querySnapshot.docs[0]) {
      return {
        success: false,
        error: 'Split not found',
      };
    }

    const splitDoc = querySnapshot.docs[0];
    const splitData = splitDoc.data() as Split;

    return {
      success: true,
      split: { ...splitData, firebaseDocId: splitDoc.id },
    };
  } catch (error) {
    console.error('[SplitStorageService] Error getting split by billId:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ---------------------------------------------------------------------------
// List Splits
// ---------------------------------------------------------------------------

/**
 * Get splits for a user (as creator or participant) with pagination
 */
export async function getUserSplits(
  userId: string,
  limitCount = 20,
  pageNumber = 1,
  lastDoc?: QueryDocumentSnapshot
): Promise<SplitListResult> {
  try {
    const splitsRef = collection(db, FIRESTORE_COLLECTIONS.SPLITS);

    // Query splits where user is creator
    const creatorQuery = query(
      splitsRef,
      where('creatorId', '==', userId),
      orderBy('createdAt', 'desc'),
      ...(lastDoc && pageNumber > 1 ? [startAfter(lastDoc)] : []),
      limit(limitCount)
    );

    // Query splits where user is a participant (using top-level participantIds array)
    // NOTE: Requires Firestore composite index on (participantIds, createdAt desc)
    const participantQuery = query(
      splitsRef,
      where('participantIds', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      ...(lastDoc && pageNumber > 1 ? [startAfter(lastDoc)] : []),
      limit(limitCount)
    );

    const [creatorSnapshot, participantSnapshot] = await Promise.all([
      getDocs(creatorQuery),
      getDocs(participantQuery).catch(() => null), // Index may not exist yet
    ]);

    const splits: Split[] = [];
    const seenIds = new Set<string>();

    // Add creator splits
    creatorSnapshot.docs.forEach((docSnap) => {
      const splitData = docSnap.data() as Split;
      if (!seenIds.has(docSnap.id)) {
        splits.push({ ...splitData, firebaseDocId: docSnap.id });
        seenIds.add(docSnap.id);
      }
    });

    // Add participant splits
    (participantSnapshot?.docs ?? []).forEach((docSnap) => {
      if (seenIds.has(docSnap.id)) return;
      const splitData = docSnap.data() as Split;
      splits.push({ ...splitData, firebaseDocId: docSnap.id });
      seenIds.add(docSnap.id);
    });

    // Sort by creation date (newest first)
    splits.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply limit after merging
    const limitedSplits = splits.slice(0, limitCount);
    const hasMore = limitedSplits.length === limitCount;

    // Get last document for pagination
    let lastDocument: QueryDocumentSnapshot | undefined;
    if (creatorSnapshot.docs.length > 0) {
      lastDocument = creatorSnapshot.docs[creatorSnapshot.docs.length - 1];
    }

    return {
      success: true,
      splits: limitedSplits,
      hasMore,
      currentPage: pageNumber,
    };
  } catch (error) {
    console.error('[SplitStorageService] Error getting user splits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get splits by status for a user
 */
export async function getSplitsByStatus(
  status: SplitStatus,
  userId?: string
): Promise<SplitListResult> {
  try {
    const splitsRef = collection(db, FIRESTORE_COLLECTIONS.SPLITS);
    let q;

    if (userId) {
      q = query(
        splitsRef,
        where('status', '==', status),
        where('creatorId', '==', userId),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        splitsRef,
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
    }

    const querySnapshot = await getDocs(q);
    const splits: Split[] = querySnapshot.docs.map((docSnap) => ({
      ...(docSnap.data() as Split),
      firebaseDocId: docSnap.id,
    }));

    return {
      success: true,
      splits,
    };
  } catch (error) {
    console.error('[SplitStorageService] Error getting splits by status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ---------------------------------------------------------------------------
// Update Split
// ---------------------------------------------------------------------------

/**
 * Update a split's data
 */
export async function updateSplit(
  splitId: string,
  updates: Partial<Split>
): Promise<SplitResult> {
  try {
    const splitResult = await getSplit(splitId);
    if (!splitResult.success || !splitResult.split) {
      return splitResult;
    }

    const split = splitResult.split;
    const docId = split.firebaseDocId || splitId;

    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Remove undefined values
    const cleanedUpdateData = removeUndefinedValues(updateData);

    await updateDoc(
      doc(db, FIRESTORE_COLLECTIONS.SPLITS, docId),
      cleanedUpdateData
    );

    const updatedSplit: Split = {
      ...split,
      ...updateData,
    };

    return {
      success: true,
      split: updatedSplit,
    };
  } catch (error) {
    console.error('[SplitStorageService] Error updating split:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Update split status
 */
export async function updateSplitStatus(
  splitId: string,
  status: SplitStatus,
  completedAt?: string
): Promise<SplitResult> {
  const updates: Partial<Split> = { status };
  if (completedAt) {
    updates.completedAt = completedAt;
  }
  return updateSplit(splitId, updates);
}

/**
 * Update split with wallet information
 */
export async function updateSplitWithWallet(
  splitId: string,
  walletId: string,
  walletAddress: string
): Promise<SplitResult> {
  return updateSplit(splitId, {
    walletId,
    walletAddress,
  });
}

// ---------------------------------------------------------------------------
// Participant Management
// ---------------------------------------------------------------------------

/**
 * Add a participant to a split or update existing participant
 */
export async function addParticipant(
  splitId: string,
  participant: SplitParticipant
): Promise<SplitResult> {
  try {
    const splitResult = await getSplit(splitId);
    if (!splitResult.success || !splitResult.split) {
      return splitResult;
    }

    const split = splitResult.split;
    const existingIndex = split.participants.findIndex(
      (p) => p.userId === participant.userId
    );

    let updatedParticipants: SplitParticipant[];

    if (existingIndex >= 0) {
      // Update existing participant
      updatedParticipants = [...split.participants];
      const existingParticipant = updatedParticipants[existingIndex];
      if (existingParticipant) {
        updatedParticipants[existingIndex] = {
          ...existingParticipant,
          ...participant,
          joinedAt: existingParticipant.joinedAt || new Date().toISOString(),
        };
      }
    } else {
      // Add new participant
      updatedParticipants = [
        ...split.participants,
        {
          ...participant,
          joinedAt: new Date().toISOString(),
        },
      ];
    }

    return updateSplit(splitId, { participants: updatedParticipants });
  } catch (error) {
    console.error('[SplitStorageService] Error adding participant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Update participant status
 */
export async function updateParticipantStatus(
  splitId: string,
  userId: string,
  status: SplitStorageStatus,
  amountPaid?: number,
  transactionSignature?: string
): Promise<SplitResult> {
  try {
    // Try to get split by ID first, then by billId if not found
    let splitResult = await getSplit(splitId);
    if (!splitResult.success && splitId.startsWith('bill_')) {
      splitResult = await getSplitByBillId(splitId);
    }

    if (!splitResult.success || !splitResult.split) {
      return splitResult;
    }

    const split = splitResult.split;

    const updatedParticipants = split.participants.map((p) => {
      if (p.userId === userId) {
        const paidAt = status === 'paid' ? new Date().toISOString() : p.paidAt;
        const paid = amountPaid !== undefined ? amountPaid : p.amountPaid;
        const txSig = transactionSignature || p.transactionSignature;
        return {
          ...p,
          // S3-7: full dual-format coverage for cross-platform compat
          status,
          amountPaid: paid,
          transactionId: txSig,
          transactionSignature: txSig,
          paidAt,
          // snake_case for mobile compat
          participant_status: status,
          paid_amount: paid,
          amount_paid: paid,
          transaction_id: txSig,
          paid_at: paidAt,
        };
      }
      return p;
    });

    return updateSplit(split.id, { participants: updatedParticipants });
  } catch (error) {
    console.error('[SplitStorageService] Error updating participant status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Remove a participant from a split
 */
export async function removeParticipant(
  splitId: string,
  userId: string
): Promise<SplitResult> {
  try {
    const splitResult = await getSplit(splitId);
    if (!splitResult.success || !splitResult.split) {
      return splitResult;
    }

    const split = splitResult.split;
    const updatedParticipants = split.participants.filter(
      (p) => p.userId !== userId
    );

    return updateSplit(splitId, { participants: updatedParticipants });
  } catch (error) {
    console.error('[SplitStorageService] Error removing participant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ---------------------------------------------------------------------------
// Delete Split
// ---------------------------------------------------------------------------

/**
 * Delete a split
 */
export async function deleteSplit(
  splitId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const splitResult = await getSplit(splitId);
    if (!splitResult.success || !splitResult.split) {
      return {
        success: false,
        error: 'Split not found',
      };
    }

    const split = splitResult.split;
    const docId = split.firebaseDocId || splitId;

    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.SPLITS, docId));

    return { success: true };
  } catch (error) {
    console.error('[SplitStorageService] Error deleting split:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Force refresh split data from database (bypass caches)
 */
export async function forceRefreshSplit(splitId: string): Promise<SplitResult> {
  return getSplit(splitId);
}

/**
 * Check if all participants have paid
 */
export function isSplitFullyPaid(split: Split): boolean {
  return split.participants.every((p) => p.status === 'paid');
}

/**
 * Calculate total amount paid by all participants
 */
export function calculateTotalPaid(split: Split): number {
  return split.participants.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
}

/**
 * Get remaining amount to be paid
 */
export function getRemainingAmount(split: Split): number {
  const totalPaid = calculateTotalPaid(split);
  return Math.max(0, split.totalAmount - totalPaid);
}

// ---------------------------------------------------------------------------
// Export Service Object
// ---------------------------------------------------------------------------

export const splitStorageService = {
  createSplit,
  getSplit,
  getSplitByBillId,
  getUserSplits,
  getSplitsByStatus,
  updateSplit,
  updateSplitStatus,
  updateSplitWithWallet,
  addParticipant,
  updateParticipantStatus,
  removeParticipant,
  deleteSplit,
  forceRefreshSplit,
  isSplitFullyPaid,
  calculateTotalPaid,
  getRemainingAmount,
};
