/**
 * Points, rewards, leaderboard, quests, badges, and referral queries.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  arrayUnion,
  getCountFromServer,
  writeBatch,
  increment,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  PointsTransaction,
  LeaderboardEntry,
  Quest,
  BadgeDefinition,
  UserBadgeProgress,
} from '@/types';

// ---------------------------------------------------------------------------
// Points / Rewards
// ---------------------------------------------------------------------------

/**
 * Award points to a user for completing a transaction.
 *
 * Matches the mobile app's `awardTransactionPointsServer` Cloud Function logic:
 * - USDC: 1 point per $1 USDC sent (floor), minimum 1 point
 * - SOL: 10 points per SOL sent (floor), minimum 1 point
 *
 * Uses a Firestore batch for atomic write (points + history record in one op).
 */
export async function awardTransactionPoints(params: {
  userId: string;
  txId: string;
  amount: number;
  currency: 'USDC' | 'SOL';
  season?: number;
}): Promise<number> {
  const { userId, txId, amount, currency, season = 1 } = params;

  // Calculate points awarded (mirroring mobile pointsService.ts logic)
  const rawPoints = currency === 'USDC'
    ? Math.floor(amount)           // 1 pt per $1 USDC
    : Math.floor(amount * 10);     // 10 pts per SOL
  const pointsAwarded = Math.max(rawPoints, 1); // minimum 1 point

  const now = new Date().toISOString();
  const ptxId = `ptx_${txId}_${userId.slice(-6)}`;

  // Idempotency: check if points were already awarded for this tx
  const ptxRef = doc(db, 'points_transactions', ptxId);
  const existingPtx = await getDoc(ptxRef);
  if (existingPtx.exists()) {
    return existingPtx.data().amount as number;
  }

  const batch = writeBatch(db);

  // 1. Update user's total points atomically
  const userRef = doc(db, 'users', userId);
  batch.update(userRef, {
    points: increment(pointsAwarded),
    total_points_earned: increment(pointsAwarded),
    // camelCase (mobile)
    totalPointsEarned: increment(pointsAwarded),
    points_last_updated: now,
    pointsLastUpdated: now,
  });

  // 2. Create a points_transactions record (history)
  batch.set(ptxRef, {
    id: ptxId,
    // snake_case (web)
    user_id: userId,
    source_id: txId,
    task_type: `send_${currency.toLowerCase()}`,
    created_at: serverTimestamp(),
    // camelCase (mobile)
    userId,
    sourceId: txId,
    taskType: `send_${currency.toLowerCase()}`,
    createdAt: serverTimestamp(),
    // shared
    amount: pointsAwarded,
    source: 'transaction_reward' as const,
    description: `${pointsAwarded} point${pointsAwarded !== 1 ? 's' : ''} for sending ${amount} ${currency}`,
    // S4-2: include both season (mobile) and season_id (snake_case) for cross-platform leaderboard
    season,
    season_id: season,
  });

  await batch.commit();
  return pointsAwarded;
}

/** Fetch user's points history from points_transactions collection */
export async function getPointsHistory(
  userId: string,
  maxResults = 50,
): Promise<PointsTransaction[]> {
  const q = query(
    collection(db, 'points_transactions'),
    where('user_id', '==', userId),
    orderBy('created_at', 'desc'),
    firestoreLimit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PointsTransaction));
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

/** Fetch top users by points for the leaderboard */
export async function getLeaderboard(maxResults = 100): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(db, 'users'),
    orderBy('points', 'desc'),
    firestoreLimit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? data.display_name ?? 'Unknown',
      email: data.email,
      wallet_address: data.wallet_address,
      avatar_url: data.avatar_url ?? data.telegram_photo_url,
      points: data.points ?? 0,
      rank: i + 1,
      active_badge: data.active_badge,
      badges: data.badges,
    } as LeaderboardEntry;
  });
}

