/**
 * Split Wallet State Slice
 * Manages split creation flow, selected split, and UI state
 *
 * NOTE: Most split data fetching is handled via TanStack Query (hooks/useSplits.ts).
 * This slice is for:
 * - Multi-step split creation flow state
 * - Currently selected split for detail views
 * - Split-related UI state (modals, loading)
 */

import { StateCreator } from 'zustand';
import type { AppStore } from '../types';
import type { Split, SplitWallet, SplitStatus, SplitParticipant } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Participant input for creation flow (before IDs are assigned)
 */
export interface SplitParticipantInput {
  userId: string;
  name: string;
  email?: string;
  walletAddress: string;
  amountOwed: number;
}

/**
 * Item input for creation flow (before IDs are assigned)
 */
export interface SplitItemInput {
  name: string;
  price: number;
  quantity?: number;
  participants: string[]; // userIds who share this item
}

/**
 * Split creation flow draft state
 */
export interface SplitCreationDraft {
  // Step 1: Basic info
  title: string;
  description?: string;
  category?: string;
  merchant?: {
    name: string;
    address?: string;
  };

  // Step 2: Amount & method
  totalAmount: number;
  currency: string;
  splitMethod: 'equal' | 'manual';

  // Step 3: Participants
  participants: SplitParticipantInput[];

  // Step 4: Items (optional, for itemized splits)
  items: SplitItemInput[];

  // Flow state
  currentStep: number;
  isValid: boolean;
}

/**
 * Split slice state interface
 */
export interface SplitState {
  // Selected split for detail view
  selectedSplit: Split | null;
  selectedSplitWallet: SplitWallet | null;

  // Creation flow
  creationDraft: SplitCreationDraft | null;
  isCreating: boolean;

  // UI state
  isPaymentModalOpen: boolean;
  paymentAmount: number | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Split slice actions interface
 */
export interface SplitActions {
  // Selection
  setSelectedSplit: (split: Split | null) => void;
  setSelectedSplitWallet: (wallet: SplitWallet | null) => void;
  clearSelection: () => void;

  // Creation flow
  startCreation: () => void;
  updateCreationDraft: (updates: Partial<SplitCreationDraft>) => void;
  setCreationStep: (step: number) => void;
  addParticipantToDraft: (participant: SplitParticipantInput) => void;
  removeParticipantFromDraft: (userId: string) => void;
  updateParticipantInDraft: (userId: string, updates: Partial<SplitParticipantInput>) => void;
  addItemToDraft: (item: SplitItemInput) => void;
  removeItemFromDraft: (index: number) => void;
  updateItemInDraft: (index: number, updates: Partial<SplitItemInput>) => void;
  resetCreation: () => void;
  setIsCreating: (isCreating: boolean) => void;

  // Payment modal
  openPaymentModal: (amount?: number) => void;
  closePaymentModal: () => void;
  setPaymentAmount: (amount: number | null) => void;

