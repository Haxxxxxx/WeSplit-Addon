import { User as FirebaseUser } from 'firebase/auth';
import {
  firebaseAuth,
  firestoreService,
  isFirebaseConfigured,
} from '../config/firebase';
import {
  passkeyService,
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
} from './passkey';
import type { UserProfile } from '../types';

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  authMethod: 'email' | 'google' | 'wallet' | 'passkey' | 'qr' | null;
  loading: boolean;
  error: string | null;
}

/**
 * Authentication Service
 * 
 * Provides methods for user authentication including email, Google, passkey, and QR code login.
 * All methods sync with the mobile app via Firebase.
 */
export const authService = {
  /**
   * Sign in with email and password (synced with mobile app)
   * 
   * @param email - User's email address
   * @param password - User's password
   * @returns Object containing user profile and Firebase user, or throws error
   * @throws Error if Firebase is not configured or authentication fails
   */
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ user: UserProfile | null; firebaseUser: FirebaseUser | null }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured. Please set up environment variables.');
    }

    try {
      const firebaseUser = await firebaseAuth.signIn(email, password);
      if (!firebaseUser) {
        throw new Error('Authentication failed');
      }

      // Get user profile from Firestore
      let user = await firestoreService.getUser(firebaseUser.uid);

      // If user doesn't exist in Firestore, create basic profile
      if (!user) {
        user = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || email.split('@')[0],
          email: firebaseUser.email || email,
          wallet_address: '',
          emailVerified: firebaseUser.emailVerified,
          created_at: new Date().toISOString(),
        };
        await firestoreService.saveUser(user);
      }

      // Store auth info for session persistence
      localStorage.setItem('wesplit_auth_method', 'email');
      localStorage.setItem('wesplit_user_id', firebaseUser.uid);

      return { user, firebaseUser };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign in';
      console.error('Email sign in failed:', error);
      throw new Error(message);
    }
  },

  /**
   * Sign up with email and password
   * 
   * @param email - User's email address
   * @param password - User's password (will be hashed by Firebase)
   * @param name - User's display name
   * @returns Object containing user profile and Firebase user, or throws error
   * @throws Error if Firebase is not configured or registration fails
   */
  async signUpWithEmail(
    email: string,
    password: string,
    name: string
  ): Promise<{ user: UserProfile | null; firebaseUser: FirebaseUser | null }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured. Please set up environment variables.');
    }

    try {
      const firebaseUser = await firebaseAuth.signUp(email, password);
      if (!firebaseUser) {
        throw new Error('Registration failed');
      }

      // Create user profile in Firestore
      const user: UserProfile = {
        id: firebaseUser.uid,
        name: name || email.split('@')[0],
        email: email,
        wallet_address: '',
        emailVerified: false,
        created_at: new Date().toISOString(),
        points: 0,
        total_points_earned: 0,
      };

      await firestoreService.saveUser(user);

      localStorage.setItem('wesplit_auth_method', 'email');
      localStorage.setItem('wesplit_user_id', firebaseUser.uid);

      return { user, firebaseUser };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create account';
      console.error('Email sign up failed:', error);
      throw new Error(message);
    }
  },

  /**
   * Sign in with Google OAuth
   * 
   * Opens Google sign-in popup and authenticates user.
   * Creates user profile in Firestore if user doesn't exist.
   * 
   * @returns Object containing user profile and Firebase user, or throws error
   * @throws Error if Firebase is not configured or Google sign-in fails
   */
  async signInWithGoogle(): Promise<{
    user: UserProfile | null;
    firebaseUser: FirebaseUser | null;
  }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured. Please set up environment variables.');
    }

    try {
      const firebaseUser = await firebaseAuth.signInWithGoogle();
      if (!firebaseUser) {
        throw new Error('Google sign-in failed');
      }

      // Check if user exists
      let user = await firestoreService.getUser(firebaseUser.uid);

      // Create new user profile if doesn't exist
      if (!user) {
        user = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          wallet_address: '',
          avatar: firebaseUser.photoURL || undefined,
          emailVerified: firebaseUser.emailVerified,
          created_at: new Date().toISOString(),
          points: 0,
          total_points_earned: 0,
        };
        await firestoreService.saveUser(user);
      }

      localStorage.setItem('wesplit_auth_method', 'google');
      localStorage.setItem('wesplit_user_id', firebaseUser.uid);

      return { user, firebaseUser };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign in with Google';
      console.error('Google sign in failed:', error);
      throw new Error(message);
    }
  },

  // Link wallet to authenticated user
  async linkWallet(walletAddress: string, publicKey?: string): Promise<void> {
    const userId = localStorage.getItem('wesplit_user_id');
    if (!userId) {
      throw new Error('Not authenticated');
    }

    try {
      await firestoreService.updateUserWallet(userId, walletAddress, publicKey);
    } catch (error: unknown) {
      console.error('Failed to link wallet:', error);
      throw new Error('Failed to link wallet to account');
    }
  },

  // Get user by wallet address (for finding existing account)
  async findAccountByWallet(walletAddress: string): Promise<UserProfile | null> {
    if (!isFirebaseConfigured) return null;

    try {
      return await firestoreService.getUserByWallet(walletAddress);
    } catch (error) {
      console.error('Failed to find account by wallet:', error);
      return null;
    }
  },

  // Sign out
  async signOut(): Promise<void> {
    try {
      await firebaseAuth.signOut();
      localStorage.removeItem('wesplit_auth_method');
      localStorage.removeItem('wesplit_user_id');
      localStorage.removeItem('wesplit_wallet_provider');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  },

  // Reset password
  async resetPassword(email: string): Promise<void> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      await firebaseAuth.resetPassword(email);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send reset email';
      console.error('Password reset failed:', error);
      throw new Error(message);
    }
  },

  /**
   * Check for existing authentication session
   * 
   * Checks localStorage and Firebase Auth for active session.
   * Returns user data if session is valid.
   * 
   * @returns Object containing user profile, Firebase user, and auth method, or null values if no session
   */
  async checkSession(): Promise<{
    user: UserProfile | null;
    firebaseUser: FirebaseUser | null;
    authMethod: 'email' | 'google' | 'wallet' | 'passkey' | 'qr' | 'phantom' | null;
  }> {
    const authMethod = localStorage.getItem('wesplit_auth_method') as
      | 'email'
      | 'google'
      | 'wallet'
      | 'passkey'
      | 'qr'
      | 'phantom'
      | null;
    const userId = localStorage.getItem('wesplit_user_id');

    // For wallet-only auth, just return the method
    if (authMethod === 'wallet') {
      return { user: null, firebaseUser: null, authMethod };
    }

    // For Firebase auth (email, google, passkey, qr, phantom), check if user is still logged in
    if ((authMethod === 'email' || authMethod === 'google' || authMethod === 'passkey' || authMethod === 'qr' || authMethod === 'phantom') && userId) {
      const firebaseUser = firebaseAuth.getCurrentUser();
      if (firebaseUser) {
        try {
          const user = await firestoreService.getUser(firebaseUser.uid);
          return { user, firebaseUser, authMethod };
        } catch (error) {
          console.error('Failed to get user data:', error);
        }
      }
    }

    return { user: null, firebaseUser: null, authMethod: null };
  },

  // Listen to auth state changes
  onAuthStateChanged(
    callback: (user: FirebaseUser | null) => void
  ): () => void {
    return firebaseAuth.onAuthStateChanged(callback);
  },

  // Sync local data with Firebase
  async syncUserData(userId: string): Promise<UserProfile | null> {
    if (!isFirebaseConfigured) return null;

    try {
      return await firestoreService.getUser(userId);
    } catch (error) {
      console.error('Failed to sync user data:', error);
      return null;
    }
  },

  // Check if Firebase is available
  isFirebaseAvailable(): boolean {
    return isFirebaseConfigured;
  },

  // Check if passkey authentication is supported
  async isPasskeySupported(): Promise<boolean> {
    return isWebAuthnSupported() && (await isPlatformAuthenticatorAvailable());
  },

  // Sign in with passkey
  async signInWithPasskey(
    email: string
  ): Promise<{ user: UserProfile | null; firebaseUser: FirebaseUser | null }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      // Get authentication challenge from server
      const challenge = await passkeyService.getAuthenticationChallenge(email);

      // Authenticate with passkey
      const { customToken, userId } = await passkeyService.authenticateWithPasskey(
        email,
        challenge
      );

      // Sign in to Firebase with custom token
      const firebaseUser = await firebaseAuth.signInWithToken(customToken);
      if (!firebaseUser) {
        throw new Error('Failed to complete authentication');
      }

      // Get user profile
      const user = await firestoreService.getUser(userId);

      localStorage.setItem('wesplit_auth_method', 'passkey');
      localStorage.setItem('wesplit_user_id', userId);

      return { user, firebaseUser };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Passkey authentication failed';
      console.error('Passkey sign in failed:', error);
      throw new Error(message);
    }
  },

  // Send verification code to email (passwordless login)
  async sendLoginCode(email: string): Promise<{ success: boolean }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      return await passkeyService.sendVerificationCode(email);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send verification code';
      console.error('Failed to send login code:', error);
      throw new Error(message);
    }
  },

  // Verify login code and sign in
  async verifyLoginCode(
    email: string,
    code: string
  ): Promise<{ user: UserProfile | null; firebaseUser: FirebaseUser | null }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      const { customToken, userId } = await passkeyService.verifyCode(email, code);

      // Sign in to Firebase with custom token
      const firebaseUser = await firebaseAuth.signInWithToken(customToken);
      if (!firebaseUser) {
        throw new Error('Failed to complete authentication');
      }

      // Get user profile
      const user = await firestoreService.getUser(userId);

      localStorage.setItem('wesplit_auth_method', 'email');
      localStorage.setItem('wesplit_user_id', userId);

      return { user, firebaseUser };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid verification code';
      console.error('Code verification failed:', error);
      throw new Error(message);
    }
  },
};
