import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { WalletProvider } from '../types';
import {
  getPhantomProvider,
  getSolflareProvider,
  getBackpackProvider,
  getGlowProvider,
  getCoinbaseProvider,
  getTrustProvider,
  getExodusProvider,
  getBraveProvider,
} from './wallet';

// RPC URL must be provided via environment variable
const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL;
if (!RPC_URL) {
  throw new Error('VITE_SOLANA_RPC_URL must be set in environment variables');
}
const connection = new Connection(RPC_URL, 'confirmed');

// USDC Token mint address
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDC_DECIMALS = 6;

// Get the wallet provider based on type
const getProvider = (walletProvider: WalletProvider) => {
  switch (walletProvider) {
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

// Send SOL transaction
export const sendSol = async (
  fromAddress: string,
  toAddress: string,
  amount: number,
  walletProvider: WalletProvider
): Promise<string | null> => {
  try {
    const provider = getProvider(walletProvider);
    if (!provider) throw new Error('Wallet not connected');
    if (!provider.signTransaction) throw new Error('Wallet does not support signing');

    const fromPubkey = new PublicKey(fromAddress);
    const toPubkey = new PublicKey(toAddress);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    const signed = await provider.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());

    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  } catch (error) {
    console.error('Failed to send SOL:', error);
    return null;
  }
};

// Send USDC transaction
export const sendUsdc = async (
  fromAddress: string,
  toAddress: string,
  amount: number,
  walletProvider: WalletProvider
): Promise<string | null> => {
  try {
    const provider = getProvider(walletProvider);
    if (!provider) throw new Error('Wallet not connected');
    if (!provider.signTransaction) throw new Error('Wallet does not support signing');

    const fromPubkey = new PublicKey(fromAddress);
    const toPubkey = new PublicKey(toAddress);

    // Get token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      fromPubkey
    );
    const toTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      toPubkey
    );

    // Create transfer instruction
    const transferInstruction = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      fromPubkey,
      Math.floor(amount * Math.pow(10, USDC_DECIMALS)),
      [],
      TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(transferInstruction);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    const signed = await provider.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());

    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  } catch (error) {
    console.error('Failed to send USDC:', error);
    return null;
  }
};

// Transaction signature type
interface TransactionSignature {
  signature: string;
  slot: number;
  err: unknown;
  blockTime: number | null;
}

// Get recent transactions
export const getRecentTransactions = async (
  address: string,
  limit = 10
): Promise<TransactionSignature[]> => {
  try {
    const publicKey = new PublicKey(address);
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      limit,
    });

    return signatures.map((sig) => ({
      signature: sig.signature,
      slot: sig.slot,
      err: sig.err,
      blockTime: sig.blockTime,
    }));
  } catch (error) {
    console.error('Failed to get transactions:', error);
    return [];
  }
};
