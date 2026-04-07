import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Keep crypto/signing packages server-side only — prevents bundling into client
  serverExternalPackages: ['tweetnacl', 'bs58', '@noble/hashes', 'firebase-admin'],

  images: {
    remotePatterns: [
      // Firebase Storage
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'wesplit-35186.firebasestorage.app' },
      // Arweave (NFT metadata, on-chain images)
      { protocol: 'https', hostname: 'arweave.net' },
      // Google profile pictures (Google OAuth avatars)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  webpack: (config, { isServer }) => {
    // Solana / web3.js polyfills — these Node.js modules aren't available in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    // Suppress pino-pretty warning from WalletConnect
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino-pretty': false,
      };
    }

    return config;
  },
};

export default nextConfig;
