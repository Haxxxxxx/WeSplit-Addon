/**
 * Split Wallet Service
 * Handles creation and initialization of split wallets for Spend splits
 * Web-adapted from mobile: src/services/split/SplitWalletCreation.ts
 *
 * Each split gets a DEDICATED Solana keypair, matching mobile behavior:
 * - A new Keypair is generated for each split (Keypair.generate())
 * - The split wallet address is the generated keypair's public key
 * - Participants send USDC/SOL to this dedicated address
 * - The private key is stored in Firestore under splitWalletPrivateKeys/{splitWalletId}/participants/{creatorId}
 * - When the creator completes/withdraws, the stored private key signs a transfer to creatorReceivingAddress
 *
 * Security note: Private keys are protected by Firestore security rules (creator-only read access).
 * This is less secure than mobile's hardware SecureStore, but follows the same schema.
 */

import { collection, addDoc, doc, getDoc, getDocs, query, where, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Keypair } from '@solana/web3.js';
import { db } from '@/lib/firebase';
import {
  FIRESTORE_COLLECTIONS,
  SPLIT_WALLET_STATUS,
  PARTICIPANT_STATUS,
  type SplitWallet,
  type SplitWalletParticipant,
  type SplitWalletResult,
  type ParticipantStatus,
} from '@/types';
import { roundUsdcAmount } from '@/lib/utils';
import {
  validateCreationParams,
  validateWalletAddress,
} from './splitValidationService';
import * as splitStorageService from './splitStorageService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALIDATION_TOLERANCE = {
  AMOUNT: 0.01, // 0.01 USDC tolerance for rounding
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a unique split wallet ID
 */
