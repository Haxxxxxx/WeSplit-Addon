import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from '@solana/web3.js';
import type { WalletProvider, WalletInfo, Transaction } from '../types';
import { logger } from '../utils/logger';

// Solana RPC endpoints - try multiple in case one fails
// Primary: Alchemy (from env), Fallbacks: public RPCs
const RPC_ENDPOINTS = [
  import.meta.env.VITE_SOLANA_RPC_URL,
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
].filter(Boolean) as string[];

// Log which RPC is configured
if (import.meta.env.VITE_SOLANA_RPC_URL) {
  logger.log('Using Alchemy RPC as primary endpoint');
} else {
  logger.log('No custom RPC configured, using public endpoints');
}

// Create connection with first available RPC
let currentRpcIndex = 0;
let connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

// Switch to next RPC on error
const switchToNextRpc = () => {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  logger.log(`Switching to RPC: ${RPC_ENDPOINTS[currentRpcIndex]}`);
  connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
};

// Rate limiting helpers
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 300; // 300ms between requests

const rateLimitedRequest = async <T>(fn: () => Promise<T>, retries = 2): Promise<T> => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  try {
    return await fn();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Switch RPC on: 403, 429, CORS errors, or network failures
    const shouldSwitch =
      errorMessage.includes('403') ||
      errorMessage.includes('429') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('CORS') ||
      errorMessage.includes('NetworkError');

    if (retries > 0 && shouldSwitch) {
      logger.log(`RPC error (${errorMessage.slice(0, 50)}...), switching to backup...`);
      switchToNextRpc();
      await new Promise(resolve => setTimeout(resolve, 500));
      return rateLimitedRequest(fn, retries - 1);
    }
    throw error;
  }
};

// Balance cache
const balanceCache: Map<string, { sol: number; usdc: number; timestamp: number }> = new Map();
const BALANCE_CACHE_DURATION = 30000; // 30 seconds

// USDC Token mint address on Solana mainnet
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// ============================================
// Standard Solana Wallet Interface
// ============================================

interface SolanaWalletProvider {
  isConnected: boolean;
  publicKey: PublicKey | null;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction?: (transaction: any) => Promise<any>;
  signAllTransactions?: (transactions: any[]) => Promise<any[]>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  on?: (event: string, callback: (...args: any[]) => void) => void;
  off?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
}

// ============================================
// Wallet Detection Functions
// ============================================

// Helper to safely check window properties
const getWindowProperty = (path: string): any => {
  if (typeof window === 'undefined') return null;
  return path.split('.').reduce((obj, key) => obj?.[key], window as any);
};

// Check if Phantom is installed
export const isPhantomInstalled = (): boolean => {
  const phantom = getWindowProperty('phantom.solana');
  return !!(phantom?.isPhantom);
};

// Check if Solflare is installed
export const isSolflareInstalled = (): boolean => {
  const solflare = getWindowProperty('solflare');
  return !!(solflare?.isSolflare);
};

// Check if Backpack is installed
export const isBackpackInstalled = (): boolean => {
  const backpack = getWindowProperty('backpack');
  return !!(backpack?.isBackpack);
};

// Check if Glow is installed
export const isGlowInstalled = (): boolean => {
  const glow = getWindowProperty('glow') || getWindowProperty('glowSolana');
  return !!(glow?.isGlow);
};

// Check if Coinbase Wallet is installed
export const isCoinbaseInstalled = (): boolean => {
  const coinbase = getWindowProperty('coinbaseSolana') ||
                   getWindowProperty('coinbaseWalletExtension');
  return !!coinbase;
};

// Check if Trust Wallet is installed
export const isTrustInstalled = (): boolean => {
  const trust = getWindowProperty('trustwallet.solana') ||
                getWindowProperty('solana.isTrust');
  return !!trust;
};

