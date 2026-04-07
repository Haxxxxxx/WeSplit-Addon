/**
 * Telegram Bot — Type definitions
 *
 * Defines the grammY context type (BotContext) with session flavor,
 * and the shape of session data persisted in Firestore.
 */
import type { Context, SessionFlavor } from 'grammy';

// ---------------------------------------------------------------------------
// Session shape — stored per user in `telegramBotSessions`
// ---------------------------------------------------------------------------

export interface SessionData {
  /** Conversation state: waiting for user to provide split amount */
  awaitingAmount?: boolean;
  /** Pending split title (from /split command, awaiting amount) */
  pendingSplitTitle?: string;
  /** Pending split participants (telegram usernames) */
  pendingSplitParticipants?: string[];
  /** The group chat_id where the pending split was initiated */
  pendingSplitGroupId?: number;
  /** Last command issued by this user */
  lastCommand?: string;
  /** ISO timestamp of last command */
  lastCommandAt?: string;
}

/** Initial session data — returned for new sessions */
export function initialSessionData(): SessionData {
  return {};
}

// ---------------------------------------------------------------------------
// Bot context — extends base grammY Context with session
// ---------------------------------------------------------------------------

export type BotContext = Context & SessionFlavor<SessionData>;