  // Loading/Error
  setSplitLoading: (loading: boolean) => void;
  setSplitError: (error: string | null) => void;
  clearSplitError: () => void;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialCreationDraft: SplitCreationDraft = {
  title: '',
  description: undefined,
  category: undefined,
  merchant: undefined,
  totalAmount: 0,
  currency: 'USDC',
  splitMethod: 'equal',
  participants: [],
  items: [],
  currentStep: 1,
  isValid: false,
};

export const initialSplitState: SplitState = {
  selectedSplit: null,
  selectedSplitWallet: null,
  creationDraft: null,
  isCreating: false,
  isPaymentModalOpen: false,
  paymentAmount: null,
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Slice Creator
// ---------------------------------------------------------------------------

export const createSplitSlice: StateCreator<AppStore, [], [], SplitState & SplitActions> = (
  set
) => ({
  // Initial state
  ...initialSplitState,

  // ---------------------------------------------------------------------------
  // Selection Actions
  // ---------------------------------------------------------------------------

  setSelectedSplit: (split: Split | null) => {
    set((state) => ({
      split: {
        ...state.split,
        selectedSplit: split,
      },
    }));
  },

  setSelectedSplitWallet: (wallet: SplitWallet | null) => {
    set((state) => ({
      split: {
        ...state.split,
        selectedSplitWallet: wallet,
      },
    }));
  },

  clearSelection: () => {
    set((state) => ({
      split: {
        ...state.split,
        selectedSplit: null,
        selectedSplitWallet: null,
      },
    }));
  },

  // ---------------------------------------------------------------------------
  // Creation Flow Actions
  // ---------------------------------------------------------------------------

  startCreation: () => {
    set((state) => ({
      split: {
        ...state.split,
        creationDraft: { ...initialCreationDraft },
        isCreating: true,
        error: null,
      },
    }));
    if (process.env.NODE_ENV !== 'production') console.log('[SplitSlice] Started split creation flow');
  },

  updateCreationDraft: (updates: Partial<SplitCreationDraft>) => {
    set((state) => {
      if (!state.split.creationDraft) return state;

      const updatedDraft = {
        ...state.split.creationDraft,
        ...updates,
      };

      // Validate draft
      const isValid = validateDraft(updatedDraft);

      return {
        split: {
          ...state.split,
          creationDraft: {
            ...updatedDraft,
            isValid,
          },
        },
      };
    });
  },

  setCreationStep: (step: number) => {
    set((state) => {
      if (!state.split.creationDraft) return state;

      return {
        split: {
          ...state.split,
          creationDraft: {
            ...state.split.creationDraft,
            currentStep: step,
          },
        },
      };
    });
  },

  addParticipantToDraft: (participant: SplitParticipantInput) => {
    set((state) => {
      if (!state.split.creationDraft) return state;

      // Check for duplicate
      const exists = state.split.creationDraft.participants.some(
        (p) => p.userId === participant.userId
      );
      if (exists) {
        if (process.env.NODE_ENV !== 'production') console.warn('[SplitSlice] Participant already exists in draft', participant.userId);
        return state;
      }

      const updatedParticipants = [...state.split.creationDraft.participants, participant];
      const updatedDraft = {
        ...state.split.creationDraft,
        participants: updatedParticipants,
      };

      return {
        split: {
          ...state.split,
          creationDraft: {
            ...updatedDraft,
            isValid: validateDraft(updatedDraft),
          },
        },
      };
    });
  },

  removeParticipantFromDraft: (userId: string) => {
    set((state) => {
      if (!state.split.creationDraft) return state;

      const updatedParticipants = state.split.creationDraft.participants.filter(
        (p) => p.userId !== userId
      );
      const updatedDraft = {
        ...state.split.creationDraft,
        participants: updatedParticipants,
      };

      return {
        split: {
          ...state.split,
          creationDraft: {
            ...updatedDraft,
            isValid: validateDraft(updatedDraft),
          },
        },
      };
    });
  },

  updateParticipantInDraft: (userId: string, updates: Partial<SplitParticipantInput>) => {
    set((state) => {
      if (!state.split.creationDraft) return state;

      const updatedParticipants = state.split.creationDraft.participants.map((p) =>
        p.userId === userId ? { ...p, ...updates } : p
      );
      const updatedDraft = {
        ...state.split.creationDraft,
        participants: updatedParticipants,
      };

      return {
        split: {
          ...state.split,
          creationDraft: {
            ...updatedDraft,
            isValid: validateDraft(updatedDraft),
          },
        },
      };
    });
  },

  addItemToDraft: (item: SplitItemInput) => {
    set((state) => {
      if (!state.split.creationDraft) return state;

      const updatedItems = [...state.split.creationDraft.items, item];
      const updatedDraft = {
        ...state.split.creationDraft,
        items: updatedItems,
      };

      return {
        split: {
          ...state.split,
          creationDraft: {
            ...updatedDraft,
            isValid: validateDraft(updatedDraft),
          },
        },
      };
    });
  },

  removeItemFromDraft: (index: number) => {
    set((state) => {
      if (!state.split.creationDraft) return state;

      const updatedItems = state.split.creationDraft.items.filter((_, i) => i !== index);
      const updatedDraft = {
        ...state.split.creationDraft,
        items: updatedItems,
      };

      return {
        split: {
          ...state.split,
          creationDraft: {
            ...updatedDraft,
            isValid: validateDraft(updatedDraft),
          },
        },
      };
    });
  },

  updateItemInDraft: (index: number, updates: Partial<SplitItemInput>) => {
    set((state) => {
      if (!state.split.creationDraft) return state;

      const updatedItems = state.split.creationDraft.items.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      );
      const updatedDraft = {
        ...state.split.creationDraft,
        items: updatedItems,
      };

      return {
        split: {
          ...state.split,
          creationDraft: {
            ...updatedDraft,
            isValid: validateDraft(updatedDraft),
          },
        },
      };
    });
  },

  resetCreation: () => {
    set((state) => ({
      split: {
        ...state.split,
        creationDraft: null,
        isCreating: false,
        error: null,
      },
    }));
    if (process.env.NODE_ENV !== 'production') console.log('[SplitSlice] Reset split creation flow');
  },

  setIsCreating: (isCreating: boolean) => {
    set((state) => ({
      split: {
        ...state.split,
        isCreating,
      },
    }));
  },

  // ---------------------------------------------------------------------------
  // Payment Modal Actions
  // ---------------------------------------------------------------------------

  openPaymentModal: (amount?: number) => {
    set((state) => ({
      split: {
        ...state.split,
        isPaymentModalOpen: true,
        paymentAmount: amount ?? null,
      },
    }));
  },

  closePaymentModal: () => {
    set((state) => ({
      split: {
        ...state.split,
        isPaymentModalOpen: false,
        paymentAmount: null,
      },
    }));
  },

  setPaymentAmount: (amount: number | null) => {
    set((state) => ({
      split: {
        ...state.split,
        paymentAmount: amount,
      },
    }));
  },

  // ---------------------------------------------------------------------------
  // Loading/Error Actions
  // ---------------------------------------------------------------------------

  setSplitLoading: (loading: boolean) => {
    set((state) => ({
      split: {
        ...state.split,
        isLoading: loading,
      },
    }));
  },

  setSplitError: (error: string | null) => {
    set((state) => ({
      split: {
        ...state.split,
        error,
      },
    }));
  },

  clearSplitError: () => {
    set((state) => ({
      split: {
        ...state.split,
        error: null,
      },
    }));
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate a creation draft
 */
function validateDraft(draft: SplitCreationDraft): boolean {
  // Must have title
  if (!draft.title || draft.title.trim().length === 0) {
    return false;
  }

  // Must have positive amount
  if (draft.totalAmount <= 0) {
    return false;
  }

  // Must have at least one participant
  if (draft.participants.length === 0) {
    return false;
  }

  // All participants must have wallet addresses
  const allHaveWallets = draft.participants.every(
    (p) => p.walletAddress && p.walletAddress.length > 0
  );
  if (!allHaveWallets) {
    return false;
  }

  // For equal splits, amounts should be auto-calculated
  // For manual splits, total must match
  if (draft.splitMethod === 'manual') {
    const totalOwed = draft.participants.reduce((sum, p) => sum + (p.amountOwed || 0), 0);
    const tolerance = 0.01; // 0.01 USDC tolerance
    if (Math.abs(totalOwed - draft.totalAmount) > tolerance) {
      return false;
    }
  }

  return true;
}