// Check if Exodus is installed
export const isExodusInstalled = (): boolean => {
  const exodus = getWindowProperty('exodus.solana');
  return !!(exodus?.isExodus);
};

// Check if Brave Wallet is installed
export const isBraveInstalled = (): boolean => {
  const brave = getWindowProperty('braveSolana');
  return !!(brave?.isBraveWallet);
};

// Check for any standard Solana wallet (fallback)
export const hasAnySolanaWallet = (): boolean => {
  if (typeof window === 'undefined') return false;
  const win = window as any;

  // Check for standard window.solana provider
  if (win.solana?.isConnected !== undefined) return true;

  // Check for any known wallet
  return isPhantomInstalled() ||
         isSolflareInstalled() ||
         isBackpackInstalled() ||
         isGlowInstalled() ||
         isCoinbaseInstalled() ||
         isTrustInstalled() ||
         isExodusInstalled() ||
         isBraveInstalled();
};

// ============================================
// Wallet Provider Getters
// ============================================

export const getPhantomProvider = (): SolanaWalletProvider | null => {
  const provider = getWindowProperty('phantom.solana');
  if (provider?.isPhantom) return provider;
  // Fallback: Phantom may also inject as window.solana
  const solana = getWindowProperty('solana');
  if (solana?.isPhantom) return solana;
  return null;
};

export const getSolflareProvider = (): SolanaWalletProvider | null => {
  const provider = getWindowProperty('solflare');
  if (provider?.isSolflare) return provider;
  return null;
};

export const getBackpackProvider = (): SolanaWalletProvider | null => {
  const provider = getWindowProperty('backpack');
  if (provider?.isBackpack) return provider;
  // Backpack also injects as xnft
  const xnft = getWindowProperty('xnft.solana');
  if (xnft) return xnft;
  return null;
};

export const getGlowProvider = (): SolanaWalletProvider | null => {
  const glow = getWindowProperty('glow');
  if (glow?.isGlow) return glow;
  const glowSolana = getWindowProperty('glowSolana');
  if (glowSolana?.isGlow) return glowSolana;
  return null;
};

export const getCoinbaseProvider = (): SolanaWalletProvider | null => {
  const coinbase = getWindowProperty('coinbaseSolana');
  if (coinbase) return coinbase;
  return null;
};

export const getTrustProvider = (): SolanaWalletProvider | null => {
  const trust = getWindowProperty('trustwallet.solana');
  if (trust) return trust;
  // Trust may also set isTrust on window.solana
  const solana = getWindowProperty('solana');
  if (solana?.isTrust) return solana;
  return null;
};

export const getExodusProvider = (): SolanaWalletProvider | null => {
  const exodus = getWindowProperty('exodus.solana');
  if (exodus?.isExodus) return exodus;
  return null;
};

export const getBraveProvider = (): SolanaWalletProvider | null => {
  const brave = getWindowProperty('braveSolana');
  if (brave?.isBraveWallet) return brave;
  return null;
};

// Get the standard window.solana provider (many wallets inject here)
export const getStandardSolanaProvider = (): SolanaWalletProvider | null => {
  const solana = getWindowProperty('solana');
  if (solana && typeof solana.connect === 'function') return solana;
  return null;
};

// ============================================
// Get All Available Wallets
// ============================================

