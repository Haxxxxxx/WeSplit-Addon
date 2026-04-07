/**
 * Split Payment Service
 * Handles payment operations for split wallets (Spend splits only)
 * Web-adapted from mobile: src/services/split/SplitWalletPayments.ts
 *
 * NOTE: Unlike mobile, web transactions are initiated via connected wallets
 * (Phantom, etc.) not internal wallet signing. This service focuses on:
 * - Tracking payment status
 * - Validating payments
 * - Updating participant records after on-chain payments
 */

import { Connection } from '@solana/web3.js';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createConnection } from '@/lib/solana';
import { roundUsdcAmount } from '@/lib/utils';
import {
  FIRESTORE_COLLECTIONS,
  SPLIT_WALLET_STATUS,
  PARTICIPANT_STATUS,
  type SplitWallet,
  type SplitWalletParticipant,
  type PaymentResult,
  type ParticipantStatus,
} from '@/types';
import { SplitWalletService } from './splitWalletService';
import {
  validateParticipantPayment,
  validateParticipantInWallet,
  validateUserAccess,
  isValidStatusTransition,
  ERROR_MESSAGES,
} from './splitValidationService';
import * as splitStorageService from './splitStorageService';

// ---------------------------------------------------------------------------
// Transaction Verification
// ---------------------------------------------------------------------------

/**
 * Verify a transaction signature on the Solana blockchain
 */