/** Get the current user's rank (count of users with more points + 1) */
export async function getUserRank(userId: string): Promise<number> {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return 0;
  const userPoints = userSnap.data().points ?? 0;

  const q = query(
    collection(db, 'users'),
    where('points', '>', userPoints),
  );
  const countSnap = await getCountFromServer(q);
  return countSnap.data().count + 1;
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

/** Fetch user's quest progress from subcollection */
export async function getUserQuests(userId: string): Promise<Quest[]> {
  const q = query(collection(db, 'users', userId, 'quests'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, type: d.id, ...d.data() } as Quest));
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** Fetch all badge definitions */
export async function getBadgeDefinitions(): Promise<BadgeDefinition[]> {
  const snap = await getDocs(collection(db, 'badges'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BadgeDefinition));
}

/** Fetch user's badge progress (combines global definitions with user's claimed badges) */
export async function getUserBadgeProgress(userId: string): Promise<UserBadgeProgress[]> {
  const [definitions, userBadgesSnap, metricsSnap] = await Promise.all([
    getBadgeDefinitions(),
    getDocs(collection(db, 'users', userId, 'badges')),
    getDoc(doc(db, 'users', userId, 'metadata', 'badge_metrics')),
  ]);

  const claimedMap = new Map<string, DocumentData>();
  userBadgesSnap.docs.forEach((d) => claimedMap.set(d.id, d.data()));

  const metrics = metricsSnap.exists() ? metricsSnap.data() : {};

  return definitions.map((badge) => {
    const claimed = claimedMap.get(badge.id);
    const current = (metrics[badge.metric] as number) ?? 0;
    return {
      badge,
      current,
      claimed: !!claimed,
      claimed_at: claimed?.claimed_at,
    };
  });
}

/** Claim a badge for a user — AR-B1: verifies badge is earned before writing claim */
export async function claimBadge(userId: string, badgeId: string): Promise<void> {
  // AR-B1: Check eligibility — badge must be earned before it can be claimed.
  // This is a client-side check; Firestore Security Rules should enforce this server-side too.
  const progressSnap = await getDoc(doc(db, 'users', userId, 'badges', badgeId));
  if (progressSnap.exists()) {
    const progress = progressSnap.data();
    const isEarned = progress.isEarned === true || progress.is_earned === true || !!progress.earned_at;
    const alreadyClaimed = progress.isClaimed === true || progress.claimed === true;
    if (alreadyClaimed) {
      throw new Error('Badge already claimed');
    }
    if (!isEarned) {
      throw new Error('Badge not yet earned');
    }
  }
  // If no progress doc exists, the badge hasn't been earned — deny the claim
  // (Note: progress docs are created by Cloud Functions when mobile app earns badges)
  else {
    throw new Error('Badge not yet earned');
  }

  // S3-5: Explicitly preserve earned_at from progress doc so merge doesn't lose it
  const earnedAtFields: Record<string, unknown> = {};
  if (progressSnap.exists()) {
    const progress = progressSnap.data();
    if (progress.earned_at) earnedAtFields.earned_at = progress.earned_at;
    if (progress.earnedAt) earnedAtFields.earnedAt = progress.earnedAt;
  }

  await setDoc(doc(db, 'users', userId, 'badges', badgeId), {
    ...earnedAtFields,
    claimed: true,
    claimed_at: serverTimestamp(),
    // camelCase for mobile compat
    isClaimed: true,
    claimedAt: serverTimestamp(),
  }, { merge: true }); // merge: true to preserve other progress fields
  await updateDoc(doc(db, 'users', userId), {
    badges: arrayUnion(badgeId),
  });
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

/** Ensure user has a referral code; generate one if missing */
export async function ensureReferralCode(userId: string): Promise<string> {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) throw new Error('User not found');

  const existing = userSnap.data().referral_code;
  if (existing) return existing;

  // Generate a short code: first 4 chars of name + random 4 chars
  const name = (userSnap.data().name ?? 'user').replace(/\s/g, '').slice(0, 4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = `${name}${rand}`;

  await updateDoc(doc(db, 'users', userId), {
    referral_code: code,
    referralCode: code,
  });
  return code;
}

/** Get user's referral count */
export async function getUserReferralCount(userId: string): Promise<number> {
  const q = query(
    collection(db, 'referrals'),
    where('referrerId', '==', userId),
  );
  const countSnap = await getCountFromServer(q);
  return countSnap.data().count;
}
