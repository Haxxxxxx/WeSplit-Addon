/**
 * Wallet Validation Service
 *
 * Comprehensive wallet validation for address format, curve validity, and status checks.
 * Ported from mobile's walletValidationService.ts.
 *
 * Key features:
 * - Solana address format validation (Base58, 32-44 chars)
 * - Ed25519 curve validity check (detects off-curve addresses)
 * - Wallet status determination
 * - Balance validation
 */

import { PublicKey } from '@solana/web3.js';
import type { WalletStatus, WalletType } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletValidationResult {
  isValid: boolean;
  address?: string;
  errors: string[];
  warnings: string[];
}

export interface WalletStatusResult {
  status: WalletStatus;
  type: WalletType | null;
  requiresAction: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Address Validation
// ---------------------------------------------------------------------------

/**
 * Validate a Solana wallet address format.
 * Checks Base58 encoding and length requirements.
 */
export function validateWalletAddress(address: string | undefined | null): WalletValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!address) {
    return {
      isValid: false,
      errors: ['Wallet address is required'],
      warnings: [],
    };
  }

  // Check string format
  if (typeof address !== 'string') {
    return {
      isValid: false,
      errors: ['Wallet address must be a string'],
      warnings: [],
    };
  }

  // Trim and check length
  const trimmedAddress = address.trim();
  if (trimmedAddress.length === 0) {
    return {
      isValid: false,
      errors: ['Wallet address cannot be empty'],
      warnings: [],
    };
  }

  // Solana addresses are Base58 encoded and typically 32-44 characters
  if (trimmedAddress.length < 32 || trimmedAddress.length > 44) {
    errors.push(`Invalid address length: ${trimmedAddress.length} (expected 32-44 characters)`);
  }

  // Base58 character set validation (no 0, O, I, l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(trimmedAddress)) {
    errors.push('Address contains invalid characters (must be Base58)');
  }

  // Try to parse as PublicKey
  try {
    const publicKey = new PublicKey(trimmedAddress);
    const reconstructed = publicKey.toBase58();

    // Verify reconstruction matches original
    if (reconstructed !== trimmedAddress) {
      warnings.push('Address format normalized during parsing');
    }
  } catch (error) {
    errors.push(`Invalid Solana address: ${error instanceof Error ? error.message : 'Parse failed'}`);
  }

  return {
    isValid: errors.length === 0,
    address: errors.length === 0 ? trimmedAddress : undefined,
    errors,
    warnings,
  };
}

/**
 * Check if a public key is on the ed25519 curve.
 * Off-curve keys indicate corruption or invalid derivation.
 *
 * Note: In browser, we can't easily verify curve validity without private key.
 * This function does basic structural validation.
 */
export function isOnCurve(address: string): boolean {
  try {
    const publicKey = new PublicKey(address);

    // PublicKey.isOnCurve() checks if the point is on the ed25519 curve
    // This helps detect off-curve addresses from bad derivation
    return PublicKey.isOnCurve(publicKey.toBytes());
  } catch {
    return false;
  }
}

/**
 * Comprehensive address validation including curve check.
 */