function generateSplitWalletId(): string {
  return `split_wallet_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

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

// ---------------------------------------------------------------------------
// Core Service Class
// ---------------------------------------------------------------------------

export class SplitWalletService {
  /**
   * Create a new split wallet for a bill with a DEDICATED Solana keypair.
   *
   * Matches mobile behavior (SplitWalletCreation.ts):
   * - Generates a new Keypair.generate() for each split
   * - Participants send funds to the dedicated split wallet address
   * - Private key is stored in Firestore for creator's use at completion
   *
   * @param billId - Unique bill ID
   * @param creatorId - Firebase UID of the creator
   * @param creatorReceivingAddress - Creator's connected wallet where funds go at completion
   * @param totalAmount - Total amount in USDC
   * @param currency - Currency (default 'USDC')
   * @param participants - Participants with amounts owed
   */
  static async createSplitWallet(
    billId: string,
    creatorId: string,
    creatorReceivingAddress: string,
    totalAmount: number,
    currency: string = 'USDC',
    participants: Array<{
      userId: string;
      name: string;
      walletAddress: string;
      amountOwed: number;
    }>
  ): Promise<SplitWalletResult> {
    try {
      // Validate creation parameters
      const validation = await validateCreationParams({
        billId,
        creatorId,
        totalAmount,
        currency,
        participants,
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join('; '),
        };
      }

      // Validate creator receiving address (where funds land at completion)
      const addressValidation = validateWalletAddress(creatorReceivingAddress);
      if (!addressValidation.isValid) {
        return {
          success: false,
          error: `Creator wallet: ${addressValidation.errors.join(', ')}`,
        };
      }

      // Check if wallet already exists for this billId
      const existingWallet = await this.getSplitWalletByBillId(billId);
      if (existingWallet.success && existingWallet.wallet) {
        console.warn('[SplitWalletService] Split wallet already exists for this bill', {
          billId,
          existingWalletId: existingWallet.wallet.id,
        });
        return {
          success: false,
          error: 'A split wallet already exists for this bill',
          wallet: existingWallet.wallet,
        };
      }

      // Generate a dedicated Solana keypair for this split
      // Matches mobile: generateWalletFromMnemonic() in SplitWalletCreation.ts
      const splitKeypair = Keypair.generate();
      const splitWalletAddress = splitKeypair.publicKey.toBase58();
      const splitPrivateKeyBase64 = Buffer.from(splitKeypair.secretKey).toString('base64');

      console.info('[SplitWalletService] Generated dedicated split wallet keypair', {
        billId,
        creatorId,
        splitWalletAddress,
        totalAmount,
        currency,
        participantsCount: participants.length,
      });

      // Create split wallet record
      const splitWalletId = generateSplitWalletId();
      const now = new Date().toISOString();

      // S2-1: build participant_ids array for efficient array-contains queries
      const participantIds = participants.map((p) => p.userId);

      const splitWalletData: Omit<SplitWallet, 'firebaseDocId'> & Record<string, unknown> = {
        id: splitWalletId,
        billId,
        creatorId,
        walletAddress: splitWalletAddress,  // Dedicated split address
        publicKey: splitWalletAddress,       // Same for web
        creatorReceivingAddress,             // Creator's own wallet (receives at completion)
        totalAmount: roundUsdcAmount(totalAmount),
        currency,
        status: SPLIT_WALLET_STATUS.ACTIVE,
        participants: participants.map((p) => ({
          userId: p.userId,
          name: p.name,
          walletAddress: p.walletAddress,
          amountOwed: roundUsdcAmount(p.amountOwed),
          amountPaid: 0,
          status: PARTICIPANT_STATUS.PENDING as ParticipantStatus,
        })),
        // S2-1: participant_ids for efficient Firestore array-contains queries
        participant_ids: participantIds,
        participantIds,
        createdAt: now,
        updatedAt: now,
        // snake_case for mobile compat
        bill_id: billId,
        creator_id: creatorId,
        split_id: billId,
        wallet_address: splitWalletAddress,
        creator_receiving_address: creatorReceivingAddress,
        total_amount: roundUsdcAmount(totalAmount),
        is_funded: false,
        created_at: now,
        updated_at: now,
      };

      // Remove undefined values before storing
      const cleanedData = removeUndefinedValues(splitWalletData);

      // Store split wallet record in Firebase
      const docRef = await addDoc(
        collection(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS),
        cleanedData
      );

      const createdSplitWallet: SplitWallet = {
        ...splitWalletData,
        firebaseDocId: docRef.id,
      };

      // Store the private key in Firestore for creator use at withdrawal
      // Path: splitWalletPrivateKeys/{splitWalletId}/participants/{creatorId}
      // Protected by Firestore security rules (creator-only read access)
      try {
        await setDoc(
          doc(
            db,
            FIRESTORE_COLLECTIONS.SPLIT_WALLET_PRIVATE_KEYS,
            splitWalletId,
            'participants',
            creatorId
          ),
          {
            encrypted_key: splitPrivateKeyBase64,
            encryption_method: 'web_base64', // Base64, secured by Firestore rules
            // snake_case (web)
            user_id: creatorId,
            split_wallet_id: splitWalletId,
            bill_id: billId,
            created_at: serverTimestamp(),
            // S3-4: camelCase for mobile compat
            userId: creatorId,
            splitWalletId,
            billId,
            createdAt: serverTimestamp(),
          }
        );
        console.info('[SplitWalletService] Private key stored in Firestore', {
          splitWalletId,
          creatorId,
        });
      } catch (keyStoreError) {
        // Private key storage failure: roll back the wallet document
        console.error('[SplitWalletService] Failed to store private key — rolling back wallet', {
          splitWalletId,
          error: keyStoreError instanceof Error ? keyStoreError.message : String(keyStoreError),
        });
        // Mark wallet as cancelled so it can be identified and cleaned up
        try {
          await updateDoc(doc(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS, docRef.id), {
            status: 'cancelled',
            error: 'Private key storage failed',
            updatedAt: now,
          });
        } catch (_cleanupErr) {
          // Ignore cleanup error — wallet is orphaned but inaccessible without key
        }
        return {
          success: false,
          error: 'Failed to securely store split wallet key. Please try again.',
        };
      }

      // Update the split document with wallet address information
      const splitUpdateResult = await splitStorageService.updateSplit(billId, {
        walletId: createdSplitWallet.id,
        walletAddress: createdSplitWallet.walletAddress,
      });

      if (!splitUpdateResult.success) {
        console.warn('[SplitWalletService] Failed to update split document with wallet info', {
          splitWalletId: createdSplitWallet.id,
          billId,
          error: splitUpdateResult.error,
        });
        // Non-fatal — wallet is created and key is stored; sync can be retried
      }

      console.info('[SplitWalletService] Split wallet created successfully', {
        splitWalletId: createdSplitWallet.id,
        firebaseDocId: docRef.id,
        splitWalletAddress,
        creatorReceivingAddress,
        totalAmount: createdSplitWallet.totalAmount,
        participantsCount: createdSplitWallet.participants.length,
      });

      return {
        success: true,
        wallet: createdSplitWallet,
      };
    } catch (error) {
      console.error('[SplitWalletService] Failed to create split wallet', {
        error: error instanceof Error ? error.message : String(error),
        billId,
        creatorId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Retrieve the private key for a split wallet (creator use only).
   * Used when the creator needs to sign a withdrawal from the split wallet.
   *
   * @param splitWalletId - The split wallet ID
   * @param creatorId - The creator's Firebase UID (must match stored key)
   * @returns Base64-encoded private key, or null if not found
   */
  static async retrieveSplitWalletPrivateKey(
    splitWalletId: string,
    creatorId: string
  ): Promise<{ success: boolean; privateKeyBase64?: string; error?: string }> {
    try {
      const keyDocRef = doc(
        db,
        FIRESTORE_COLLECTIONS.SPLIT_WALLET_PRIVATE_KEYS,
        splitWalletId,
        'participants',
        creatorId
      );
      const keyDoc = await getDoc(keyDocRef);

      if (!keyDoc.exists()) {
        return {
          success: false,
          error: 'Private key not found for this split wallet',
        };
      }

      const data = keyDoc.data();
      const privateKeyBase64 = data?.encrypted_key as string | undefined;

      if (!privateKeyBase64) {
        return {
          success: false,
          error: 'Private key data is missing or corrupted',
        };
      }

      return {
        success: true,
        privateKeyBase64,
      };
    } catch (error) {
      console.error('[SplitWalletService] Failed to retrieve private key', {
        splitWalletId,
        creatorId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get a split wallet by its ID
   */
  static async getSplitWallet(splitWalletId: string): Promise<SplitWalletResult> {
    try {
      // Try to get by Firebase document ID first
      const docRef = doc(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS, splitWalletId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const walletData = docSnap.data() as SplitWallet;
        return {
          success: true,
          wallet: { ...walletData, firebaseDocId: docSnap.id },
        };
      }

      // If not found by Firebase ID, try to find by custom ID
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS),
        where('id', '==', splitWalletId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty && querySnapshot.docs[0]) {
        const walletDoc = querySnapshot.docs[0];
        const walletData = walletDoc.data() as SplitWallet;
        return {
          success: true,
          wallet: { ...walletData, firebaseDocId: walletDoc.id },
        };
      }

      return {
        success: false,
        error: 'Split wallet not found',
      };
    } catch (error) {
      console.error('[SplitWalletService] Error getting split wallet', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get a split wallet by bill ID
   */
  static async getSplitWalletByBillId(billId: string): Promise<SplitWalletResult> {
    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS),
        where('billId', '==', billId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty || !querySnapshot.docs[0]) {
        return {
          success: false,
          error: 'Split wallet not found for bill',
        };
      }

      const walletDoc = querySnapshot.docs[0];
      const walletData = walletDoc.data() as SplitWallet;

      return {
        success: true,
        wallet: { ...walletData, firebaseDocId: walletDoc.id },
      };
    } catch (error) {
      console.error('[SplitWalletService] Error getting split wallet by bill ID', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get all split wallets for a user (as creator or participant)
   */
  static async getUserSplitWallets(
    userId: string
  ): Promise<{ success: boolean; wallets?: SplitWallet[]; error?: string }> {
    try {
      // Query wallets where user is creator
      const creatorQuery = query(
        collection(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS),
        where('creatorId', '==', userId)
      );
      const creatorSnapshot = await getDocs(creatorQuery);

      const wallets: SplitWallet[] = [];
      const seenIds = new Set<string>();

      // Add creator wallets
      creatorSnapshot.docs.forEach((docSnap) => {
        const walletData = docSnap.data() as SplitWallet;
        if (!seenIds.has(walletData.id)) {
          wallets.push({ ...walletData, firebaseDocId: docSnap.id });
          seenIds.add(walletData.id);
        }
      });

      // S2-1: Query participant wallets using array-contains on participant_ids
      // (avoids fetching ALL wallets and filtering client-side)
      const participantQuery = query(
        collection(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS),
        where('participant_ids', 'array-contains', userId)
      );
      const participantSnapshot = await getDocs(participantQuery).catch(() => ({ docs: [] as typeof creatorSnapshot.docs }));

      participantSnapshot.docs.forEach((docSnap) => {
        const walletData = docSnap.data() as SplitWallet;
        if (!seenIds.has(walletData.id)) {
          wallets.push({ ...walletData, firebaseDocId: docSnap.id });
          seenIds.add(walletData.id);
        }
      });

      // Fallback: also check participantIds (camelCase) for wallets created before schema change
      const participantQueryCamel = query(
        collection(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS),
        where('participantIds', 'array-contains', userId)
      );
      const participantSnapshotCamel = await getDocs(participantQueryCamel).catch(() => ({ docs: [] as typeof creatorSnapshot.docs }));

      participantSnapshotCamel.docs.forEach((docSnap) => {
        const walletData = docSnap.data() as SplitWallet;
        if (!seenIds.has(walletData.id)) {
          wallets.push({ ...walletData, firebaseDocId: docSnap.id });
          seenIds.add(walletData.id);
        }
      });

      // Sort by creation date (newest first)
      wallets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        success: true,
        wallets,
      };
    } catch (error) {
      console.error('[SplitWalletService] Error getting user split wallets', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Update split wallet participant status
   */
  static async updateParticipantStatus(
    splitWalletId: string,
    userId: string,
    status: ParticipantStatus,
    amountPaid?: number,
    transactionSignature?: string
  ): Promise<SplitWalletResult> {
    try {
      const walletResult = await this.getSplitWallet(splitWalletId);
      if (!walletResult.success || !walletResult.wallet) {
        return walletResult;
      }

      const wallet = walletResult.wallet;
      const docId = wallet.firebaseDocId || splitWalletId;

      // Find and update the participant
      const updatedParticipants = wallet.participants.map((p) => {
        if (p.userId === userId) {
          return {
            ...p,
            status,
            amountPaid: amountPaid !== undefined ? amountPaid : p.amountPaid,
            transactionSignature: transactionSignature || p.transactionSignature,
            paidAt: status === PARTICIPANT_STATUS.PAID ? new Date().toISOString() : p.paidAt,
          };
        }
        return p;
      });

      // Check if all participants have paid
      const allPaid = updatedParticipants.every((p) => p.status === PARTICIPANT_STATUS.PAID);
      const newStatus = allPaid ? SPLIT_WALLET_STATUS.COMPLETED : wallet.status;

      const updateData = {
        participants: updatedParticipants,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(allPaid && {
          completedAt: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }),
      };

      await updateDoc(doc(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS, docId), updateData);

      const updatedWallet: SplitWallet = {
        ...wallet,
        ...updateData,
      };

      return {
        success: true,
        wallet: updatedWallet,
      };
    } catch (error) {
      console.error('[SplitWalletService] Error updating participant status', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Update split wallet status
   */
  static async updateSplitWalletStatus(
    splitWalletId: string,
    status: SplitWallet['status']
  ): Promise<SplitWalletResult> {
    try {
      const walletResult = await this.getSplitWallet(splitWalletId);
      if (!walletResult.success || !walletResult.wallet) {
        return walletResult;
      }

      const wallet = walletResult.wallet;
      const docId = wallet.firebaseDocId || splitWalletId;

      const updateData = {
        status,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(status === SPLIT_WALLET_STATUS.COMPLETED && {
          completedAt: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }),
      };

      await updateDoc(doc(db, FIRESTORE_COLLECTIONS.SPLIT_WALLETS, docId), updateData);

      return {
        success: true,
        wallet: { ...wallet, ...updateData },
      };
    } catch (error) {
      console.error('[SplitWalletService] Error updating split wallet status', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Check if all participants have paid their share
   */
  static isFullyPaid(wallet: SplitWallet): boolean {
    return wallet.participants.every(
      (p) => p.status === PARTICIPANT_STATUS.PAID || p.amountPaid >= p.amountOwed
    );
  }

  /**
   * Calculate total amount paid by all participants
   */
  static calculateTotalPaid(wallet: SplitWallet): number {
    return wallet.participants.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  }

  /**
   * Get remaining amount to be paid
   */
  static getRemainingAmount(wallet: SplitWallet): number {
    const totalPaid = this.calculateTotalPaid(wallet);
    return Math.max(0, wallet.totalAmount - totalPaid);
  }

  /**
   * Get a participant from a split wallet
   */
  static getParticipant(
    wallet: SplitWallet,
    userId: string
  ): SplitWalletParticipant | undefined {
    return wallet.participants.find((p) => p.userId === userId);
  }

  /**
   * Check if user is creator of the split wallet
   */
  static isCreator(wallet: SplitWallet, userId: string): boolean {
    return wallet.creatorId === userId;
  }

  /**
   * Check if user is a participant in the split wallet
   */
  static isParticipant(wallet: SplitWallet, userId: string): boolean {
    return wallet.participants.some((p) => p.userId === userId);
  }
}

// ---------------------------------------------------------------------------
// Export service methods for direct usage
// ---------------------------------------------------------------------------

export const {
  createSplitWallet,
  getSplitWallet,
  getSplitWalletByBillId,
  getUserSplitWallets,
  updateParticipantStatus,
  updateSplitWalletStatus,
  retrieveSplitWalletPrivateKey,
  isFullyPaid,
  calculateTotalPaid,
  getRemainingAmount,
  getParticipant,
  isCreator,
  isParticipant,
} = SplitWalletService;
