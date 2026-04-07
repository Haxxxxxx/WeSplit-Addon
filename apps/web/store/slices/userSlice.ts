/**
 * User State Slice
 * Manages user authentication and profile state
 * Web adaptation — uses Firestore SDK directly instead of mobile data service
 */

import { StateCreator } from 'zustand';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import type { User } from '@/types';
import type { UserState, UserActions, AppStore } from '../types';
import { db } from '@/lib/firebase';

export const createUserSlice: StateCreator<
  AppStore,
  [],
  [],
  UserState & UserActions
> = (set, get) => ({
  // Initial state
  currentUser: null,
  isAuthenticated: false,
  authMethod: null,
  isLoading: false,
  error: null,

  // Actions
  setCurrentUser: (user: User | null) => {
    set((state) => ({
      user: {
        ...state.user,
        currentUser: user,
        isAuthenticated: !!user,
        error: null,
      },
    }));
  },

  authenticateUser: (user: User, method: 'wallet' | 'email' | 'phone' | 'guest' | 'social' | 'telegram') => {
    set((state) => ({
      user: {
        ...state.user,
        currentUser: user,
        isAuthenticated: true,
        authMethod: method,
        error: null,
        isLoading: false,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[UserSlice] User authenticated', { userId: user.id, method });
  },

  logoutUser: () => {
    set(() => ({
      user: {
        currentUser: null,
        isAuthenticated: false,
        authMethod: null,
        isLoading: false,
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[UserSlice] User logged out');
  },

  updateUser: async (updates: Partial<User>) => {
    const currentUser = get().user.currentUser;
    if (!currentUser) {
      set((state) => ({
        user: {
          ...state.user,
          error: 'No user to update',
        },
      }));
      return;
    }

    set((state) => ({
      user: {
        ...state.user,
        isLoading: true,
        error: null,
      },
    }));

    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, updates);

      // Re-fetch to get the server-merged doc
      const snap = await getDoc(userRef);
      const updatedUser = snap.exists()
        ? ({ id: snap.id, ...snap.data() } as User)
        : { ...currentUser, ...updates };

      set((state) => ({
        user: {
          ...state.user,
          currentUser: updatedUser,
          isLoading: false,
          error: null,
        },
      }));

      if (process.env.NODE_ENV !== 'production') console.log('[UserSlice] User updated successfully', { userId: currentUser.id, updates: Object.keys(updates) });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user';

      set((state) => ({
        user: {
          ...state.user,
          isLoading: false,
          error: errorMessage,
        },
      }));

      console.error('[UserSlice] Failed to update user', {
        userId: currentUser.id,
        error: errorMessage,
      });
    }
  },

  setUserLoading: (loading: boolean) => {
    set((state) => ({
      user: {
        ...state.user,
        isLoading: loading,
      },
    }));
  },

  setUserError: (error: string | null) => {
    set((state) => ({
      user: {
        ...state.user,
        error,
      },
    }));
  },

  clearUserError: () => {
    set((state) => ({
      user: {
        ...state.user,
        error: null,
      },
    }));
  },
});
