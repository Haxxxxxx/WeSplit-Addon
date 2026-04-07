// Telegram Mini App utilities — barrel export
export { initTelegramSDK, isTelegramWebApp } from './init';
export { authenticateWithTelegram, type TelegramUser } from './auth';
export {
  useTelegramUser,
  useTelegramInitDataRaw,
  useTelegramTheme,
  useTelegramIsDark,
  useTelegramMainButton,
  useTelegramBackButton,
  useTelegramHaptic,
  useTelegramViewport,
  useCloseMiniApp,
  tgConfirm,
} from './hooks';
export { mockTelegramForDev } from './mock';
export { useTgNavigation } from './useTgNavigation';
export { useTgWallet, type TgWalletState } from './useTgWallet';
export {
  getWalletInfo,
  createWallet,
  importWallet,
  unlockWallet,
  signTransaction,
  changePin,
  deleteWallet,
  getPinHint,
  type WalletInfo,
  type CreateWalletResult,
  type UnlockedWallet,
} from './wallet';
export {
  generateWallet,
  walletFromMnemonic,
  encryptSecretKey,
  decryptSecretKey,
  wipeBytes,
} from './crypto';
export {
  linkWithMnemonic,
  findAccountByEmail,
  linkWithCloudBackup,
  requestEmailOtp,
  verifyEmailOtp,
  type LinkResult,
  type BackupLookupResult,
} from './accountLink';
