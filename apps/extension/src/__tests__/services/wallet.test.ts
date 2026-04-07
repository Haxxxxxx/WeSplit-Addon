/**
 * Wallet Service Tests
 */

import { describe, it, expect } from 'vitest';
import { isValidSolanaAddress, shortenAddress } from '../../services/wallet';

describe('wallet service utilities', () => {
  describe('isValidSolanaAddress', () => {
    it('should validate correct Solana addresses', () => {
      const validAddress = 'So11111111111111111111111111111111111111112';
      expect(isValidSolanaAddress(validAddress)).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidSolanaAddress('invalid')).toBe(false);
      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSolanaAddress('123')).toBe(false);
    });

    it('should reject null or undefined', () => {
      // @ts-expect-error - testing invalid input
      expect(isValidSolanaAddress(null)).toBe(false);
      // @ts-expect-error - testing invalid input
      expect(isValidSolanaAddress(undefined)).toBe(false);
    });
  });

  describe('shortenAddress', () => {
    it('should shorten addresses correctly', () => {
      const address = 'So11111111111111111111111111111111111111112';
      const shortened = shortenAddress(address, 4);
      expect(shortened).toBe('So11...1112');
    });

    it('should handle empty string', () => {
      expect(shortenAddress('', 4)).toBe('');
    });

    it('should use default chars if not specified', () => {
      const address = 'So11111111111111111111111111111111111111112';
      const shortened = shortenAddress(address);
      expect(shortened.length).toBeLessThan(address.length);
    });
  });
});
