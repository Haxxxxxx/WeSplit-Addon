/**
 * Phantom Authentication Service
 *
 * Provides SSO-like authentication using Phantom wallet.
 * Users sign a message with their Phantom wallet to prove ownership,
 * then we authenticate them with Firebase using a custom token.
 *
 * This mirrors the mobile app's Phantom portal provider SSO flow.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, firestoreService } from '../config/firebase';
import type { UserProfile } from '../types';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { logger } from '../utils/logger';

// Phantom provider interface
interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey | null;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
}

// Get the Phantom provider from window
const getPhantomProvider = (): PhantomProvider | null => {
  if (typeof window === 'undefined') return null;

  // Type assertion needed for window properties that may not exist
  const win = window as typeof window & {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };

  const phantom = win.phantom?.solana;
  if (phantom?.isPhantom) return phantom;

  // Fallback: Phantom may also inject as window.solana
  const solana = win.solana;
  if (solana?.isPhantom) return solana;

  return null;
};

// Check if Phantom is installed
export const isPhantomInstalled = (): boolean => {
  return getPhantomProvider() !== null;
};

// Phantom auth result type
export interface PhantomAuthResult {
  success: boolean;
  userId?: string;
  user?: UserProfile;
  walletAddress?: string;
  error?: string;
}

// Auth message for signing
const createAuthMessage = (nonce: string, timestamp: number): string => {
  return `Sign this message to authenticate with WeSplit.\n\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nThis signature will not trigger any blockchain transaction or cost any fees.`;
};

// Generate a random nonce
const generateNonce = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export const phantomAuthService = {
  /**
   * Check if Phantom wallet is available
   */
  isAvailable(): boolean {
    return isPhantomInstalled();
  },

  /**
   * Get Phantom download URL
   */
  getDownloadUrl(): string {
    return 'https://phantom.app/';
  },

  /**
   * Connect to Phantom and authenticate
   *
   * Flow:
   * 1. Connect to Phantom wallet
   * 2. Get the public key (wallet address)
   * 3. Sign a message to prove ownership
   * 4. Send to Cloud Function to verify and get custom token
   * 5. Sign in with custom token
   * 6. Return user data
   */
  async authenticate(): Promise<PhantomAuthResult> {
    const provider = getPhantomProvider();

    if (!provider) {
      return {
        success: false,
        error: 'Phantom wallet not installed. Please install it from phantom.app',
      };
    }

    try {
      // Step 1: Connect to Phantom
      logger.log('Connecting to Phantom...');
      let publicKey;

      try {
        const response = await provider.connect();
        publicKey = response?.publicKey || provider.publicKey;
      } catch (connectError: unknown) {
        const errorMessage = connectError instanceof Error ? connectError.message : '';
        const errorCode = connectError && typeof connectError === 'object' && 'code' in connectError ? connectError.code : undefined;
        if (errorCode === 4001 || errorMessage.includes('rejected')) {
          return {
            success: false,
            error: 'Connection rejected. Please approve the connection in Phantom.',
          };
        }
        throw connectError;
      }

      if (!publicKey) {
        return {
          success: false,
          error: 'Could not get wallet address from Phantom',
        };
      }

      const walletAddress = publicKey.toString();
      logger.log('Connected to Phantom:', walletAddress);

      // Step 2: Create and sign authentication message
      const nonce = generateNonce();
      const timestamp = Date.now();
      const message = createAuthMessage(nonce, timestamp);
      const encodedMessage = new TextEncoder().encode(message);

      logger.log('Requesting signature...');
      let signature;

      try {
        const signResult = await provider.signMessage(encodedMessage, 'utf8');
        signature = signResult.signature;
      } catch (signError: unknown) {
        const errorMessage = signError instanceof Error ? signError.message : '';
        const errorCode = signError && typeof signError === 'object' && 'code' in signError ? signError.code : undefined;
        if (errorCode === 4001 || errorMessage.includes('rejected')) {
          return {
            success: false,
            error: 'Signature rejected. Please sign the message to authenticate.',
          };
        }
        throw signError;
      }

      if (!signature) {
        return {
          success: false,
          error: 'Could not get signature from Phantom',
        };
      }

      // Convert signature to base58
      const signatureBase58 = bs58.encode(signature);
      logger.log('Signature obtained');

      // Step 3: Verify signature with Cloud Function and get custom token
      if (!app) {
        return {
          success: false,
          error: 'Firebase not initialized',
        };
      }
      const functions = getFunctions(app);
      const verifyPhantomAuth = httpsCallable(functions, 'verifyPhantomAuth');

      logger.log('Verifying with server...');
      const result = await verifyPhantomAuth({
        walletAddress,
        signature: signatureBase58,
        message,
        nonce,
        timestamp,
      });

      const data = result.data as {
        success: boolean;
        customToken?: string;
        userId?: string;
        error?: string;
      };

      if (!data.success || !data.customToken) {
        return {
          success: false,
          error: data.error || 'Authentication verification failed',
        };
      }

      // Step 4: Sign in with custom token
      const { signInWithCustomToken } = await import('firebase/auth');
      const { auth } = await import('../config/firebase');

      if (!auth) {
        return {
          success: false,
          error: 'Firebase not initialized',
        };
      }

      await signInWithCustomToken(auth, data.customToken);
      logger.log('Signed in with Firebase');

      // Step 5: Get user profile from Firestore
      const user = await firestoreService.getUser(data.userId!);

      if (!user) {
        return {
          success: false,
          error: 'User profile not found',
        };
      }

      // Store auth info
      localStorage.setItem('wesplit_auth_method', 'phantom');
      localStorage.setItem('wesplit_user_id', data.userId!);
      localStorage.setItem('wesplit_wallet_address', walletAddress);

      return {
        success: true,
        userId: data.userId,
        user,
        walletAddress,
      };
    } catch (error: unknown) {
      console.error('Phantom auth error:', error);

      // Handle specific error cases
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'functions/not-found') {
          return {
            success: false,
            error: 'Authentication service not available. Please try QR code login.',
          };
        }

        if (error.code === 'functions/unauthenticated') {
          return {
            success: false,
            error: 'Wallet verification failed. Please try again.',
          };
        }
      }

      const message = error instanceof Error ? error.message : 'Authentication failed. Please try again.';
      return {
        success: false,
        error: message,
      };
    }
  },

  /**
   * Disconnect Phantom wallet
   */
  async disconnect(): Promise<void> {
    const provider = getPhantomProvider();
    if (provider && typeof provider.disconnect === 'function') {
      await provider.disconnect();
    }

    // Clear stored auth info
    localStorage.removeItem('wesplit_auth_method');
    localStorage.removeItem('wesplit_user_id');
    localStorage.removeItem('wesplit_wallet_address');
  },

  /**
   * Check if already connected to Phantom
   */
  isConnected(): boolean {
    const provider = getPhantomProvider();
    return provider?.isConnected === true && provider?.publicKey !== null;
  },

  /**
   * Get currently connected wallet address
   */
  getConnectedAddress(): string | null {
    const provider = getPhantomProvider();
    if (provider?.isConnected && provider?.publicKey) {
      return provider.publicKey.toString();
    }
    return null;
  },
};
