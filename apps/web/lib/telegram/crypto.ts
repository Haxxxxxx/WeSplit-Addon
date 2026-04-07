/**
 * TG Mini App — Client-Side Cryptography Utilities
 *
 * Re-exports from the shared crypto module (lib/crypto/walletCrypto.ts).
 * All crypto ops are platform-agnostic — this file exists only to keep
 * existing TG imports stable.
 */

export {
  generateWallet,
  walletFromMnemonic,
  validateMnemonic,
  encryptSecretKey,
  decryptSecretKey,
  wipeBytes,
  type GeneratedWallet,
} from '@/lib/crypto/walletCrypto';