export const getAvailableWallets = (): WalletInfo[] => {
  const wallets: WalletInfo[] = [
    {
      id: 'phantom',
      name: 'Phantom',
      icon: 'phantom',
      color: '#AB9FF2',
      downloadUrl: 'https://phantom.app/',
      detected: isPhantomInstalled(),
    },
    {
      id: 'solflare',
      name: 'Solflare',
      icon: 'solflare',
      color: '#FC8C1B',
      downloadUrl: 'https://solflare.com/',
      detected: isSolflareInstalled(),
    },
    {
      id: 'backpack',
      name: 'Backpack',
      icon: 'backpack',
      color: '#E33E3F',
      downloadUrl: 'https://backpack.app/',
      detected: isBackpackInstalled(),
    },
    {
      id: 'glow',
      name: 'Glow',
      icon: 'glow',
      color: '#8B5CF6',
      downloadUrl: 'https://glow.app/',
      detected: isGlowInstalled(),
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: 'coinbase',
      color: '#0052FF',
      downloadUrl: 'https://www.coinbase.com/wallet',
      detected: isCoinbaseInstalled(),
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: 'trust',
      color: '#3375BB',
      downloadUrl: 'https://trustwallet.com/',
      detected: isTrustInstalled(),
    },
    {
      id: 'exodus',
      name: 'Exodus',
      icon: 'exodus',
      color: '#8B6CEF',
      downloadUrl: 'https://www.exodus.com/',
      detected: isExodusInstalled(),
    },
    {
      id: 'brave',
      name: 'Brave Wallet',
      icon: 'brave',
      color: '#FB542B',
      downloadUrl: 'https://brave.com/wallet/',
      detected: isBraveInstalled(),
    },
  ];

  // Sort: detected wallets first
  return wallets.sort((a, b) => {
    if (a.detected && !b.detected) return -1;
    if (!a.detected && b.detected) return 1;
    return 0;
  });
};

// Get provider by wallet type
const getProviderByType = (provider: WalletProvider): SolanaWalletProvider | null => {
  switch (provider) {
    case 'phantom':
      return getPhantomProvider();
    case 'solflare':
      return getSolflareProvider();
    case 'backpack':
      return getBackpackProvider();
    case 'glow':
      return getGlowProvider();
    case 'coinbase':
      return getCoinbaseProvider();
    case 'trust':
      return getTrustProvider();
    case 'exodus':
      return getExodusProvider();
    case 'brave':
      return getBraveProvider();
    default:
      return null;
  }
};

// Get download URL by wallet type
const getDownloadUrl = (provider: WalletProvider): string => {
  const urls: Record<WalletProvider, string> = {
    phantom: 'https://phantom.app/',
    solflare: 'https://solflare.com/',
    backpack: 'https://backpack.app/',
    glow: 'https://glow.app/',
    coinbase: 'https://www.coinbase.com/wallet',
    trust: 'https://trustwallet.com/',
    exodus: 'https://www.exodus.com/',
    brave: 'https://brave.com/wallet/',
    none: '',
  };
  return urls[provider] || '';
};

// ============================================
// Connect / Disconnect Wallet
// ============================================

/**
 * Universal wallet connection function
 * 
 * Connects to a Solana wallet provider (Phantom, Solflare, etc.).
 * All Solana wallets follow a similar pattern:
 * 1. Call connect() which returns or sets publicKey
 * 2. Get the publicKey from response or provider
 * 
 * @param providerType - The wallet provider to connect to (e.g., 'phantom', 'solflare')
 * @returns Object with wallet address and provider type, or null if wallet not installed
 * @throws Error if connection fails or user rejects the connection
 */
export const connectWallet = async (
  providerType: WalletProvider
): Promise<{ address: string; provider: WalletProvider } | null> => {
  try {
    const walletProvider = getProviderByType(providerType);

    if (!walletProvider) {
      // Wallet not installed, open download page
      const downloadUrl = getDownloadUrl(providerType);
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      }
      return null;
    }

    logger.log(`Connecting to ${providerType}...`);

    // Universal connection approach - works for all standard Solana wallets
    let publicKey: PublicKey | null = null;

    try {
      // Most wallets return { publicKey } from connect()
      const response = await walletProvider.connect();

      // Try to get publicKey from response first
      if (response?.publicKey) {
        publicKey = response.publicKey;
      }
    } catch (connectError: unknown) {
      // User rejected or connection failed
      const errorMessage = connectError instanceof Error ? connectError.message : '';
      const errorCode = connectError && typeof connectError === 'object' && 'code' in connectError ? connectError.code : undefined;
      if (errorCode === 4001 || errorMessage.includes('rejected')) {
        throw new Error('Connection rejected by user');
      }
      throw connectError;
    }

    // Fallback: some wallets set publicKey on the provider after connect()
    if (!publicKey && walletProvider.publicKey) {
      publicKey = walletProvider.publicKey;
    }

    if (!publicKey) {
      throw new Error('No public key returned from wallet. Please try again.');
    }

    logger.log(`Connected to ${providerType}: ${publicKey.toString()}`);

    return {
      address: publicKey.toString(),
      provider: providerType,
    };
  } catch (error: unknown) {
    console.error(`Failed to connect ${providerType}:`, error);
    throw error instanceof Error ? error : new Error('Failed to connect wallet');
  }
};

