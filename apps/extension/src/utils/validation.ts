/**
 * Input Validation Utilities
 * 
 * Centralized validation logic for user inputs.
 */

/**
 * Validates a Solana address format
 */
export const validateSolanaAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }
  // Solana addresses are base58 encoded, typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
};

/**
 * Validates an amount (positive number with optional decimals)
 */
export const validateAmount = (
  amount: string | number,
  maxDecimals: number = 9
): { valid: boolean; error?: string } => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  if (numAmount <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  if (numAmount === Infinity) {
    return { valid: false, error: 'Amount is too large' };
  }

  // Check decimal places
  const decimalPlaces = (numAmount.toString().split('.')[1] || '').length;
  if (decimalPlaces > maxDecimals) {
    return {
      valid: false,
      error: `Amount can have at most ${maxDecimals} decimal places`,
    };
  }

  return { valid: true };
};

/**
 * Validates an email address format
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a wallet address (same as Solana address for now)
 */
export const validateWalletAddress = (address: string): boolean => {
  return validateSolanaAddress(address);
};

/**
 * Validates that an amount doesn't exceed a balance
 */
export const validateAmountNotExceedingBalance = (
  amount: number,
  balance: number
): { valid: boolean; error?: string } => {
  if (amount > balance) {
    return {
      valid: false,
      error: 'Amount exceeds available balance',
    };
  }
  return { valid: true };
};
