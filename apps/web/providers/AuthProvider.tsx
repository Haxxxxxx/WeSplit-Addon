'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCustomToken,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useWallet } from '@solana/wallet-adapter-react';
import { auth, db } from '@/lib/firebase';
import { useAppStore } from '@/store';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** Firebase Auth user object (null when signed out) */
  user: FirebaseUser | null;
  /** True while the initial auth state is being resolved */
  loading: boolean;
  /** True while wallet auth is in progress */
  walletLoading: boolean;
  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<void>;
  /** Create account with email + password + display name */
  signUp: (email: string, password: string, name: string) => Promise<void>;
  /** Sign in via Google popup */
  signInWithGoogle: () => Promise<void>;
  /** Sign in via Solana wallet (SIWS). Returns 'no_match' if no existing account found. */
  signInWithWallet: (opts?: { createNew?: boolean }) => Promise<'ok' | 'no_match'>;
  /** Send OTP to phone number. Returns true if sent successfully. */
  sendPhoneOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<boolean>;
  /** Confirm phone OTP code */
  confirmPhoneOtp: (code: string) => Promise<void>;
  /** Send passwordless email sign-in link */
  sendEmailLink: (email: string) => Promise<void>;
  /** Complete email link sign-in (call on redirect back) */
  completeEmailLink: (email: string, url: string) => Promise<void>;
  /** Sign out and clear local state */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Session cookie helpers (client-side only)
//
// Stores the Firebase ID token in the `wesplit-session` cookie so middleware
// can validate it without a server round-trip. Tokens expire after 1 hour —
// onIdTokenChanged fires on every refresh, keeping the cookie current.
// ---------------------------------------------------------------------------

/** 55 minutes — gives a 5-minute buffer before the 1-hour Firebase token expiry. */
const SESSION_COOKIE_TTL = 3300;

function setSessionCookie(idToken: string): void {
  if (typeof document === 'undefined') return;
  // S1-2: Secure flag prevents cookie transmission over HTTP
  document.cookie = `wesplit-session=${idToken}; path=/; SameSite=Lax; Secure; max-age=${SESSION_COOKIE_TTL}`;
}

