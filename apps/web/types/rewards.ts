/**
 * Points, rewards, leaderboard, quests, and badge types.
 */

// ---------------------------------------------------------------------------
// Points / Rewards
// ---------------------------------------------------------------------------

export type PointsSource =
  | 'transaction_reward'
  | 'quest_completion'
  | 'season_reward'
  | 'referral_reward'
  | 'admin_adjustment';

export interface PointsTransaction {
  id: string;
  user_id: string;
  amount: number;
  source: PointsSource;
  source_id?: string;
  task_type?: string;
  description?: string;
  season?: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  id: string;
  name: string;
  email?: string;
  wallet_address?: string;
  avatar_url?: string;
  points: number;
  rank: number;
  active_badge?: string;
  badges?: string[];
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export type QuestType =
  | 'export_seed_phrase'
  | 'setup_account_pp'
  | 'first_shared_wallet_with_friends'
  | 'first_external_wallet_linked'
  | 'invite_friends_create_account'
  | 'friend_do_first_shared_wallet_over_10'
  | 'follow_x'
  | 'join_telegram';

export interface Quest {
  id: string;
  type: QuestType;
  completed: boolean;
  points?: number;
  completed_at?: string;
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon_url?: string;
  category: string;
  metric: string;
  target: number;
}

export interface UserBadgeProgress {
  badge: BadgeDefinition;
  current: number;
  claimed: boolean;
  claimed_at?: string;
}