// Disconnect wallet
export const disconnectWallet = async (providerType: WalletProvider) => {
  try {
    const walletProvider = getProviderByType(providerType);
    if (walletProvider && typeof walletProvider.disconnect === 'function') {
      await walletProvider.disconnect();
    }
    // Clear stored provider
    localStorage.removeItem('wesplit_wallet_provider');
  } catch (error) {
    console.error('Failed to disconnect wallet:', error);
  }
};

// Check if wallet is already connected
export const isWalletConnected = (providerType: WalletProvider): boolean => {
  const walletProvider = getProviderByType(providerType);
  if (!walletProvider) return false;
  return walletProvider.isConnected === true && walletProvider.publicKey !== null;
};

// Auto-reconnect to previously connected wallet
export const autoReconnect = async (
  providerType: WalletProvider
): Promise<{ address: string; provider: WalletProvider } | null> => {
  try {
    const walletProvider = getProviderByType(providerType);
    if (!walletProvider) return null;

    // Check if wallet is already connected
    if (walletProvider.isConnected && walletProvider.publicKey) {
      logger.log(`Auto-reconnected to ${providerType}`);
      return {
        address: walletProvider.publicKey.toString(),
        provider: providerType,
      };
    }

    // Try eager/silent connect (onlyIfTrusted means don't prompt user)
    // This works for wallets that remember previous connections
    try {
      const response = await walletProvider.connect({ onlyIfTrusted: true });
      if (response?.publicKey) {
        logger.log(`Eager reconnected to ${providerType}`);
        return {
          address: response.publicKey.toString(),
          provider: providerType,
        };
      }
      // Fallback: check provider publicKey after connect
      if (walletProvider.publicKey) {
        return {
          address: walletProvider.publicKey.toString(),
          provider: providerType,
        };
      }
    } catch {
      // Eager connect not supported or user hasn't previously connected
      // This is expected behavior, not an error
    }

    return null;
  } catch (error) {
    console.error('Auto-reconnect failed:', error);
    return null;
  }
};

// Listen for wallet events (account changes, disconnect)
export const setupWalletListeners = (
  providerType: WalletProvider,
  onAccountChange: (address: string | null) => void,
  onDisconnect: () => void
): (() => void) => {
  const walletProvider = getProviderByType(providerType);
  if (!walletProvider) return () => {};

  const handleAccountChange = (publicKey: PublicKey | null) => {
    onAccountChange(publicKey?.toString() || null);
  };

  const handleDisconnect = () => {
    onDisconnect();
  };

  // Add event listeners (standard Solana wallet events)
  if (typeof walletProvider.on === 'function') {
    (walletProvider as any).on('accountChanged', handleAccountChange);
    (walletProvider as any).on('disconnect', handleDisconnect);
  }

  // Return cleanup function
  return () => {
    if (typeof (walletProvider as any).off === 'function') {
      (walletProvider as any).off('accountChanged', handleAccountChange);
      (walletProvider as any).off('disconnect', handleDisconnect);
    } else if (typeof (walletProvider as any).removeListener === 'function') {
      (walletProvider as any).removeListener('accountChanged', handleAccountChange);
      (walletProvider as any).removeListener('disconnect', handleDisconnect);
    }
  };
};

