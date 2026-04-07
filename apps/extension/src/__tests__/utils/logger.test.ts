/**
 * Logger Utility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../../utils/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logger.log', () => {
    it('should log in development mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      // @ts-expect-error - import.meta.env.DEV is not easily mockable in vitest
      // In real tests, you'd use a proper env mocking library
      logger.log('test message');
      // Note: This test may need adjustment based on actual env setup
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('logger.error', () => {
    it('should always log errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('error message');
      expect(consoleSpy).toHaveBeenCalledWith('error message');
      consoleSpy.mockRestore();
    });
  });

  describe('logger.warn', () => {
    it('should always log warnings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warning message');
      expect(consoleSpy).toHaveBeenCalledWith('warning message');
      consoleSpy.mockRestore();
    });
  });
});
