/**
 * Firebase Configuration and Services
 *
 * This module initializes Firebase and provides service wrappers
 * for authentication, Firestore, and Cloud Functions.
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { UserProfile, Transaction } from '../types';

// ============================================
// Firebase Configuration
// ============================================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'wesplit-35186.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'wesplit-35186',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'wesplit-35186.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is configured
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);

// ============================================
// Firebase Initialization
// ============================================

let app: FirebaseApp | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let functions: ReturnType<typeof getFunctions> | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
}

export { app, auth, db, functions };

// ============================================
// Firebase Auth Service
// ============================================

export const firebaseAuth = {
  async signIn(email: string, password: string): Promise<FirebaseUser | null> {
    if (!auth) throw new Error('Firebase not initialized');
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  },

  async signUp(email: string, password: string): Promise<FirebaseUser | null> {
    if (!auth) throw new Error('Firebase not initialized');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  },

  async signInWithGoogle(): Promise<FirebaseUser | null> {
    if (!auth) throw new Error('Firebase not initialized');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  },

  async signInWithToken(token: string): Promise<FirebaseUser | null> {
    if (!auth) throw new Error('Firebase not initialized');
    const result = await signInWithCustomToken(auth, token);
    return result.user;
  },

  async signOut(): Promise<void> {
    if (!auth) return;
    await signOut(auth);
  },

  async resetPassword(email: string): Promise<void> {
    if (!auth) throw new Error('Firebase not initialized');
    await sendPasswordResetEmail(auth, email);
  },

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser(): FirebaseUser | null {
    return auth?.currentUser || null;
  },
};

// ============================================
// Firestore Service
// ============================================

export const firestoreService = {
  async getUser(uid: string): Promise<UserProfile | null> {
    if (!db) throw new Error('Firebase not initialized');
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  },

  async getUserByWallet(walletAddress: string): Promise<UserProfile | null> {
    if (!db) throw new Error('Firebase not initialized');
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('wallet_address', '==', walletAddress));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data() as UserProfile;
    }
    return null;
  },

  async saveUser(user: Partial<UserProfile> & { id: string }): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, {
      ...user,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  },

  async updateUserWallet(uid: string, walletAddress: string, publicKey?: string): Promise<void> {
    if (!db) throw new Error('Firebase not initialized');
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      wallet_address: walletAddress,
      wallet_public_key: publicKey || '',
      updated_at: new Date().toISOString(),
    });
  },

  async getUserTransactions(walletAddress: string, limit = 20): Promise<Transaction[]> {
    if (!db) throw new Error('Firebase not initialized');
    const txRef = collection(db, 'transactions');

    const sentQuery = query(txRef, where('from_wallet', '==', walletAddress));
    const receivedQuery = query(txRef, where('to_wallet', '==', walletAddress));

    const [sentSnap, receivedSnap] = await Promise.all([
      getDocs(sentQuery),
      getDocs(receivedQuery),
    ]);

    const transactions: Transaction[] = [];

    sentSnap.forEach((docSnap) => {
      transactions.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
    });

    receivedSnap.forEach((docSnap) => {
      if (!transactions.find((t) => t.id === docSnap.id)) {
        transactions.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
      }
    });

    transactions.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return transactions.slice(0, limit);
  },

  async saveTransaction(tx: Omit<Transaction, 'id'>): Promise<string> {
    if (!db) throw new Error('Firebase not initialized');
    const txRef = collection(db, 'transactions');
    const docRef = doc(txRef);
    await setDoc(docRef, {
      ...tx,
      created_at: tx.created_at || new Date().toISOString(),
    });
    return docRef.id;
  },

  onUserChange(uid: string, callback: (user: UserProfile | null) => void): () => void {
    if (!db) return () => {};
    const userRef = doc(db, 'users', uid);
    return onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as UserProfile);
      } else {
        callback(null);
      }
    });
  },

  async getUserPoints(uid: string): Promise<{ points: number; totalEarned: number }> {
    if (!db) throw new Error('Firebase not initialized');
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        points: data.points || 0,
        totalEarned: data.total_points_earned || 0,
      };
    }
    return { points: 0, totalEarned: 0 };
  },
};

// ============================================
// Cloud Functions Service
// ============================================

export const cloudFunctions = {
  async call<T = unknown>(name: string, data?: unknown): Promise<T> {
    if (!functions) throw new Error('Firebase not initialized');
    const fn = httpsCallable(functions, name);
    const result = await fn(data);
    return result.data as T;
  },

  async sendVerificationEmail(email: string): Promise<{ success: boolean }> {
    return this.call('sendVerificationEmail', { email });
  },

  async verifyCode(email: string, code: string): Promise<{ success: boolean; token?: string }> {
    return this.call('verifyCode', { email, code });
  },
};

export default app;