/**
 * Get SOL balance for a wallet address
 * 
 * Fetches SOL balance from Solana blockchain with rate limiting.
 * 
 * @param address - Solana wallet address (base58 encoded)
 * @returns SOL balance as a number, or 0 if error occurs
 */
export const getSolBalance = async (address: string): Promise<number> => {
  try {
    const publicKey = new PublicKey(address);
    const balance = await rateLimitedRequest(() => connection.getBalance(publicKey));
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Failed to get SOL balance:', error);
    return 0;
  }
};

/**
 * Get USDC balance for a wallet address
 * 
 * Fetches USDC token balance from Solana blockchain with rate limiting.
 * 
 * @param address - Solana wallet address (base58 encoded)
 * @returns USDC balance as a number, or 0 if error occurs or no USDC account exists
 */
export const getUsdcBalance = async (address: string): Promise<number> => {
  try {
    const publicKey = new PublicKey(address);
    const tokenAccounts = await rateLimitedRequest(() =>
      connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: new PublicKey(USDC_MINT) }
      )
    );

    if (tokenAccounts.value.length === 0) {
      return 0;
    }

    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance || 0;
  } catch (error) {
    console.error('Failed to get USDC balance:', error);
    return 0;
  }
};

/**
 * Get all token balances (SOL and USDC) for a wallet address
 * 
 * Uses caching to reduce API calls. Cache duration is 30 seconds.
 * 
 * @param address - Solana wallet address (base58 encoded)
 * @param forceRefresh - If true, bypasses cache and fetches fresh data
 * @returns Object with sol and usdc balances
 */
export const getBalances = async (
  address: string,
  forceRefresh = false
): Promise<{ sol: number; usdc: number }> => {
  // Check cache first
  const cached = balanceCache.get(address);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < BALANCE_CACHE_DURATION) {
    logger.log('Using cached balances');
    return { sol: cached.sol, usdc: cached.usdc };
  }

  logger.log('Fetching balances from blockchain...');

  // Fetch sequentially to avoid rate limits
  const sol = await getSolBalance(address);
  const usdc = await getUsdcBalance(address);

  // Cache the results
  balanceCache.set(address, { sol, usdc, timestamp: Date.now() });

  return { sol, usdc };
};

// Transaction cache to avoid redundant fetches
const txCache: Map<string, { transactions: Transaction[]; timestamp: number }> = new Map();
const CACHE_DURATION = 60000; // 60 seconds cache (increased to reduce API calls)

// Flag to prevent concurrent fetches
let isFetchingTx = false;

