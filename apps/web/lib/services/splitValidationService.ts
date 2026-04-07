/**
 * Split Validation Service
 * Centralized validation logic for split wallet operations (Spend splits only)
 * Ported from mobile: src/services/split/SplitValidationService.ts
 */

import { PublicKey } from '@solana/web3.js';
import { PARTICIPANT_STATUS, type SplitWalletParticipant, type ParticipantStatus } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VALIDATION_TOLERANCE = {
  AMOUNT: 0.01, // 0.01 USDC tolerance for rounding
  BALANCE: 0.001, // 0.001 USDC tolerance for balance checks
};

export const ERROR_MESSAGES = {
  WALLET_NOT_FOUND: 'Split wallet not found',
  PARTICIPANT_NOT_FOUND: 'Participant not found in split wallet',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  INVALID_AMOUNT: 'Invalid payment amount',
  ALREADY_PAID: 'Participant has already paid their full share',
  ALREADY_LOCKED: 'Participant has already locked their funds',
  WALLET_EXISTS: 'A split wallet already exists for this bill',
  INVALID_STATUS: 'Invalid status transition',
  VALIDATION_FAILED: 'Validation failed',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CreationParams {
  billId: string;
  creatorId: string;
  totalAmount: number;
  currency?: string;
  participants: Array<{
    userId: string;
    name: string;
    walletAddress: string;
    amountOwed: number;
  }>;
}

export interface ParticipantInput {
  userId: string;
  id?: string;
  name: string;
  walletAddress: string;
  wallet_address?: string;
  amountOwed: number;
  amountPaid?: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// Status Mapper
// ---------------------------------------------------------------------------

/**
 * Valid status transitions for participants
 */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [PARTICIPANT_STATUS.PENDING]: [
    PARTICIPANT_STATUS.LOCKED,
    PARTICIPANT_STATUS.PAID,
    PARTICIPANT_STATUS.FAILED,
  ],
  [PARTICIPANT_STATUS.LOCKED]: [PARTICIPANT_STATUS.PAID],
  [PARTICIPANT_STATUS.PAID]: [], // Paid is terminal
  [PARTICIPANT_STATUS.FAILED]: [PARTICIPANT_STATUS.PENDING], // Can retry from failed
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string,
  _splitType: 'spend' = 'spend' // Only spend splits supported
): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

// ---------------------------------------------------------------------------
// Participant Validation
// ---------------------------------------------------------------------------

/**
 * Validate a single participant's data
 */
export function validateParticipant(participant: ParticipantInput): ValidationResult {
  const errors: string[] = [];

  if (!participant.userId && !participant.id) {
    errors.push('Participant userId is required');
  }

  if (!participant.name || participant.name.trim() === '') {
    errors.push('Participant name is required');
  }

  if (!participant.walletAddress && !participant.wallet_address) {
    errors.push('Participant walletAddress is required');
  }

  if (typeof participant.amountOwed !== 'number' || participant.amountOwed < 0) {
    errors.push('Participant amountOwed must be a non-negative number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate multiple participants
 */
export function validateParticipants(participants: ParticipantInput[]): ValidationResult {
  const errors: string[] = [];

  if (!participants || participants.length === 0) {
    errors.push('At least one participant is required');
    return { isValid: false, errors };
  }

  participants.forEach((p, index) => {
    const validation = validateParticipant(p);
    if (!validation.isValid) {
      validation.errors.forEach((error) => {
        errors.push(`Participant ${index + 1}: ${error}`);
      });
    }
  });

  // Check for duplicate userIds
  const userIds = new Set<string>();
  participants.forEach((p, index) => {
    const userId = p.userId || p.id;
    if (userId) {
      if (userIds.has(userId)) {
        errors.push(`Participant ${index + 1}: Duplicate userId ${userId}`);
      }
      userIds.add(userId);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Creation Validation
// ---------------------------------------------------------------------------

/**
 * Validate split creation parameters
 */
export async function validateCreationParams(params: CreationParams): Promise<ValidationResult> {
  const errors: string[] = [];

  // Validate billId
  if (!params.billId || typeof params.billId !== 'string' || params.billId.trim() === '') {
    errors.push('Bill ID is required and must be a non-empty string');
  }

  // Validate creatorId
  if (!params.creatorId || typeof params.creatorId !== 'string' || params.creatorId.trim() === '') {
    errors.push('Creator ID is required and must be a non-empty string');
  }

  // Validate totalAmount
  if (typeof params.totalAmount !== 'number' || params.totalAmount <= 0) {
    errors.push('Total amount is required and must be a positive number');
  }

  // Validate currency
  if (params.currency && typeof params.currency !== 'string') {
    errors.push('Currency must be a string');
  }

  // Validate participants
  if (!params.participants || !Array.isArray(params.participants)) {
    errors.push('Participants parameter is required and must be an array');
  } else if (params.participants.length === 0) {
    errors.push('At least one participant is required');
  } else {
    // Convert to ParticipantInput format for validation
    const participantsForValidation: ParticipantInput[] = params.participants.map((p) => ({
      userId: p.userId || '',
      id: p.userId || '',
      name: p.name || 'Unknown',
      walletAddress: p.walletAddress || '',
      wallet_address: p.walletAddress || '',
      amountOwed: p.amountOwed || 0,
    }));

    const participantValidation = validateParticipants(participantsForValidation);
    if (!participantValidation.isValid) {
      errors.push(...participantValidation.errors);
    }

    // Validate total amounts match
    const totalAmountOwed = params.participants.reduce((sum, p) => sum + (p.amountOwed || 0), 0);
    const difference = Math.abs(totalAmountOwed - params.totalAmount);
    if (difference > VALIDATION_TOLERANCE.AMOUNT) {
      errors.push(
        `Total amountOwed (${totalAmountOwed}) does not match totalAmount (${params.totalAmount}). Difference: ${difference}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Wallet Address Validation
// ---------------------------------------------------------------------------

/**
 * Validate wallet address format (Solana public key)
 */
export function validateWalletAddress(address: string): ValidationResult {
  const errors: string[] = [];

  if (!address || typeof address !== 'string') {
    errors.push('Wallet address is required and must be a string');
    return { isValid: false, errors };
  }

  // Remove common invalid values
  const invalidValues = ['no wallet address', 'unknown wallet', '', 'null', 'undefined'];
  if (invalidValues.includes(address.toLowerCase())) {
    errors.push('Invalid wallet address value');
    return { isValid: false, errors };
  }

  // Check if it's a valid Solana public key format
  try {
    new PublicKey(address);
  } catch {
    errors.push(`Invalid Solana wallet address format: ${address}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Amount Validation
// ---------------------------------------------------------------------------

/**
 * Validate participant amounts
 */
export function validateAmounts(
  amountPaid: number,
  amountOwed: number,
  allowOverpayment: boolean = false
): ValidationResult {
  const errors: string[] = [];

  if (typeof amountPaid !== 'number' || amountPaid < 0) {
    errors.push('Amount paid must be a non-negative number');
  }

  if (typeof amountOwed !== 'number' || amountOwed < 0) {
    errors.push('Amount owed must be a non-negative number');
  }

  if (!allowOverpayment && amountPaid > amountOwed + VALIDATION_TOLERANCE.AMOUNT) {
    errors.push(`Amount paid (${amountPaid}) exceeds amount owed (${amountOwed})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Status Transition Validation
// ---------------------------------------------------------------------------

/**
 * Validate status transition
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string,
  splitType: 'spend' = 'spend'
): ValidationResult {
  const errors: string[] = [];

  if (!isValidStatusTransition(currentStatus, newStatus, splitType)) {
    errors.push(
      `Invalid status transition from '${currentStatus}' to '${newStatus}' for ${splitType} split`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Payment Validation
// ---------------------------------------------------------------------------

/**
 * Validate participant payment
 */
export function validateParticipantPayment(
  participant: SplitWalletParticipant,
  paymentAmount: number
): ValidationResult {
  const errors: string[] = [];

  // Check if already fully paid
  if (
    participant.status === PARTICIPANT_STATUS.PAID ||
    participant.amountPaid >= participant.amountOwed
  ) {
    errors.push(ERROR_MESSAGES.ALREADY_PAID);
  }

  // Check if already locked (for degen splits - kept for compatibility)
  if (participant.status === PARTICIPANT_STATUS.LOCKED) {
    errors.push(ERROR_MESSAGES.ALREADY_LOCKED);
  }

  // Validate payment amount
  if (paymentAmount <= 0) {
    errors.push(ERROR_MESSAGES.INVALID_AMOUNT);
  }

  // Validate amounts
  const amountValidation = validateAmounts(
    (participant.amountPaid || 0) + paymentAmount,
    participant.amountOwed,
    false
  );
  if (!amountValidation.isValid) {
    errors.push(...amountValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Access Validation
// ---------------------------------------------------------------------------

/**
 * Validate participant exists in wallet
 */
export function validateParticipantInWallet(
  wallet: { participants: SplitWalletParticipant[] },
  participantId: string
): ValidationResult {
  const errors: string[] = [];

  const participant = wallet.participants.find((p) => p.userId === participantId);
  if (!participant) {
    errors.push(ERROR_MESSAGES.PARTICIPANT_NOT_FOUND);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate user has access to wallet (as creator or participant)
 */
export function validateUserAccess(
  wallet: { creatorId: string; participants: SplitWalletParticipant[] },
  userId: string
): ValidationResult {
  const errors: string[] = [];

  const isCreator = wallet.creatorId === userId;
  const isParticipant = wallet.participants.some((p) => p.userId === userId);

  if (!isCreator && !isParticipant) {
    errors.push('User is not authorized to access this split wallet');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