export function validateAddressComprehensive(address: string | undefined | null): WalletValidationResult {
  // First do basic validation
  const basicResult = validateWalletAddress(address);
  if (!basicResult.isValid) {
    return basicResult;
  }

  const validAddress = basicResult.address!;
  const errors = [...basicResult.errors];
  const warnings = [...basicResult.warnings];

  // Check if on curve
  if (!isOnCurve(validAddress)) {
    // Off-curve addresses are technically valid but may indicate issues
    // For most use cases, this is a warning not an error
    warnings.push('Address may be off the ed25519 curve (PDA or derived address)');
  }

  return {
    isValid: errors.length === 0,
    address: validAddress,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Wallet Status Determination
// ---------------------------------------------------------------------------

/**
 * Determine wallet status based on user data from Firestore.
 */
export function determineWalletStatus(userData: {
  wallet_address?: string | null;
  wallet_status?: WalletStatus;
  wallet_type?: WalletType;
  wallet_has_private_key?: boolean;
  wallet_has_seed_phrase?: boolean;
  wallet_fix_attempts?: number;
  phantom_wallet_address?: string | null;
  web_wallet_address?: string | null;
} | null): WalletStatusResult {
  // No user data
  if (!userData) {
    return {
      status: 'no_wallet',
      type: null,
      requiresAction: true,
      message: 'No wallet configured',
    };
  }

  // Check if wallet address exists
  const hasWalletAddress = Boolean(
    userData.wallet_address ||
    userData.phantom_wallet_address ||
    userData.web_wallet_address
  );

  if (!hasWalletAddress) {
    return {
      status: 'no_wallet',
      type: null,
      requiresAction: true,
      message: 'No wallet address found. Please connect or create a wallet.',
    };
  }

  // Use existing status if set
  if (userData.wallet_status) {
    const status = userData.wallet_status;
    const type = userData.wallet_type || null;

    switch (status) {
      case 'healthy':
        return {
          status,
          type,
          requiresAction: false,
          message: 'Wallet is healthy',
        };

      case 'needs_fix':
        return {
          status,
          type,
          requiresAction: true,
          message: 'Wallet needs attention. Please reconnect or restore.',
        };

      case 'fixing':
        return {
          status,
          type,
          requiresAction: false,
          message: 'Wallet repair in progress...',
        };

      case 'error':
        return {
          status,
          type,
          requiresAction: true,
          message: 'Wallet error. Please try reconnecting.',
        };

      case 'migrating':
        return {
          status,
          type,
          requiresAction: false,
          message: 'Wallet migration in progress...',
        };

      default:
        return {
          status: 'healthy',
          type,
          requiresAction: false,
          message: 'Wallet is configured',
        };
    }
  }

  // Infer status from wallet type
  const walletType = userData.wallet_type;

  if (walletType === 'phantom' || userData.phantom_wallet_address) {
    return {
      status: 'healthy',
      type: 'phantom',
      requiresAction: false,
      message: 'Phantom wallet connected',
    };
  }

  if (walletType === 'external') {
    return {
      status: 'healthy',
      type: 'external',
      requiresAction: false,
      message: 'External wallet connected',
    };
  }

  if (walletType === 'app-generated') {
    // For app-generated wallets, check if we have credentials
    const hasCredentials = userData.wallet_has_private_key || userData.wallet_has_seed_phrase;
    if (!hasCredentials) {
      return {
        status: 'needs_fix',
        type: 'app-generated',
        requiresAction: true,
        message: 'App wallet needs recovery. Please restore with seed phrase.',
      };
    }

    return {
      status: 'healthy',
      type: 'app-generated',
      requiresAction: false,
      message: 'App wallet ready',
    };
  }

  // Default: assume healthy if we have an address
  return {
    status: 'healthy',
    type: walletType || null,
    requiresAction: false,
    message: 'Wallet configured',
  };
}

// ---------------------------------------------------------------------------
// Wallet Type Detection
// ---------------------------------------------------------------------------

/**
 * Detect wallet type from provider name or connection method.
 */
export function detectWalletType(
  providerName: string | undefined | null,
  connectionMethod?: 'browser' | 'qr' | 'deeplink' | 'manual'
): WalletType {
  if (!providerName) {
    return connectionMethod === 'manual' ? 'app-generated' : 'external';
  }

  const lowerName = providerName.toLowerCase();

  // Phantom detection
  if (lowerName.includes('phantom')) {
    return 'phantom';
  }

  // Known browser wallets
  const browserWallets = ['solflare', 'backpack', 'glow', 'slope', 'coin98', 'trust'];
  if (browserWallets.some((w) => lowerName.includes(w))) {
    return 'external';
  }

  // MWA detection (shouldn't happen on web, but handle anyway)
  if (lowerName.includes('mwa') || lowerName.includes('mobile wallet')) {
    return 'mwa';
  }

  // Default to external for any connected wallet
  return 'external';
}

// ---------------------------------------------------------------------------
// Export Service Object
// ---------------------------------------------------------------------------

export const walletValidationService = {
  validateAddress: validateWalletAddress,
  validateComprehensive: validateAddressComprehensive,
  isOnCurve,
  determineStatus: determineWalletStatus,
  detectType: detectWalletType,
};
