import { Connection, clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// ---------------------------------------------------------------------------
// RPC endpoint resolution
//
// Client-side: routes through /api/rpc proxy (keeps API keys server-only)
// Server-side: uses env vars directly (no NEXT_PUBLIC_ prefix)
// ---------------------------------------------------------------------------

const isServer = typeof window === 'undefined';

/**
 * Returns the RPC endpoint URL.
 * - Browser: `/api/rpc` proxy (API keys stay server-side)
 * - Server: direct Helius/Alchemy URL from env vars
 */
function resolveEndpoint(network: WalletAdapterNetwork): string {
  if (!isServer) {
    // Client-side — use the proxy to avoid leaking API keys
    return '/api/rpc';
  }

  // Server-side — use env vars directly (no NEXT_PUBLIC_ prefix)
  if (network === WalletAdapterNetwork.Mainnet) {
    return (
      process.env.HELIUS_RPC_URL ??
      process.env.ALCHEMY_RPC_URL ??
      process.env.GETBLOCK_RPC_URL ??
      clusterApiUrl('mainnet-beta')
    );
  }

  return process.env.DEVNET_RPC_URL ?? clusterApiUrl('devnet');
}

// ---------------------------------------------------------------------------
// Network detection — defaults to devnet for safety
// ---------------------------------------------------------------------------

const getNetwork = (): WalletAdapterNetwork => {
  if (process.env.NEXT_PUBLIC_FORCE_MAINNET === 'true') {
    return WalletAdapterNetwork.Mainnet;
  }
  if (process.env.NEXT_PUBLIC_NETWORK === 'mainnet-beta') {
    return WalletAdapterNetwork.Mainnet;
  }
  return WalletAdapterNetwork.Devnet;
};

// ---------------------------------------------------------------------------
// Endpoint resolution (public API — used by wallet adapter provider)
// ---------------------------------------------------------------------------

const getEndpoint = (network?: WalletAdapterNetwork): string => {
  const net = network ?? getNetwork();
  return resolveEndpoint(net);
};

// ---------------------------------------------------------------------------
// Connection factory
// ---------------------------------------------------------------------------

const createConnection = (network?: WalletAdapterNetwork): Connection => {
  const net = network ?? getNetwork();
  const endpoint = resolveEndpoint(net);

  // The /api/rpc proxy accepts JSON-RPC POST — Connection uses fetch internally,
  // which works with relative URLs in the browser.
  return new Connection(endpoint, { commitment: 'confirmed' });
};

// ---------------------------------------------------------------------------
// Fallback connection — server-side only (tries direct endpoints in order)
// On client, just returns the proxy connection since the proxy has its own fallback.
// ---------------------------------------------------------------------------

const createFallbackConnection = async (
  network?: WalletAdapterNetwork,
): Promise<Connection> => {
  const net = network ?? getNetwork();

  if (!isServer) {
    return new Connection('/api/rpc', { commitment: 'confirmed' });
  }

  // Server-side: try each provider in order
  const endpoints = net === WalletAdapterNetwork.Mainnet
    ? [
        process.env.HELIUS_RPC_URL,
        process.env.ALCHEMY_RPC_URL,
        process.env.GETBLOCK_RPC_URL,
        clusterApiUrl('mainnet-beta'),
      ].filter(Boolean) as string[]
    : [
        process.env.DEVNET_RPC_URL,
        clusterApiUrl('devnet'),
      ].filter(Boolean) as string[];

  for (const endpoint of endpoints) {
    try {
      const connection = new Connection(endpoint, { commitment: 'confirmed' });
      await connection.getSlot();
      return connection;
    } catch {
      continue;
    }
  }

  const fallbackUrl = clusterApiUrl(
    net === WalletAdapterNetwork.Mainnet ? 'mainnet-beta' : 'devnet',
  );
  return new Connection(fallbackUrl, { commitment: 'confirmed' });
};

export {
  createConnection,
  createFallbackConnection,
  getNetwork,
  getEndpoint,
};
