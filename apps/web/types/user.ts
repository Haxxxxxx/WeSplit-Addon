/**
 * User-related types.
 */

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  wallet_address: string;
  wallet_public_key?: string;
  created_at: string;
  avatar?: string;
  hasCompletedOnboarding?: boolean;
  status?: 'active' | 'deleted' | 'suspended';

  // Wallet management
  wallet_status?: 'healthy' | 'needs_fix' | 'no_wallet' | 'fixing' | 'error';
  wallet_created_at?: string;
  wallet_last_fixed_at?: string;
  wallet_fix_attempts?: number;
  wallet_has_private_key?: boolean;
  wallet_has_seed_phrase?: boolean;
  wallet_type?: 'app-generated' | 'external' | 'migrated' | 'mwa' | 'phantom';
  wallet_provider?: string;
  wallet_display_name?: string;
  wallet_migration_status?: 'none' | 'in_progress' | 'completed' | 'failed';
  phantom_wallet_address?: string;
  web_wallet_address?: string;
  telegram_wallet_address?: string;

  // Identity tracking
  firebase_uid?: string;
  primary_email?: string;
  email_verified?: boolean;
  migration_completed?: string;
  migration_version?: string;

  // Phone auth
  phone?: string;
  phoneVerified?: boolean;
  primary_phone?: string;

  // Rewards
  points?: number;
  total_points_earned?: number;
  points_last_updated?: string;
  is_partnership?: boolean;
  referral_code?: string;
  referred_by?: string;
  referral_count?: number;
  referral_code_last_used_at?: string;

  // Balance (cached from on-chain, updated by mobile app)
  usdc_balance?: number;
  sol_balance?: number;

  // Alternate avatar URL (Firestore legacy alias for avatar)
  avatar_url?: string;

  // Auth method tracking (mobile parity)
  auth_method?: string;
  authMethod?: string;

  // camelCase aliases written by mobile, read cross-platform
  createdAt?: string;
  walletAddress?: string;
  walletPublicKey?: string;
  totalPointsEarned?: number;
  has_completed_onboarding?: boolean;
  device_platform?: string;

  // Profile customization
  badges?: string[];
  active_badge?: string;
  profile_assets?: string[];
  active_profile_asset?: string;
  profile_borders?: string[];
  active_profile_border?: string;
  wallet_backgrounds?: string[];
  active_wallet_background?: string;
  show_badges_on_profile?: boolean;

  // Telegram-specific
  telegram_id?: number;
  telegram_username?: string;
  telegram_photo_url?: string;

  // Push notifications
  pushToken?: string;
  pushTokenUpdatedAt?: string;
  devicePlatform?: string;

  // Withdraw
  mainWithdrawWalletAddress?: string;

  // Matrica integration
  matrica_username?: string | null;
  matrica_profile_picture?: string | null;
  matrica_wallets?: string[] | null;
  matrica_linked_at?: string | null;
}

// ---------------------------------------------------------------------------
// User Contact
// ---------------------------------------------------------------------------

export interface UserContact extends User {
  first_met_at: string;
  last_interaction_at?: string;
  isFavorite?: boolean;
}