// Get the Associated Token Account (ATA) address for a wallet and token mint
const getAssociatedTokenAddress = (walletAddress: string, mintAddress: string): PublicKey => {
  const wallet = new PublicKey(walletAddress);
  const mint = new PublicKey(mintAddress);
  const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

  // Derive the ATA address (this is the standard way to get ATA address)
  const [ata] = PublicKey.findProgramAddressSync(
    [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
};

// Fetch recent transactions from Solana (one at a time to avoid batch request limits)
export const getRecentTransactions = async (
  address: string,
  limit = 5
): Promise<Transaction[]> => {
  try {
    // Check cache first
    const cached = txCache.get(address);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      logger.log('Using cached transactions');
      return cached.transactions;
    }

    // Prevent concurrent fetches
    if (isFetchingTx) {
      logger.log('Transaction fetch already in progress');
      return cached?.transactions || [];
    }

    isFetchingTx = true;
    logger.log('Fetching transactions from blockchain...');

    const publicKey = new PublicKey(address);

    // Get USDC ATA address for this wallet (to catch incoming USDC transactions)
    let usdcAtaAddress: string | null = null;
    try {
      const usdcAta = getAssociatedTokenAddress(address, USDC_MINT);
      usdcAtaAddress = usdcAta.toString();
      logger.log(`[getRecentTransactions] Wallet: ${address.slice(0, 8)}..., USDC ATA: ${usdcAtaAddress.slice(0, 8)}...`);
    } catch (err) {
      logger.log('[getRecentTransactions] Could not derive USDC ATA address');
    }

    // Get signatures for wallet address
    const walletSignatures = await rateLimitedRequest(() =>
      connection.getSignaturesForAddress(publicKey, {
        limit: Math.min(limit, 10),
      })
    );

    logger.log(`[getRecentTransactions] Found ${walletSignatures.length} wallet signatures`);

    // Also get signatures for the USDC ATA (to catch incoming USDC transfers)
    let ataSignatures: typeof walletSignatures = [];
    if (usdcAtaAddress) {
      try {
        ataSignatures = await rateLimitedRequest(() =>
          connection.getSignaturesForAddress(new PublicKey(usdcAtaAddress!), {
            limit: Math.min(limit, 10),
          })
        );
        logger.log(`[getRecentTransactions] Found ${ataSignatures.length} USDC ATA signatures`);
      } catch (err) {
        logger.log('[getRecentTransactions] Could not fetch USDC ATA signatures (account may not exist)');
      }
    }

    // Combine and deduplicate signatures
    const allSignatures = [...walletSignatures];
    const seenSignatures = new Set(walletSignatures.map(s => s.signature));

    for (const sig of ataSignatures) {
      if (!seenSignatures.has(sig.signature)) {
        allSignatures.push(sig);
        seenSignatures.add(sig.signature);
      }
    }

    // Sort by block time (most recent first) and limit
    allSignatures.sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));
    const limitedSignatures = allSignatures.slice(0, Math.min(limit, 10));

    logger.log(`[getRecentTransactions] Processing ${limitedSignatures.length} unique signatures`);

    if (limitedSignatures.length === 0) {
      isFetchingTx = false;
      txCache.set(address, { transactions: [], timestamp: Date.now() });
      return [];
    }

    // Fetch transactions one at a time (batch requests require paid plan)
    const txResults: (ParsedTransactionWithMeta | null)[] = [];
    for (const sig of limitedSignatures) {
      try {
        const tx = await rateLimitedRequest(() =>
          connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          })
        );
        txResults.push(tx);
      } catch (err) {
        console.error('Error fetching transaction:', err);
        txResults.push(null);
      }
    }

    // Parse all transactions
    const transactions: Transaction[] = [];
    for (const tx of txResults) {
      if (tx && tx.meta && !tx.meta.err) {
        const parsedTx = parseTransaction(tx, address);
        if (parsedTx) {
          transactions.push(parsedTx);
        }
      }
    }

    // Cache the results
    txCache.set(address, { transactions, timestamp: Date.now() });
    isFetchingTx = false;

    logger.log(`Fetched ${transactions.length} transactions`);
    return transactions;
  } catch (error) {
    console.error('Failed to get transactions:', error);
    isFetchingTx = false;
    // Return cached data if available, even if expired
    const cached = txCache.get(address);
    return cached?.transactions || [];
  }
};

