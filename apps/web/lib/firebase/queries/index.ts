/**
 * Firestore query functions for WeSplit web app.
 *
 * Re-exports all domain-specific query modules for backward compatibility.
 * Import from '@/lib/firebase/queries' as before — no import changes needed.
 */

export * from './users';
export * from './transactions';
export * from './notifications';
export * from './paymentRequests';
export * from './sharedWallets';
export * from './withdrawals';
export * from './rewards';
export * from './expenses';
export * from './contacts';
export * from './telegramGroups';
