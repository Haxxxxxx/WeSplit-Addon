import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../config/firebase';
import type { PaymentRequest, User, Currency } from '../types';
import { logger } from '../utils/logger';

const db = app ? getFirestore(app) : null;
const functions = app ? getFunctions(app) : null;

// Re-export types for backwards compatibility
export type { PaymentRequest };

// Local type for search results (subset of User)
type SearchUser = Pick<User, 'id' | 'name' | 'email' | 'wallet_address' | 'avatar'>;

/**
 * Payment Request Service
 * 
 * Handles creation, retrieval, and management of payment requests.
 * Integrates with Firebase Firestore for persistence.
 */
class PaymentRequestService {
  /**
   * Search for WeSplit users by email or name
   * 
   * Searches Firestore for users matching the query. Searches by email (exact match)
   * or by name (prefix match). Excludes the current user from results.
   * 
   * @param searchQuery - Search term (email or name prefix)
   * @param currentUserId - ID of current user to exclude from results
   * @returns Array of matching users (subset of User type)
   */
  async searchUsers(searchQuery: string, currentUserId: string): Promise<SearchUser[]> {
    if (!db) {
      console.error('[PaymentRequestService] Firestore not initialized');
      return [];
    }

    try {
      const usersRef = collection(db, 'users');
      const users: SearchUser[] = [];

      // Search by email (exact match)
      if (searchQuery.includes('@')) {
        const emailQuery = query(usersRef, where('email', '==', searchQuery.toLowerCase()));
        const emailSnapshot = await getDocs(emailQuery);
        emailSnapshot.forEach((doc) => {
          if (doc.id !== currentUserId) {
            const data = doc.data();
            users.push({
              id: doc.id,
              name: data.name || data.displayName || 'Unknown',
              email: data.email,
              wallet_address: data.wallet_address || data.walletAddress,
              avatar: data.avatar || data.photoURL,
            });
          }
        });
      }

      // Search by name (prefix match) - requires composite index
      if (users.length === 0 && searchQuery.length >= 2) {
        const nameQuery = query(
          usersRef,
          where('name', '>=', searchQuery),
          where('name', '<=', searchQuery + '\uf8ff')
        );
        try {
          const nameSnapshot = await getDocs(nameQuery);
          nameSnapshot.forEach((doc) => {
            if (doc.id !== currentUserId) {
              const data = doc.data();
              users.push({
                id: doc.id,
                name: data.name || data.displayName || 'Unknown',
                email: data.email,
                wallet_address: data.wallet_address || data.walletAddress,
                avatar: data.avatar || data.photoURL,
              });
            }
          });
        } catch (err) {
          logger.log('[PaymentRequestService] Name search requires index, skipping');
        }
      }

      return users;
    } catch (error) {
      console.error('[PaymentRequestService] Error searching users:', error);
      return [];
    }
  }

  /**
   * Create a new payment request
   * 
   * Creates a payment request in Firestore and sends a push notification to the recipient.
   * 
   * @param fromUser - User creating the request
   * @param toUser - User receiving the request
   * @param amount - Amount to request
   * @param currency - Currency (USDC or SOL)
   * @param message - Optional message to include with the request
   * @returns Object with success status and requestId, or error message
   */
  async createRequest(
    fromUser: { id: string; name: string; walletAddress: string },
    toUser: { id: string; name: string; walletAddress: string },
    amount: number,
    currency: Currency,
    message?: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    if (!db) {
      return { success: false, error: 'Firestore not initialized' };
    }

    try {
      const requestsRef = collection(db, 'paymentRequests');
      const docRef = await addDoc(requestsRef, {
        fromUserId: fromUser.id,
        fromUserName: fromUser.name,
        fromWalletAddress: fromUser.walletAddress,
        toUserId: toUser.id,
        toUserName: toUser.name,
        toWalletAddress: toUser.walletAddress,
        amount,
        currency,
        message: message || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Send push notification to the recipient
      await this.sendPushNotification(toUser.id, {
        title: 'Payment Request',
        body: `${fromUser.name} requested ${amount} ${currency}`,
        data: {
          type: 'payment_request',
          requestId: docRef.id,
          fromUserId: fromUser.id,
          amount: amount.toString(),
          currency,
        },
      });

      return { success: true, requestId: docRef.id };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create request';
      console.error('[PaymentRequestService] Error creating request:', error);
      return { success: false, error: message };
    }
  }

  // Send push notification via Cloud Function
  async sendPushNotification(
    userId: string,
    notification: { title: string; body: string; data?: Record<string, string> }
  ): Promise<boolean> {
    if (!functions) {
      console.error('[PaymentRequestService] Functions not initialized');
      return false;
    }

    try {
      const sendNotification = httpsCallable(functions, 'sendPushNotification');
      await sendNotification({
        userId,
        notification,
      });
      logger.log('[PaymentRequestService] Push notification sent to user:', userId);
      return true;
    } catch (error) {
      console.error('[PaymentRequestService] Error sending push notification:', error);
      // Don't fail the request if notification fails
      return false;
    }
  }

  // Get pending requests for a user
  async getPendingRequests(userId: string): Promise<PaymentRequest[]> {
    if (!db) {
      return [];
    }

    try {
      const requestsRef = collection(db, 'paymentRequests');

      // Requests TO this user (they need to pay)
      const toMeQuery = query(
        requestsRef,
        where('toUserId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(toMeQuery);
      const requests: PaymentRequest[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName,
          fromWalletAddress: data.fromWalletAddress,
          toUserId: data.toUserId,
          toUserName: data.toUserName,
          toWalletAddress: data.toWalletAddress,
          amount: data.amount,
          currency: data.currency,
          message: data.message,
          status: data.status,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          paidAt: data.paidAt instanceof Timestamp ? data.paidAt.toDate() : undefined,
          txHash: data.txHash,
        });
      });

      return requests;
    } catch (error) {
      console.error('[PaymentRequestService] Error getting pending requests:', error);
      return [];
    }
  }

  /**
   * Get sent payment requests for a user
   * 
   * Retrieves all payment requests created by the specified user.
   * 
   * @param userId - ID of the user who sent the requests
   * @returns Array of payment requests, ordered by creation date (newest first)
   */
  async getSentRequests(userId: string): Promise<PaymentRequest[]> {
    if (!db) {
      return [];
    }

    try {
      const requestsRef = collection(db, 'paymentRequests');

      const fromMeQuery = query(
        requestsRef,
        where('fromUserId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(fromMeQuery);
      const requests: PaymentRequest[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          id: doc.id,
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName,
          fromWalletAddress: data.fromWalletAddress,
          toUserId: data.toUserId,
          toUserName: data.toUserName,
          toWalletAddress: data.toWalletAddress,
          amount: data.amount,
          currency: data.currency,
          message: data.message,
          status: data.status,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          paidAt: data.paidAt instanceof Timestamp ? data.paidAt.toDate() : undefined,
          txHash: data.txHash,
        });
      });

      return requests;
    } catch (error) {
      console.error('[PaymentRequestService] Error getting sent requests:', error);
      return [];
    }
  }
}

export const paymentRequestService = new PaymentRequestService();