// Parse a Solana transaction into our Transaction type
function parseTransaction(
  tx: ParsedTransactionWithMeta,
  walletAddress: string
): Transaction | null {
  try {
    const signature = tx.transaction.signatures[0];
    const blockTime = tx.blockTime;
    const timestamp = blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString();

    // Check for SOL transfers
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.accountKeys;

    // Find wallet index in account keys
    const walletIndex = accountKeys.findIndex(
      (key) => key.pubkey.toString() === walletAddress
    );

    if (walletIndex === -1) {
      logger.log(`[parseTransaction] Wallet ${walletAddress.slice(0, 8)}... not found in tx ${signature.slice(0, 8)}...`);
      return null;
    }

    const preBalance = preBalances[walletIndex] || 0;
    const postBalance = postBalances[walletIndex] || 0;
    const solChange = (postBalance - preBalance) / LAMPORTS_PER_SOL;

    logger.log(`[parseTransaction] TX ${signature.slice(0, 8)}... SOL change: ${solChange.toFixed(6)}`);

    // Check for token (USDC) changes
    const tokenBalances = tx.meta?.postTokenBalances || [];
    const preTokenBalances = tx.meta?.preTokenBalances || [];

    let usdcChange = 0;

    // Method 1: Check postTokenBalances for wallet as owner
    for (const postToken of tokenBalances) {
      if (postToken.mint === USDC_MINT && postToken.owner === walletAddress) {
        const preToken = preTokenBalances.find(
          (t) => t.accountIndex === postToken.accountIndex && t.mint === USDC_MINT
        );
        const postAmount = postToken.uiTokenAmount?.uiAmount || 0;
        const preAmount = preToken?.uiTokenAmount?.uiAmount || 0;
        usdcChange = postAmount - preAmount;
        logger.log(`[parseTransaction] USDC change (method 1): ${usdcChange}, post: ${postAmount}, pre: ${preAmount}`);
        break;
      }
    }

    // Method 2: Check preTokenBalances for USDC that might have been fully spent
    if (usdcChange === 0) {
      for (const preToken of preTokenBalances) {
        if (preToken.mint === USDC_MINT && preToken.owner === walletAddress) {
          const postToken = tokenBalances.find(
            (t) => t.accountIndex === preToken.accountIndex && t.mint === USDC_MINT
          );
          const preAmount = preToken.uiTokenAmount?.uiAmount || 0;
          const postAmount = postToken?.uiTokenAmount?.uiAmount || 0;
          usdcChange = postAmount - preAmount;
          logger.log(`[parseTransaction] USDC change (method 2): ${usdcChange}, post: ${postAmount}, pre: ${preAmount}`);
          break;
        }
      }
    }

    // Method 3: Check by account index matching (for cases where owner field might be different)
    // This handles edge cases where the token account belongs to the wallet but owner field uses ATA address
    if (usdcChange === 0) {
      // Find all USDC token changes in this transaction
      for (let i = 0; i < tokenBalances.length; i++) {
        const postToken = tokenBalances[i];
        if (postToken.mint === USDC_MINT) {
          const preToken = preTokenBalances.find(
            (t) => t.accountIndex === postToken.accountIndex && t.mint === USDC_MINT
          );
          const postAmount = postToken.uiTokenAmount?.uiAmount || 0;
          const preAmount = preToken?.uiTokenAmount?.uiAmount || 0;
          const change = postAmount - preAmount;

          // Check if this account is associated with our wallet
          // The accountIndex corresponds to an account in accountKeys
          const accountIndex = postToken.accountIndex;
          if (accountIndex < accountKeys.length && change !== 0) {
            logger.log(`[parseTransaction] USDC change (method 3): ${change} at index ${accountIndex}, owner: ${postToken.owner?.slice(0, 8) || 'unknown'}`);
            // Check if this is our token account by looking at the owner or if wallet appears in tx
            if (postToken.owner === walletAddress ||
                accountKeys.some(k => k.pubkey.toString() === walletAddress)) {
              usdcChange = change;
              break;
            }
          }
        }
      }
    }

    logger.log(`[parseTransaction] Final: SOL=${solChange.toFixed(6)}, USDC=${usdcChange.toFixed(2)}`);

    // Debug: log all token balances for troubleshooting
    if (tokenBalances.length > 0 || preTokenBalances.length > 0) {
      logger.log(`[parseTransaction] Token balances: pre=${preTokenBalances.length}, post=${tokenBalances.length}`);
      tokenBalances.forEach((tb, i) => {
        if (tb.mint === USDC_MINT) {
          logger.log(`[parseTransaction] Post USDC #${i}: owner=${tb.owner?.slice(0, 8)}, amount=${tb.uiTokenAmount?.uiAmount}`);
        }
      });
    }

    // Try to find the counterparty
    let counterparty = 'Unknown';
    if (accountKeys.length > 1) {
      const otherKey = accountKeys.find(
        (key) => key.pubkey.toString() !== walletAddress
      );
      if (otherKey) {
        counterparty = otherKey.pubkey.toString();
      }
    }

    // Detect SWAP: SOL goes down, USDC goes up (or vice versa)
    const isSwap = (solChange < -0.001 && usdcChange > 0.01) ||
                   (solChange > 0.001 && usdcChange < -0.01);

    if (isSwap) {
      // SOL -> USDC swap
      if (solChange < 0 && usdcChange > 0) {
        logger.log(`[parseTransaction] Detected SWAP: SOL -> USDC`);
        return {
          id: signature,
          type: 'swap',
          amount: usdcChange,
          currency: 'USDC',
          from_address: walletAddress,
          to_address: counterparty,
          tx_hash: signature,
          status: 'completed',
          created_at: timestamp,
          swapFromAmount: Math.abs(solChange),
          swapFromCurrency: 'SOL',
          swapToAmount: usdcChange,
          swapToCurrency: 'USDC',
          description: `Swapped ${Math.abs(solChange).toFixed(4)} SOL for ${usdcChange.toFixed(2)} USDC`,
        };
      }
      // USDC -> SOL swap
      if (usdcChange < 0 && solChange > 0) {
        logger.log(`[parseTransaction] Detected SWAP: USDC -> SOL`);
        return {
          id: signature,
          type: 'swap',
          amount: solChange,
          currency: 'SOL',
          from_address: walletAddress,
          to_address: counterparty,
          tx_hash: signature,
          status: 'completed',
          created_at: timestamp,
          swapFromAmount: Math.abs(usdcChange),
          swapFromCurrency: 'USDC',
          swapToAmount: solChange,
          swapToCurrency: 'SOL',
          description: `Swapped ${Math.abs(usdcChange).toFixed(2)} USDC for ${solChange.toFixed(4)} SOL`,
        };
      }
    }

    // Pure USDC transaction (no significant SOL change except fees)
    if (Math.abs(usdcChange) > 0.01 && Math.abs(solChange) < 0.01) {
      const txType = usdcChange > 0 ? 'receive' : 'send';
      logger.log(`[parseTransaction] Detected USDC ${txType}: ${usdcChange.toFixed(2)} USDC`);
      return {
        id: signature,
        type: txType,
        amount: Math.abs(usdcChange),
        currency: 'USDC',
        from_address: usdcChange > 0 ? counterparty : walletAddress,
        to_address: usdcChange > 0 ? walletAddress : counterparty,
        tx_hash: signature,
        status: 'completed',
        created_at: timestamp,
      };
    }

    // Pure SOL transaction
    if (Math.abs(solChange) > 0.0001) {
      const txType = solChange > 0 ? 'receive' : 'send';
      logger.log(`[parseTransaction] Detected SOL ${txType}: ${solChange.toFixed(6)} SOL`);
      return {
        id: signature,
        type: txType,
        amount: Math.abs(solChange),
        currency: 'SOL',
        from_address: solChange > 0 ? counterparty : walletAddress,
        to_address: solChange > 0 ? walletAddress : counterparty,
        tx_hash: signature,
        status: 'completed',
        created_at: timestamp,
      };
    }

    logger.log(`[parseTransaction] No significant balance change detected for tx ${signature.slice(0, 8)}...`);
    return null;
  } catch (error) {
    console.error('Error parsing transaction:', error);
    return null;
  }
}

/**
 * Validate a Solana address format
 * 
 * @param address - String to validate as a Solana address
 * @returns True if address is valid base58 Solana address, false otherwise
 */
export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Shorten address for display
export const shortenAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

// Get connection instance for external use
export const getConnection = () => connection;
