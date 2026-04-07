/**
 * Shared wallet Firestore queries — CRUD, members, permissions.
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  SharedWallet,
  SharedWalletMember,
  SharedWalletPermissions,
  SharedWalletSettings,
  SharedWalletTransaction,
} from '@/types';

// ---------------------------------------------------------------------------
// Shared Wallets
// ---------------------------------------------------------------------------

export async function getUserSharedWallets(
  userId: string
): Promise<SharedWallet[]> {
  // Query wallets where user is in memberIds (camelCase — matches security rules field).
  // Both mobile and web dual-write memberIds + member_ids, so this covers all docs.
  const snap = await getDocs(query(
    collection(db, 'sharedWallets'),
    where('memberIds', 'array-contains', userId),
    orderBy('createdAt', 'desc')
  ));

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SharedWallet));
}

export async function getSharedWalletById(
  walletId: string
): Promise<SharedWallet | null> {
  const snap = await getDoc(doc(db, 'sharedWallets', walletId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SharedWallet;
}

// ---------------------------------------------------------------------------
// Shared Wallet Transactions
// ---------------------------------------------------------------------------

export async function getSharedWalletTransactions(
  walletId: string,
  maxResults = 50
): Promise<SharedWalletTransaction[]> {
  const q = query(
    collection(db, 'sharedWalletTransactions'),
    where('wallet_id', '==', walletId),
    orderBy('created_at', 'desc'),
    firestoreLimit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as SharedWalletTransaction)
  );
}

// ---------------------------------------------------------------------------
// Default Permissions
// ---------------------------------------------------------------------------

const CREATOR_PERMISSIONS: SharedWalletPermissions = {
  canInviteMembers: true,
  canWithdraw: true,
  canFund: true,
  canManageSettings: true,
  canRemoveMembers: true,
  canViewTransactions: true,
};

const DEFAULT_MEMBER_PERMISSIONS: SharedWalletPermissions = {
  canInviteMembers: false,
  canWithdraw: true,
  canFund: true,
  canManageSettings: false,
  canRemoveMembers: false,
  canViewTransactions: true,
};

// ---------------------------------------------------------------------------
// Create Shared Wallet
// ---------------------------------------------------------------------------

export async function createSharedWallet(params: {
  name: string;
  description?: string;
  creatorId: string;
  creatorName: string;
  creatorWalletAddress: string;
  walletAddress: string;
  currency?: string;
  settings?: Partial<SharedWalletSettings>;
}): Promise<string> {
  const walletId = `sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const creatorMember: SharedWalletMember & Record<string, unknown> = {
    // Web format (snake_case)
    user_id: params.creatorId,
    joined_at: now,
    wallet_address: params.creatorWalletAddress,
    // Mobile format (camelCase)
    userId: params.creatorId,
    walletAddress: params.creatorWalletAddress,
    joinedAt: now,
    // Shared
    role: 'creator',
    name: params.creatorName,
    permissions: CREATOR_PERMISSIONS,
    status: 'active',
    totalContributed: 0,
    totalWithdrawn: 0,
    linkedCards: [],
  };

  const walletDoc: Record<string, unknown> = {
    id: walletId,
    name: params.name.trim(),
    description: params.description?.trim() ?? '',
    // Web format
    wallet_address: params.walletAddress,
    creator_id: params.creatorId,
    member_ids: [params.creatorId],
    created_at: now,
    updated_at: now,
    // Mobile format
    creatorId: params.creatorId,
    creatorName: params.creatorName,
    walletAddress: params.walletAddress,
    publicKey: params.walletAddress,
    memberIds: [params.creatorId],
    createdAt: now,
    updatedAt: now,
    totalBalance: 0,
    allocatedBalance: 0,
    // Shared
    members: [creatorMember],
    balance: 0,
    usdc_balance: 0,
    sol_balance: 0,
    currency: params.currency ?? 'USDC',
    status: 'active',
    settings: {
      requireApprovalForWithdrawals: params.settings?.requireApprovalForWithdrawals ?? false,
      allowMemberInvites: true,
      ...(params.settings?.dailyWithdrawalLimit !== undefined && {
        dailyWithdrawalLimit: params.settings.dailyWithdrawalLimit,
      }),
      ...(params.settings?.perTransactionLimit !== undefined && {
        perTransactionLimit: params.settings.perTransactionLimit,
      }),
    },
  };

  await setDoc(doc(db, 'sharedWallets', walletId), walletDoc);
  return walletId;
}

// ---------------------------------------------------------------------------
// Store Encrypted Shared Wallet Key
// ---------------------------------------------------------------------------

export async function storeSharedWalletKey(
  walletId: string,
  userId: string,
  encryptedKey: string,
): Promise<void> {
  // Use the actual Firebase Auth UID as the path segment — do NOT prepend 'tg_'.
  // After account linking, the UID is the real user UID (not tg_XXXXX).
  // The userId param should come from auth.currentUser.uid, not a manually built string.
  await setDoc(
    doc(db, 'splitWalletPrivateKeys', walletId, 'participants', userId),
    {
      encrypted_key: encryptedKey,
      encryption_method: 'tg_pin_aes256gcm',
      user_id: userId,
      created_at: serverTimestamp(),
    },
  );
}

// ---------------------------------------------------------------------------
// Invite Members to Shared Wallet
// ---------------------------------------------------------------------------

export async function inviteMembersToWallet(
  walletId: string,
  inviterId: string,
  inviterName: string,
  invitees: { userId: string; name: string; email?: string; walletAddress?: string }[],
): Promise<void> {
  const wallet = await getSharedWalletById(walletId);
  if (!wallet) throw new Error('Wallet not found');

  const now = new Date().toISOString();
  const newMembers = invitees.map((inv) => ({
    // Web format
    user_id: inv.userId,
    joined_at: now,
    invited_by: inviterId,
    wallet_address: inv.walletAddress ?? '',
    // Mobile format
    userId: inv.userId,
    walletAddress: inv.walletAddress ?? '',
    joinedAt: now,
    // Shared
    role: 'member' as const,
    name: inv.name,
    email: inv.email,
    permissions: DEFAULT_MEMBER_PERMISSIONS,
    status: 'active',
    totalContributed: 0,
    totalWithdrawn: 0,
    linkedCards: [],
  }));

  const updatedMembers = [...(wallet.members || []), ...newMembers];
  const updatedMemberIds = updatedMembers.map((m) => m.user_id ?? m.userId);

  const walletRef = doc(db, 'sharedWallets', walletId);
  await updateDoc(walletRef, {
    members: updatedMembers,
    member_ids: updatedMemberIds,
    memberIds: updatedMemberIds,
    updated_at: now,
    updatedAt: now,
  });

  // Create notifications for invitees
  await Promise.all(
    invitees.map((inv) => {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        // snake_case (web)
        notification_type: 'shared_wallet_invite',
        user_id: inv.userId,
        from_user: inviterId,
        // S3-6: include inviter name so mobile shows "{Name} invited you"
        from_name: inviterName,
        is_read: false,
        created_at: serverTimestamp(),
        // camelCase (mobile)
        notificationType: 'shared_wallet_invite',
        userId: inv.userId,
        fromUser: inviterId,
        fromName: inviterName,
        isRead: false,
        createdAt: serverTimestamp(),
        // shared
        type: 'shared_wallet_invite',
        title: 'Wallet Invitation',
        body: `${inviterName} invited you to "${wallet.name}"`,
        read: false,
        data: { wallet_id: walletId, inviter_id: inviterId, inviter_name: inviterName, action: 'invite' },
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Remove Member from Shared Wallet
// ---------------------------------------------------------------------------

export async function removeMemberFromWallet(
  walletId: string,
  memberUserId: string,
): Promise<void> {
  const wallet = await getSharedWalletById(walletId);
  if (!wallet) throw new Error('Wallet not found');

  const updatedMembers = wallet.members.filter(
    (m) => m.user_id !== memberUserId && m.userId !== memberUserId,
  );
  const updatedMemberIds = updatedMembers.map((m) => m.user_id ?? m.userId);

  await updateDoc(doc(db, 'sharedWallets', walletId), {
    members: updatedMembers,
    member_ids: updatedMemberIds,
    memberIds: updatedMemberIds,
    updated_at: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Update Shared Wallet Info (name, description)
// ---------------------------------------------------------------------------

export async function updateSharedWalletInfo(
  walletId: string,
  updates: { name?: string; description?: string },
): Promise<void> {
  const data: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (updates.name !== undefined) data.name = updates.name.trim();
  if (updates.description !== undefined) data.description = updates.description.trim();
  await updateDoc(doc(db, 'sharedWallets', walletId), data);
}

// ---------------------------------------------------------------------------
// Update Shared Wallet Settings
// ---------------------------------------------------------------------------

export async function updateSharedWalletSettings(
  walletId: string,
  settings: Partial<SharedWalletSettings>,
): Promise<void> {
  await updateDoc(doc(db, 'sharedWallets', walletId), {
    settings,
    updated_at: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Member Rights / Permissions
// ---------------------------------------------------------------------------

/** Update a member's permissions in a shared wallet */
export async function updateMemberPermissions(
  walletId: string,
  memberUserId: string,
  permissions: Partial<SharedWalletPermissions>,
): Promise<void> {
  const walletRef = doc(db, 'sharedWallets', walletId);
  const snap = await getDoc(walletRef);
  if (!snap.exists()) throw new Error('Wallet not found');

  const data = snap.data();
  const members = [...(data.members || [])];
  const idx = members.findIndex(
    (m: SharedWalletMember) => m.user_id === memberUserId,
  );
  if (idx === -1) throw new Error('Member not found');

  members[idx] = {
    ...members[idx],
    permissions: { ...(members[idx].permissions || {}), ...permissions },
  };

  await updateDoc(walletRef, { members, updated_at: serverTimestamp(), updatedAt: serverTimestamp() });
}
