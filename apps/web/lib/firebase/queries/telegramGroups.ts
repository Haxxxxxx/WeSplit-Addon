/**
 * Telegram Group — Firestore query functions (client-side)
 *
 * These are used by the Mini App to read group data (members, settings,
 * active split) when it's opened in group context.
 *
 * Bot writes to this collection via Firebase Admin SDK (server-side).
 * Mini App reads from it via Firebase client SDK (client-side).
 *
 * Collection: `telegramGroups/{tg_group_{chatId}}`
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelegramGroupMember {
  telegram_id: number;
  telegram_username?: string;
  telegram_first_name: string;
  wesplit_user_id?: string;
  wallet_address?: string;
  joined_at: string;
  is_admin: boolean;
}

export interface TelegramGroupSettings {
  default_currency: 'USDC' | 'SOL';
  auto_split: boolean;
  notifications_enabled: boolean;
}

export interface TelegramGroup {
  id: string;
  chat_id: number;
  chat_type: 'group' | 'supergroup';
  title: string;
  added_by: string;
  added_at: string;
  members: TelegramGroupMember[];
  settings: TelegramGroupSettings;
  active_split_id?: string;
  total_splits_created: number;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch a Telegram group doc by chat ID.
 * Returns null if bot hasn't been added to this group yet.
 */
export async function getTelegramGroup(chatId: number): Promise<TelegramGroup | null> {
  const docId = `tg_group_${chatId}`;
  const snap = await getDoc(doc(db, 'telegramGroups', docId));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as TelegramGroup;
}

/**
 * Update Telegram group settings or data.
 * Only updates the provided fields (merge-style).
 */
export async function updateTelegramGroup(
  chatId: number,
  data: Partial<Omit<TelegramGroup, 'id'>>,
): Promise<void> {
  const docId = `tg_group_${chatId}`;
  await updateDoc(doc(db, 'telegramGroups', docId), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

/**
 * Fetch group members with their WeSplit user IDs.
 * Returns the members array from the group doc.
 */
export async function getTelegramGroupMembers(chatId: number): Promise<TelegramGroupMember[]> {
  const group = await getTelegramGroup(chatId);
  return group?.members ?? [];
}

/**
 * Link a Telegram group member to their WeSplit user account.
 * Called after account linking completes in the Mini App.
 */
export async function linkTelegramMemberToUser(
  chatId: number,
  telegramId: number,
  wesplitUserId: string,
  walletAddress?: string,
): Promise<void> {
  const group = await getTelegramGroup(chatId);
  if (!group) return;

  const updatedMembers = group.members.map((m) => {
    if (m.telegram_id === telegramId) {
      return {
        ...m,
        wesplit_user_id: wesplitUserId,
        ...(walletAddress ? { wallet_address: walletAddress } : {}),
      };
    }
    return m;
  });

  await updateTelegramGroup(chatId, { members: updatedMembers });
}

/**
 * Get all Telegram groups where a WeSplit user is a member.
 * Used to show a user's group activity history.
 */
export async function getGroupsForUser(wesplitUserId: string): Promise<TelegramGroup[]> {
  // Firestore doesn't support array-contains-object queries,
  // so we query all active groups and filter client-side.
  // This is acceptable since a user won't be in many groups.
  const snap = await getDocs(
    query(collection(db, 'telegramGroups'), where('is_active', '==', true)),
  );

  const groups: TelegramGroup[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Omit<TelegramGroup, 'id'>;
    const isMember = (data.members ?? []).some((m) => m.wesplit_user_id === wesplitUserId);
    if (isMember) {
      groups.push({ ...data, id: d.id });
    }
  }
  return groups;
}
