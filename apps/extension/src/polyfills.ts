import { Buffer } from 'buffer';

// Polyfill Buffer for browser
window.Buffer = Buffer;
globalThis.Buffer = Buffer;

// Polyfill process for some libraries
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || { env: {} };
}

export {};