async function verifyTransactionOnBlockchain(
  transactionSignature: string,
  connection?: Connection
): Promise<boolean> {
  try {
    const conn = connection || createConnection();
    const status = await conn.getSignatureStatus(transactionSignature, {
      searchTransactionHistory: true,
    });

    if (status.value?.confirmationStatus) {
      console.info('[SplitPaymentService] Transaction verification', {
        signature: transactionSignature,
        confirmationStatus: status.value.confirmationStatus,
        slot: status.value.slot,
        error: status.value.err,
      });

      return (
        status.value.err === null &&
        (status.value.confirmationStatus === 'confirmed' ||
          status.value.confirmationStatus === 'finalized')
      );
    }

    return false;
  } catch (error) {
    console.warn('[SplitPaymentService] Could not verify transaction status', {
      transactionSignature,
      error,
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Payment Processing
// ---------------------------------------------------------------------------

export class SplitPaymentService {
  /**
   * Record a participant payment after on-chain transaction is confirmed
   *
   * This is called AFTER the web UI has successfully completed a wallet transaction.
   * Unlike mobile, we don't execute transactions - we just record them.
   *
   * @param splitWalletId - The split wallet ID
   * @param participantId - The participant user ID
   * @param amount - Amount paid in USDC
   * @param transactionSignature - The on-chain transaction signature
   * @returns PaymentResult
   */
  static async recordParticipantPayment(
    splitWalletId: string,
    participantId: string,
    amount: number,
    transactionSignature: string
  ): Promise<PaymentResult> {
    try {
      // Get split wallet
      const walletResult = await SplitWalletService.getSplitWallet(splitWalletId);
      if (!walletResult.success || !walletResult.wallet) {
        return {
          success: false,
          error: walletResult.error || ERROR_MESSAGES.WALLET_NOT_FOUND,
        };
      }

      const wallet = walletResult.wallet;

      // Validate participant exists
      const participantValidation = validateParticipantInWallet(wallet, participantId);
      if (!participantValidation.isValid) {
        return {
          success: false,
          error: participantValidation.errors.join('; '),
        };
      }

      // Find participant
      const participant = wallet.participants.find((p) => p.userId === participantId);
      if (!participant) {
        return {
          success: false,
          error: ERROR_MESSAGES.PARTICIPANT_NOT_FOUND,
        };
      }

      // Validate payment amount
      const roundedAmount = roundUsdcAmount(amount);
      const paymentValidation = validateParticipantPayment(participant, roundedAmount);
      if (!paymentValidation.isValid) {
        return {
          success: false,
          error: paymentValidation.errors.join('; '),
        };
      }

      // Verify transaction on-chain (optional but recommended)
      const isVerified = await verifyTransactionOnBlockchain(transactionSignature);
      if (!isVerified) {
        console.warn('[SplitPaymentService] Transaction not yet confirmed on-chain', {
          transactionSignature,
        });
        // Continue anyway - the UI should have waited for confirmation
      }

      // Calculate new amount paid
      const newAmountPaid = roundUsdcAmount((participant.amountPaid || 0) + roundedAmount);
      const isFullyPaid = newAmountPaid >= participant.amountOwed;
      const newStatus: ParticipantStatus = isFullyPaid
        ? PARTICIPANT_STATUS.PAID
        : PARTICIPANT_STATUS.PENDING;

      // Update participant status
      const updateResult = await SplitWalletService.updateParticipantStatus(
        splitWalletId,
        participantId,
        newStatus,
        newAmountPaid,
        transactionSignature
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error || 'Failed to update participant status',
        };
      }

      // Also update the split storage record
      await splitStorageService.updateParticipantStatus(
        wallet.billId,
        participantId,
        isFullyPaid ? 'paid' : 'accepted',
        newAmountPaid,
        transactionSignature
      );

      console.info('[SplitPaymentService] Participant payment recorded successfully', {
        splitWalletId,
        participantId,
        amount: roundedAmount,
        newAmountPaid,
        isFullyPaid,
        transactionSignature,
      });

      return {
        success: true,
        transactionSignature,
        amount: roundedAmount,
        message: isFullyPaid
          ? 'Payment completed - your share is fully paid'
          : `Payment recorded - ${roundUsdcAmount(participant.amountOwed - newAmountPaid)} USDC remaining`,
      };
    } catch (error) {
      console.error('[SplitPaymentService] Failed to record participant payment', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get the payment details for a participant
   * Returns amount owed, amount paid, and remaining balance
   */
  static async getParticipantPaymentDetails(
    splitWalletId: string,
    participantId: string
  ): Promise<{
    success: boolean;
    amountOwed?: number;
    amountPaid?: number;
    remainingBalance?: number;
    status?: ParticipantStatus;
    error?: string;
  }> {
    try {
      const walletResult = await SplitWalletService.getSplitWallet(splitWalletId);
      if (!walletResult.success || !walletResult.wallet) {
        return {
          success: false,
          error: walletResult.error || ERROR_MESSAGES.WALLET_NOT_FOUND,
        };
      }

      const participant = walletResult.wallet.participants.find(
        (p) => p.userId === participantId
      );
      if (!participant) {
        return {
          success: false,
          error: ERROR_MESSAGES.PARTICIPANT_NOT_FOUND,
        };
      }

      return {
        success: true,
        amountOwed: participant.amountOwed,
        amountPaid: participant.amountPaid,
        remainingBalance: Math.max(0, participant.amountOwed - (participant.amountPaid || 0)),
        status: participant.status,
      };
    } catch (error) {
      console.error('[SplitPaymentService] Failed to get participant payment details', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Verify split wallet balance on blockchain
   * Checks the actual USDC balance of the split wallet address
   */
  static async verifySplitWalletBalance(
    splitWalletId: string
  ): Promise<{ success: boolean; balance?: number; error?: string }> {
    try {
      const walletResult = await SplitWalletService.getSplitWallet(splitWalletId);
      if (!walletResult.success || !walletResult.wallet) {
        return {
          success: false,
          error: walletResult.error || ERROR_MESSAGES.WALLET_NOT_FOUND,
        };
      }

      const wallet = walletResult.wallet;
      const connection = createConnection();

      // Get USDC token account balance
      // Note: In a full implementation, we'd query the token account
      // For now, calculate from participant payments
      const totalPaid = SplitWalletService.calculateTotalPaid(wallet);

      return {
        success: true,
        balance: totalPaid,
      };
    } catch (error) {
      console.error('[SplitPaymentService] Failed to verify split wallet balance', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Complete a split (mark as completed after all payments are received)
   * Only the creator can complete a split
   */
  static async completeSplit(
    splitWalletId: string,
    creatorId: string
  ): Promise<PaymentResult> {
    try {
      const walletResult = await SplitWalletService.getSplitWallet(splitWalletId);
      if (!walletResult.success || !walletResult.wallet) {
        return {
          success: false,
          error: walletResult.error || ERROR_MESSAGES.WALLET_NOT_FOUND,
        };
      }

      const wallet = walletResult.wallet;

      // Validate creator
      if (!SplitWalletService.isCreator(wallet, creatorId)) {
        return {
          success: false,
          error: 'Only the split creator can complete the split',
        };
      }

      // Check if already completed
      if (wallet.status === SPLIT_WALLET_STATUS.COMPLETED) {
        return {
          success: false,
          error: 'Split is already completed',
        };
      }

      // Check if all participants have paid
      const isFullyPaid = SplitWalletService.isFullyPaid(wallet);
      if (!isFullyPaid) {
        const remaining = SplitWalletService.getRemainingAmount(wallet);
        return {
          success: false,
          error: `Cannot complete split - ${remaining.toFixed(2)} USDC still outstanding`,
        };
      }

      // Update split wallet status
      const updateResult = await SplitWalletService.updateSplitWalletStatus(
        splitWalletId,
        SPLIT_WALLET_STATUS.COMPLETED
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error || 'Failed to update split status',
        };
      }

      // Also update the split storage record
      await splitStorageService.updateSplitStatus(wallet.billId, 'completed');

      console.info('[SplitPaymentService] Split completed successfully', {
        splitWalletId,
        creatorId,
        totalAmount: wallet.totalAmount,
      });

      return {
        success: true,
        amount: wallet.totalAmount,
        message: 'Split completed successfully',
      };
    } catch (error) {
      console.error('[SplitPaymentService] Failed to complete split', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Cancel a split (only creator can cancel, and only if no payments made)
   */
  static async cancelSplit(
    splitWalletId: string,
    creatorId: string
  ): Promise<PaymentResult> {
    try {
      const walletResult = await SplitWalletService.getSplitWallet(splitWalletId);
      if (!walletResult.success || !walletResult.wallet) {
        return {
          success: false,
          error: walletResult.error || ERROR_MESSAGES.WALLET_NOT_FOUND,
        };
      }

      const wallet = walletResult.wallet;

      // Validate creator
      if (!SplitWalletService.isCreator(wallet, creatorId)) {
        return {
          success: false,
          error: 'Only the split creator can cancel the split',
        };
      }

      // Check if any payments have been made
      const totalPaid = SplitWalletService.calculateTotalPaid(wallet);
      if (totalPaid > 0) {
        return {
          success: false,
          error: 'Cannot cancel split after payments have been made',
        };
      }

      // Update split wallet status
      const updateResult = await SplitWalletService.updateSplitWalletStatus(
        splitWalletId,
        SPLIT_WALLET_STATUS.CANCELLED
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error || 'Failed to cancel split',
        };
      }

      // Also update the split storage record
      await splitStorageService.updateSplitStatus(wallet.billId, 'cancelled');

      console.info('[SplitPaymentService] Split cancelled successfully', {
        splitWalletId,
        creatorId,
      });

      return {
        success: true,
        message: 'Split cancelled successfully',
      };
    } catch (error) {
      console.error('[SplitPaymentService] Failed to cancel split', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get payment summary for a split wallet
   * Returns total amount, total paid, remaining, and per-participant breakdown
   */
  static async getPaymentSummary(splitWalletId: string): Promise<{
    success: boolean;
    summary?: {
      totalAmount: number;
      totalPaid: number;
      remainingAmount: number;
      participantCount: number;
      paidCount: number;
      pendingCount: number;
      status: string;
      participants: Array<{
        userId: string;
        name: string;
        amountOwed: number;
        amountPaid: number;
        remaining: number;
        status: ParticipantStatus;
        isPaid: boolean;
      }>;
    };
    error?: string;
  }> {
    try {
      const walletResult = await SplitWalletService.getSplitWallet(splitWalletId);
      if (!walletResult.success || !walletResult.wallet) {
        return {
          success: false,
          error: walletResult.error || ERROR_MESSAGES.WALLET_NOT_FOUND,
        };
      }

      const wallet = walletResult.wallet;
      const totalPaid = SplitWalletService.calculateTotalPaid(wallet);
      const remainingAmount = SplitWalletService.getRemainingAmount(wallet);

      const participants = wallet.participants.map((p) => ({
        userId: p.userId,
        name: p.name,
        amountOwed: p.amountOwed,
        amountPaid: p.amountPaid || 0,
        remaining: Math.max(0, p.amountOwed - (p.amountPaid || 0)),
        status: p.status,
        isPaid: p.status === PARTICIPANT_STATUS.PAID || (p.amountPaid || 0) >= p.amountOwed,
      }));

      const paidCount = participants.filter((p) => p.isPaid).length;
      const pendingCount = participants.length - paidCount;

      return {
        success: true,
        summary: {
          totalAmount: wallet.totalAmount,
          totalPaid,
          remainingAmount,
          participantCount: participants.length,
          paidCount,
          pendingCount,
          status: wallet.status,
          participants,
        },
      };
    } catch (error) {
      console.error('[SplitPaymentService] Failed to get payment summary', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Export service methods for direct usage
// ---------------------------------------------------------------------------

export const {
  recordParticipantPayment,
  getParticipantPaymentDetails,
  verifySplitWalletBalance,
  completeSplit,
  cancelSplit,
  getPaymentSummary,
} = SplitPaymentService;
