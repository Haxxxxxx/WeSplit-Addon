/**
 * QR Code Authentication Service
 *
 * This service handles QR code-based authentication for the WeSplit browser extension.
 * Users scan a QR code with their mobile app to authenticate on the extension.
 *
 * Flow:
 * 1. Extension generates a unique session token
 * 2. Token is displayed as a QR code
 * 3. User scans QR code with WeSplit mobile app
 * 4. Mobile app sends approval to Firebase (updates session status)
 * 5. Extension listens for approval and completes authentication
 */

import { db, isFirebaseConfigured, firebaseAuth } from '../config/firebase';
import { doc, setDoc, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore';

// Session status types
export type QRSessionStatus = 'pending' | 'scanned' | 'approved' | 'rejected' | 'expired';

// QR session data stored in Firestore
export interface QRSession {
  id: string;
  status: QRSessionStatus;
  createdAt: Date;
  expiresAt: Date;
  scannedAt?: Date;
  approvedAt?: Date;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  deviceInfo?: string;
  customToken?: string;
}

// Generate a random session ID
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Session expiry time (5 minutes)
const SESSION_EXPIRY_MS = 5 * 60 * 1000;

export const qrAuthService = {
  /**
   * Create a new QR session
   * Returns the session ID to be encoded in the QR code
   */
  async createSession(): Promise<{ sessionId: string; expiresAt: Date }> {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Firebase not configured');
    }

    const sessionId = generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_MS);

    // Get device/browser info for the mobile app to show
    const deviceInfo = `${navigator.userAgent.includes('Chrome') ? 'Chrome' :
      navigator.userAgent.includes('Firefox') ? 'Firefox' :
      navigator.userAgent.includes('Safari') ? 'Safari' : 'Browser'} Extension`;

    // Create session document in Firestore
    const sessionRef = doc(db, 'qr_sessions', sessionId);
    await setDoc(sessionRef, {
      id: sessionId,
      status: 'pending',
      createdAt: serverTimestamp(),
      expiresAt: expiresAt,
      deviceInfo,
    });

    return { sessionId, expiresAt };
  },

  /**
   * Listen for session status changes
   * Returns an unsubscribe function
   */
  listenToSession(
    sessionId: string,
    onStatusChange: (session: QRSession | null) => void
  ): () => void {
    if (!isFirebaseConfigured || !db) {
      console.error('Firebase not configured');
      return () => {};
    }

    const sessionRef = doc(db, 'qr_sessions', sessionId);

    return onSnapshot(
      sessionRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const session: QRSession = {
            id: data.id,
            status: data.status,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            expiresAt: data.expiresAt?.toDate?.() || new Date(),
            scannedAt: data.scannedAt?.toDate?.(),
            approvedAt: data.approvedAt?.toDate?.(),
            userId: data.userId,
            userEmail: data.userEmail,
            userName: data.userName,
            userAvatar: data.userAvatar,
            deviceInfo: data.deviceInfo,
            customToken: data.customToken,
          };

          // Check if session is expired
          if (session.expiresAt < new Date() && session.status === 'pending') {
            session.status = 'expired';
          }

          onStatusChange(session);
        } else {
          onStatusChange(null);
        }
      },
      (error) => {
        console.error('Error listening to QR session:', error);
        onStatusChange(null);
      }
    );
  },

  /**
   * Complete authentication with the custom token from the approved session
   */
  async completeAuthentication(customToken: string): Promise<{
    userId: string;
    email: string | null;
  }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    const firebaseUser = await firebaseAuth.signInWithToken(customToken);
    if (!firebaseUser) {
      throw new Error('Failed to authenticate');
    }

    return {
      userId: firebaseUser.uid,
      email: firebaseUser.email,
    };
  },

  /**
   * Delete/cleanup a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      return;
    }

    try {
      const sessionRef = doc(db, 'qr_sessions', sessionId);
      await deleteDoc(sessionRef);
    } catch (error) {
      console.error('Error deleting QR session:', error);
    }
  },

  /**
   * Generate the QR code data URL
   * The mobile app will scan this and extract the session ID
   */
  getQRCodeData(sessionId: string): string {
    // Format: wesplit://auth?session={sessionId}
    // The mobile app should recognize this deep link format
    return `wesplit://auth?session=${sessionId}`;
  },
};

export default qrAuthService;
