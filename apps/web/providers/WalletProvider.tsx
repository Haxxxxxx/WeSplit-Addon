'use client';

import { useMemo, type ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

import { getEndpoint, getNetwork } from '@/lib/solana';

// Wallet adapter UI styles — must be imported once at provider level
import '@solana/wallet-adapter-react-ui/styles.css';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export function WalletProvider({ children }: { children: ReactNode }) {
  const network = getNetwork();
  const endpoint = useMemo(() => getEndpoint(network), [network]);

  // Wallet adapters — Phantom, Solflare, and WalletConnect (for mobile QR)
  const wallets = useMemo(() => {
    const adapters = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ];

    // Only add WalletConnect if a project ID is configured.
    // Get one at https://cloud.walletconnect.com
    if (WALLETCONNECT_PROJECT_ID) {
      adapters.push(
        new WalletConnectWalletAdapter({
          network: network as WalletAdapterNetwork.Mainnet | WalletAdapterNetwork.Devnet,
          options: {
            relayUrl: 'wss://relay.walletconnect.com',
            projectId: WALLETCONNECT_PROJECT_ID,
            metadata: {
              name: 'WeSplit',
              description: 'Decentralized social payments on Solana',
              url: 'https://wesplit.io',
              icons: ['https://wesplit.io/icon.png'],
            },
          },
        }) as any,
      );
    }

    return adapters;
  }, [network]);

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{ commitment: 'confirmed' }}
    >
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
