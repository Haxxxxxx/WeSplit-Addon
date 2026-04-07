/**
 * Application Configuration
 * 
 * Centralized configuration values and environment variables.
 * All app-wide configuration should be defined here.
 */

export const appConfig = {
  solPriceUsd: {
    fallback: 150,
    // TODO: Fetch from API endpoint for real-time price
    // apiUrl: import.meta.env.VITE_SOL_PRICE_API_URL,
  },
  rpc: {
    required: true,
    url: import.meta.env.VITE_SOLANA_RPC_URL,
  },
  // Add other config values here as needed
} as const;