function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = 'wesplit-session=; path=/; max-age=0';
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [phoneConfirmation, setPhoneConfirmation] = useState<ConfirmationResult | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  // Solana wallet adapter
  const { publicKey, signMessage, connected } = useWallet();

  // Zustand actions — pull once so we don't subscribe to render changes
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const authenticateUser = useAppStore((s) => s.authenticateUser);
  const logoutUser = useAppStore((s) => s.logoutUser);

  // -------------------------------------------------------------------
  // Sync Firestore user doc into Zustand
  // -------------------------------------------------------------------

  const syncUserToStore = useCallback(
    async (
      firebaseUser: FirebaseUser,
      method: 'email' | 'social' | 'wallet',
      walletAddress?: string,
    ) => {
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const userData = { id: snap.id, ...snap.data() } as User;

          if (method === 'wallet' && walletAddress) {
            const isSameWallet = userData.wallet_address === walletAddress;
            const hasNoWallet = !userData.wallet_address;

            if (hasNoWallet) {
              // User has no wallet at all — set as primary
              // S3-2: write both snake_case and camelCase for mobile compat
              await updateDoc(userRef, {
                wallet_address: walletAddress,
                wallet_public_key: walletAddress,
                wallet_type: 'external',
                wallet_provider: 'browser_wallet',
                wallet_status: 'healthy',
                walletAddress: walletAddress,
                walletPublicKey: walletAddress,
                walletType: 'external',
                walletProvider: 'browser_wallet',
                walletStatus: 'healthy',
              });
              userData.wallet_address = walletAddress;
              userData.wallet_type = 'external';
              userData.wallet_status = 'healthy';
            } else if (!isSameWallet) {
              // User has a DIFFERENT primary wallet (e.g. app-generated on mobile,
              // or Phantom SDK embedded wallet). Don't overwrite — store as
              // web_wallet_address so web transactions work without breaking
              // mobile identity.
              await updateDoc(userRef, {
                web_wallet_address: walletAddress,
                webWalletAddress: walletAddress,
              });
              userData.web_wallet_address = walletAddress;
            }
            // If same wallet, nothing to update
          }

          authenticateUser(userData, method);
        } else {
          // First time sign-in — create the user doc
          const isWallet = method === 'wallet';
          const authMethodValue = method === 'wallet' ? 'wallet' : method === 'social' ? 'google' : 'email';
          const newUser = {
            id: firebaseUser.uid,
            // snake_case (web convention)
            name: firebaseUser.displayName ?? (isWallet ? '' : ''),
            // S3-1: name_lowercase for mobile case-insensitive search
            name_lowercase: (firebaseUser.displayName ?? '').trim().toLowerCase(),
            nameLowercase: (firebaseUser.displayName ?? '').trim().toLowerCase(),
            email: firebaseUser.email ?? '',
            wallet_address: walletAddress ?? '',
            wallet_public_key: walletAddress ?? '',
            wallet_type: isWallet ? ('external' as const) : undefined,
            wallet_provider: isWallet ? 'browser_wallet' : undefined,
            wallet_status: isWallet ? ('healthy' as const) : undefined,
            web_wallet_address: isWallet ? (walletAddress ?? '') : '',
            avatar: firebaseUser.photoURL ?? '',
            has_completed_onboarding: false,
            status: 'active' as const,
            device_platform: 'web',
            auth_method: authMethodValue,
            // camelCase (mobile convention)
            walletAddress: walletAddress ?? '',
            walletPublicKey: walletAddress ?? '',
            walletType: isWallet ? ('external' as const) : undefined,
            walletProvider: isWallet ? 'browser_wallet' : undefined,
            walletStatus: isWallet ? ('healthy' as const) : undefined,
            webWalletAddress: isWallet ? (walletAddress ?? '') : '',
            hasCompletedOnboarding: false,
            devicePlatform: 'web',
            authMethod: authMethodValue,
            points: 0,
            total_points_earned: 0,
            totalPointsEarned: 0,
          };

          await setDoc(userRef, {
            ...newUser,
            created_at: serverTimestamp(),
            createdAt: serverTimestamp(),
          });

          authenticateUser(newUser as unknown as User, method);
        }
      } catch (err) {
        console.error('[AuthProvider] Failed to sync user to store:', err);
      }
    },
    [authenticateUser],
  );

  // -------------------------------------------------------------------
  // Auth state listener
  // -------------------------------------------------------------------

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, AND every token auto-refresh
    // (approximately every hour). This keeps the session cookie current.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Persist the fresh ID token in the session cookie so middleware can
        // validate it without a JWKS round-trip on every navigation.
        try {
          const idToken = await firebaseUser.getIdToken();
          setSessionCookie(idToken);
        } catch {
          // Token fetch failed — leave the existing cookie intact
        }

        // Determine auth method from provider data
        // Custom token users (wallet, telegram) have empty providerData
        const isGoogle = firebaseUser.providerData.some(
          (p) => p.providerId === 'google.com',
        );
        const isCustomToken = firebaseUser.providerData.length === 0;

        if (isCustomToken) {
          // Custom token users: no provider data. Wallet auth uses the wallet's
          // public key as the UID (32-44 chars, base58). Telegram UIDs start with
          // 'tg_'. Email custom tokens also have no email + no providers but their
          // UIDs are standard Firebase UIDs (~28 chars, much shorter).
          const looksLikeWallet =
            !firebaseUser.email &&
            firebaseUser.uid.length > 32 &&
            !firebaseUser.uid.startsWith('tg_');
          await syncUserToStore(
            firebaseUser,
            looksLikeWallet ? 'wallet' : 'social',
            looksLikeWallet ? firebaseUser.uid : undefined,
          );
        } else {
          await syncUserToStore(firebaseUser, isGoogle ? 'social' : 'email');
        }
      } else {
        clearSessionCookie();
        setCurrentUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [syncUserToStore, setCurrentUser]);

  // -------------------------------------------------------------------
  // Auth actions
  // -------------------------------------------------------------------

  const signIn = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Set cookie immediately so middleware sees it before the page navigates
    try {
      const idToken = await cred.user.getIdToken();
      setSessionCookie(idToken);
    } catch { /* onIdTokenChanged will retry */ }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      // Set cookie immediately so middleware sees it before the page navigates
      try {
        const idToken = await cred.user.getIdToken();
        setSessionCookie(idToken);
      } catch { /* onIdTokenChanged will retry */ }
    },
    [],
  );

  const signInWithGoogleFn = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    // Set cookie immediately so middleware sees it before the page navigates
    try {
      const idToken = await cred.user.getIdToken();
      setSessionCookie(idToken);
    } catch { /* onIdTokenChanged will retry */ }
  }, []);

  const signInWithWalletFn = useCallback(async (opts?: { createNew?: boolean }): Promise<'ok' | 'no_match'> => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected or does not support signMessage');
    }

    setWalletLoading(true);
    try {
      // 1. Fetch nonce from API
      const nonceRes = await fetch('/api/auth/nonce');
      if (!nonceRes.ok) throw new Error('Failed to fetch nonce');
      const { nonce } = await nonceRes.json();

      // 2. Build SIWS message
      const domain = window.location.host;
      const message = [
        `WeSplit wants you to sign in with your Solana account:`,
        publicKey.toBase58(),
        ``,
        `Sign in to WeSplit`,
        ``,
        `Domain: ${domain}`,
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
      ].join('\n');

      // 3. Sign message
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);

      // 4. Encode signature as base58
      const bs58Module = await import('bs58');
      const signatureBase58 = bs58Module.default.encode(signatureBytes);

      // 5. Verify on server + get Firebase token
      const verifyRes = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedMessage: message,
          signature: signatureBase58,
          publicKey: publicKey.toBase58(),
          nonce,
          domain,
          createNew: opts?.createNew ?? false,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.message || 'Wallet verification failed');
      }

      const data = await verifyRes.json();

      // 6. Handle no-match — let the caller decide what to do
      if (data.noMatch && !data.firebaseToken) {
        return 'no_match';
      }

      // 7. Sign into Firebase with custom token
      const cred = await signInWithCustomToken(auth, data.firebaseToken);

      // 8. Set session cookie with real ID token (not a flag)
      try {
        const idToken = await cred.user.getIdToken();
        setSessionCookie(idToken);
      } catch { /* onIdTokenChanged will retry */ }

      return 'ok';
    } finally {
      setWalletLoading(false);
    }
  }, [publicKey, signMessage]);

  const sendPhoneOtp = useCallback(async (phoneNumber: string, recaptchaContainerId: string): Promise<boolean> => {
    // Clean up previous verifier if any
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
    }

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
    });
    setRecaptchaVerifier(verifier);

    const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    setPhoneConfirmation(confirmation);
    return true;
  }, [recaptchaVerifier]);

  const confirmPhoneOtp = useCallback(async (code: string) => {
    if (!phoneConfirmation) {
      throw new Error('No pending phone verification. Call sendPhoneOtp first.');
    }

    const cred = await phoneConfirmation.confirm(code);
    setPhoneConfirmation(null);

    // Set cookie immediately
    try {
      const idToken = await cred.user.getIdToken();
      setSessionCookie(idToken);
    } catch { /* onIdTokenChanged will retry */ }
  }, [phoneConfirmation]);

  const sendEmailLinkFn = useCallback(async (email: string) => {
    const redirectUrl = `${window.location.origin}/login?finishEmailLink=1&email=${encodeURIComponent(email)}`;

    // Try server-side branded email first
    const res = await fetch('/api/auth/email-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.sent) {
        // Branded email sent via Resend
        window.localStorage.setItem('wesplit-email-for-signin', email);
        return;
      }
    }

    // Fallback: use Firebase's built-in email (works without Resend)
    await sendSignInLinkToEmail(auth, email, {
      url: redirectUrl,
      handleCodeInApp: true,
    });
    window.localStorage.setItem('wesplit-email-for-signin', email);
  }, []);

  const completeEmailLinkFn = useCallback(async (email: string, url: string) => {
    if (!isSignInWithEmailLink(auth, url)) {
      throw new Error('Invalid sign-in link.');
    }
    const cred = await signInWithEmailLink(auth, email, url);
    window.localStorage.removeItem('wesplit-email-for-signin');
    try {
      const idToken = await cred.user.getIdToken();
      setSessionCookie(idToken);
    } catch { /* onIdTokenChanged will retry */ }
  }, []);

  const signOutFn = useCallback(async () => {
    await firebaseSignOut(auth);
    logoutUser();
  }, [logoutUser]);

  // -------------------------------------------------------------------
  // Memoized context value
  // -------------------------------------------------------------------

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      walletLoading,
      signIn,
      signUp,
      signInWithGoogle: signInWithGoogleFn,
      signInWithWallet: signInWithWalletFn,
      sendPhoneOtp,
      confirmPhoneOtp,
      sendEmailLink: sendEmailLinkFn,
      completeEmailLink: completeEmailLinkFn,
      signOut: signOutFn,
    }),
    [user, loading, walletLoading, signIn, signUp, signInWithGoogleFn, signInWithWalletFn, sendPhoneOtp, confirmPhoneOtp, sendEmailLinkFn, completeEmailLinkFn, signOutFn],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
