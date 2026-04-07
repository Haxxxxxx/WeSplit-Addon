/**
 * Notification-related Firestore queries.
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { NotificationData } from '@/types';

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getUserNotifications(
  userId: string,
  maxResults = 50,
): Promise<NotificationData[]> {
  const q = query(
    collection(db, 'notifications'),
    where('user_id', '==', userId),
    orderBy('created_at', 'desc'),
    firestoreLimit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationData));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const ref = doc(db, 'notifications', notificationId);
  const now = new Date().toISOString();
  await updateDoc(ref, { is_read: true, read: true, read_at: now, isRead: true, readAt: now });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('user_id', '==', userId),
    where('is_read', '==', false),
    firestoreLimit(100),
  );
  const snap = await getDocs(q);
  const now = new Date().toISOString();
  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(d.ref, { is_read: true, read: true, read_at: now, isRead: true, readAt: now }),
    ),
  );
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', notificationId));
}
