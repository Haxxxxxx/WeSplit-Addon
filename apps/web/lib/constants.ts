/**
 * WeSplit shared constants
 *
 * Use these instead of hardcoding values throughout the codebase.
 * If the backend changes a value, update it here and all callers update automatically.
 */

// ---------------------------------------------------------------------------
// Rewards & Points
// ---------------------------------------------------------------------------

/** Points awarded to referrer when a new user signs up via referral link */
export const REFERRAL_BONUS_POINTS = 500;

/** Points per $1 USDC sent */
export const USDC_POINTS_PER_DOLLAR = 1;

/** Points per SOL sent */
export const SOL_POINTS_PER_SOL = 10;

// ---------------------------------------------------------------------------
// Splits
// ---------------------------------------------------------------------------

/** Minimum number of participants required for a split */
export const SPLIT_MIN_PARTICIPANTS = 2;

/** Maximum number of participants allowed in a split */
export const SPLIT_MAX_PARTICIPANTS = 20;

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/** Minimum SOL required in wallet to cover transaction fees */
export const MIN_SOL_FOR_FEES = 0.001;

/** USDC mint address (mainnet) */
export const USDC_MINT_ADDRESS = process.env.NEXT_PUBLIC_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
