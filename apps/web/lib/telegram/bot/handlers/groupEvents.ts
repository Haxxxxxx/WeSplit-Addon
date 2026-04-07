/**
 * Telegram Bot — Group lifecycle event handlers
 *
 * Handles:
 *   my_chat_member  — Bot added to / removed from a group
 *   chat_member     — Member joined / left a group
 *
 * Creates / updates `telegramGroups/{tg_group_CHATID}` in Firestore.
 */

import type { BotContext } from '../types';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { lookupUserIdByTelegramId } from '../helpers';

// ---------------------------------------------------------------------------
// my_chat_member — bot add/remove
// ---------------------------------------------------------------------------

export async function handleMyChatMember(ctx: BotContext): Promise<void> {
  const update = ctx.myChatMember;
  if (!update) return;

  const chat = update.chat;
  const newStatus = update.new_chat_member.status;
  const addedBy = update.from;

  if (chat.type !== 'group' && chat.type !== 'supergroup') return;

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const groupRef = db.collection('telegramGroups').doc(`tg_group_${chat.id}`);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (newStatus === 'member' || newStatus === 'administrator') {
      // Bot was added
      const groupSnap = await groupRef.get();

      if (!groupSnap.exists) {
        // Create new group document
        const addedByUser = await lookupUserIdByTelegramId(addedBy.id);
        await groupRef.set({
          // snake_case
          id: `tg_group_${chat.id}`,
          chat_id: chat.id,
          chat_type: chat.type,
          title: chat.title ?? 'Unknown Group',
          added_by: addedByUser ?? `tg_${addedBy.id}`,
          added_at: now,
          members: [buildMember(addedBy, addedByUser, false)],
          settings: {
            default_currency: 'USDC',
            auto_split: false,
            notifications_enabled: true,
          },
          total_splits_created: 0,
          is_active: true,
          // camelCase
          chatId: chat.id,
          chatType: chat.type,
          addedBy: addedByUser ?? `tg_${addedBy.id}`,
          addedAt: now,
          totalSplitsCreated: 0,
          isActive: true,
        });
      } else {
        // Reactivate existing group
        await groupRef.update({
          is_active: true,
          isActive: true,
          title: chat.title ?? groupSnap.data()?.title,
        });
      }

    } else if (['kicked', 'left'].includes(newStatus)) {
      // Bot was removed
      await groupRef.update({
        is_active: false,
        isActive: false,
      }).catch(() => {
        // Group doc may not exist if bot was removed before it could create it
      });
    }
  } catch (err) {
    console.error('[GroupEvents:myChatMember] Error:', err);
  }
}

// ---------------------------------------------------------------------------
// chat_member — member join/leave
// ---------------------------------------------------------------------------

export async function handleChatMember(ctx: BotContext): Promise<void> {
  const update = ctx.chatMember;
  if (!update) return;

  const chat = update.chat;
  if (chat.type !== 'group' && chat.type !== 'supergroup') return;

  const member = update.new_chat_member;
  const oldStatus = update.old_chat_member.status;
  const newStatus = member.status;

  // Skip bot's own events (handled by my_chat_member)
  if (member.user.is_bot) return;

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const groupRef = db.collection('telegramGroups').doc(`tg_group_${chat.id}`);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      // Group not tracked yet — skip
      return;
    }

    const groupData = groupSnap.data()!;
    let members: GroupMember[] = groupData.members ?? [];

    const user = member.user;
    const wesplitUserId = await lookupUserIdByTelegramId(user.id);
    const isAdmin = newStatus === 'administrator' || newStatus === 'creator';

    const memberJoined = ['member', 'administrator', 'creator'].includes(newStatus) &&
      !['member', 'administrator', 'creator'].includes(oldStatus);
    const memberLeft = ['left', 'kicked'].includes(newStatus);

    if (memberJoined) {
      // Add or update member in array
      const existingIdx = members.findIndex((m) => m.telegram_id === user.id);
      const newMember = buildMember(user, wesplitUserId, isAdmin);

      if (existingIdx >= 0) {
        members[existingIdx] = newMember;
      } else {
        members.push(newMember);
      }

      await groupRef.update({ members });
    } else if (memberLeft) {
      // Remove member
      members = members.filter((m) => m.telegram_id !== user.id);
      await groupRef.update({ members });
    }
  } catch (err) {
    console.error('[GroupEvents:chatMember] Error:', err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}

interface GroupMember {
  telegram_id: number;
  telegram_username?: string;
  telegram_first_name: string;
  wesplit_user_id?: string;
  wallet_address?: string;
  joined_at: string;
  is_admin: boolean;
}

function buildMember(user: TelegramUser, wesplitUserId: string | null, isAdmin: boolean): GroupMember {
  return {
    telegram_id: user.id,
    telegram_username: user.username,
    telegram_first_name: user.first_name,
    wesplit_user_id: wesplitUserId ?? undefined,
    joined_at: new Date().toISOString(),
    is_admin: isAdmin,
  };
}

