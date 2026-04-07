import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { SharedWallet, SharedWalletMember } from '../types';
import { logger } from '../utils/logger';

// Raw Firestore document structure
interface SharedWalletDoc {
  id?: string;
  name: string;
  description?: string;
  creatorId: string;
  creatorName: string;
  walletAddress: string;
  totalBalance: number;
  currency: string;
  status: 'active' | 'paused' | 'archived';
  members: SharedWalletMember[];
  createdAt: { toDate?: () => Date } | string;
  updatedAt: { toDate?: () => Date } | string;
  customColor?: string;
  customLogo?: string;
}

// Convert Firestore timestamp to ISO string
function toISOString(timestamp: { toDate?: () => Date } | string | undefined): string {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === 'string') return timestamp;
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString();
}

// Convert Firestore document to SharedWallet
function docToSharedWallet(docId: string, data: SharedWalletDoc): SharedWallet {
  return {
    id: docId,
    name: data.name || 'Unnamed Wallet',
    description: data.description,
    creatorId: data.creatorId || '',
    creatorName: data.creatorName || 'Unknown',
    walletAddress: data.walletAddress || '',
    totalBalance: data.totalBalance || 0,
    currency: data.currency || 'USDC',
    status: data.status || 'active',
    members: data.members || [],
    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt),
    customColor: data.customColor,
    customLogo: data.customLogo,
  };
}

export const sharedWalletService = {
  /**
   * Get all shared wallets for a user
   * Queries wallets where user is creator OR a member
   * Uses same approach as mobile app for consistency
   */
  async getUserSharedWallets(userId: string): Promise<SharedWallet[]> {
    if (!db) {
      logger.warn('Firestore not initialized');
      return [];
    }

    logger.log('[SharedWallets] Fetching wallets for user:', userId);

    try {
      const walletsRef = collection(db, 'sharedWallets');
      const wallets: SharedWallet[] = [];
      const seenIds = new Set<string>();

      // Query 1: Wallets where user is creator (no status filter - match mobile app)
      try {
        const creatorQuery = query(
          walletsRef,
          where('creatorId', '==', userId)
        );

        const creatorSnap = await getDocs(creatorQuery);
        logger.log('[SharedWallets] Found', creatorSnap.size, 'wallets as creator');

        creatorSnap.forEach((doc) => {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            const wallet = docToSharedWallet(doc.id, doc.data() as SharedWalletDoc);
            wallets.push(wallet);
            logger.log('[SharedWallets] Added creator wallet:', wallet.name, wallet.id);
          }
        });
      } catch (creatorError) {
        console.error('[SharedWallets] Creator query failed:', creatorError);
      }

      // Query 2: Get recent wallets and filter by membership client-side
      // (Firestore doesn't support array-contains on nested fields like members.userId)
      try {
        const recentQuery = query(
          walletsRef,
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        const recentSnap = await getDocs(recentQuery);
        logger.log('[SharedWallets] Checking', recentSnap.size, 'recent wallets for membership');

        recentSnap.forEach((doc) => {
          if (seenIds.has(doc.id)) return;

          const data = doc.data() as SharedWalletDoc;
          const isMember = data.members?.some(
            (member) => member.userId === userId
          );

          if (isMember) {
            seenIds.add(doc.id);
            const wallet = docToSharedWallet(doc.id, data);
            wallets.push(wallet);
            logger.log('[SharedWallets] Added member wallet:', wallet.name, wallet.id);
          }
        });
      } catch (recentError: unknown) {
        // If index is missing, try without orderBy
        const errorMessage = recentError instanceof Error ? recentError.message : '';
        if (errorMessage.includes('index')) {
          logger.warn('[SharedWallets] Index missing, trying fallback query');
          const fallbackQuery = query(
            walletsRef,
            limit(100)
          );

          const fallbackSnap = await getDocs(fallbackQuery);
          fallbackSnap.forEach((doc) => {
            if (seenIds.has(doc.id)) return;

            const data = doc.data() as SharedWalletDoc;
            const isMember = data.members?.some(
              (member) => member.userId === userId
            );

            if (isMember) {
              seenIds.add(doc.id);
              wallets.push(docToSharedWallet(doc.id, data));
            }
          });
        } else {
          console.error('[SharedWallets] Recent query failed:', recentError);
        }
      }

      // Sort by createdAt descending (newest first)
      wallets.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      logger.log('[SharedWallets] Total wallets found:', wallets.length);
      return wallets;
    } catch (error) {
      console.error('[SharedWallets] Failed to fetch shared wallets:', error);
      return [];
    }
  },

  /**
   * Get a single shared wallet by ID
   */
  async getSharedWallet(walletId: string): Promise<SharedWallet | null> {
    if (!db) {
      logger.warn('Firestore not initialized');
      return null;
    }

    try {
      const { doc: docRef, getDoc } = await import('firebase/firestore');
      const walletDoc = await getDoc(docRef(db, 'sharedWallets', walletId));

      if (!walletDoc.exists()) {
        return null;
      }

      return docToSharedWallet(walletDoc.id, walletDoc.data() as SharedWalletDoc);
    } catch (error) {
      console.error('Failed to fetch shared wallet:', error);
      return null;
    }
  },
};
