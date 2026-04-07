/**
 * Logger utility for development and production
 * 
 * In development, logs are shown in console.
 * In production, only errors and warnings are shown.
 */

export const logger = {
  log: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
};
