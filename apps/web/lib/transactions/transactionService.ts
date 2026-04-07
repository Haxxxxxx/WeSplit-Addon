/**
 * USDC Transaction Service — Web
 *
 * Handles balance checks, USDC transfers, and Firestore recording.
 * Uses the wallet adapter's signTransaction — no private keys on the client.
 *
 * Transaction Safety:
 * - Idempotency: Prevents duplicate transactions across browser sessions (localStorage)
 * - Deduplication: Prevents concurrent in-flight duplicates (in-memory)
 * - User send lock: Serializes concurrent sends from the same user
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { awardTransactionPoints } from '@/lib/firebase/queries';
import { createConnection, getNetwork } from '@/lib/solana';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  idempotencyService,
  generateIdempotencyKey,
} from '@/lib/services/idempotencyService';
import {
  checkAndRegisterInFlight,
  acquireUserSendLock,
} from '@/lib/services/transactionDeduplication';

// ---------------------------------------------------------------------------
// Constants — mirrored from shared/config
// ---------------------------------------------------------------------------

const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_DECIMALS = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getUSDCMint(): PublicKey {
  const network = getNetwork();
  const mint =
    network === WalletAdapterNetwork.Mainnet
      ? USDC_MINT_MAINNET
      : USDC_MINT_DEVNET;
  return new PublicKey(mint);
}

export function isDevnet(): boolean {
  return getNetwork() !== WalletAdapterNetwork.Mainnet;
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export async function getUSDCBalance(
  connection: Connection,
  walletAddress: string,
): Promise<number> {
  try {
    const owner = new PublicKey(walletAddress);
    const mint = getUSDCMint();
    const ata = await getAssociatedTokenAddress(mint, owner);
    const account = await getAccount(connection, ata);
    return Number(account.amount) / 10 ** USDC_DECIMALS;
  } catch {
    // Account doesn't exist or has no balance
    return 0;
  }
}

export async function getSOLBalance(
  connection: Connection,
  walletAddress: string,
): Promise<number> {
  try {
    const balance = await connection.getBalance(new PublicKey(walletAddress));
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Build USDC transfer instruction
// ---------------------------------------------------------------------------

export async function buildUSDCTransferInstruction(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  amountUsdc: number,
): Promise<Transaction> {
  const mint = getUSDCMint();
  const fromAta = await getAssociatedTokenAddress(mint, from);
  const toAta = await getAssociatedTokenAddress(mint, to);

  const tx = new Transaction();

  // Create recipient ATA if it doesn't exist
  try {
    await getAccount(connection, toAta);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        from, // payer
        toAta,
        to,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  // SPL transfer instruction
  const amountRaw = BigInt(Math.round(amountUsdc * 10 ** USDC_DECIMALS));
  tx.add(
    createTransferInstruction(
      fromAta,
      toAta,
      from,
      amountRaw,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  return tx;
}

// ---------------------------------------------------------------------------
// Send USDC — orchestrator
// ---------------------------------------------------------------------------

export interface SendUSDCParams {
  connection: Connection;
  fromPubkey: PublicKey;
  toAddress: string;
  amountUsdc: number;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  note?: string;
  senderName?: string;
  recipientName?: string;
  recipientUid?: string;
  senderUid?: string;
  /** Optional idempotency key for duplicate prevention. If not provided, one is auto-generated. */
  idempotencyKey?: string;
  /** Transaction type recorded in Firestore — defaults to 'send' */
  transactionType?: 'send' | 'withdraw';
  /** Source platform — defaults to 'web_wallet_adapter' */
  transactionMethod?: 'web_wallet_adapter' | 'telegram_wallet';
}

export interface SendUSDCResult {
  txId: string;
  amount: number;
  currency: string;
}

export async function sendUSDC(params: SendUSDCParams): Promise<SendUSDCResult> {
  const {
    connection,
    fromPubkey,
    toAddress,
    amountUsdc,
    signTransaction,
    note,
    senderName,
    recipientName,
    recipientUid,
    senderUid,
    idempotencyKey: providedKey,
    transactionType,
    transactionMethod,
  } = params;

  const fromAddress = fromPubkey.toBase58();

  // Generate or use provided idempotency key
  const idemKey =
    providedKey ||
    generateIdempotencyKey({
      userId: senderUid || fromAddress,
      context: 'send_usdc',
      amount: amountUsdc,
      recipientAddress: toAddress,
    });

  // 1. Check idempotency — return cached result if tx already completed
  const cachedResult = idempotencyService.check(idemKey);
  if (cachedResult) {
    if (process.env.NODE_ENV !== 'production') console.log('[sendUSDC] Idempotency hit — returning cached tx');
    return {
      txId: cachedResult.signature,
      amount: amountUsdc,
      currency: 'USDC',
    };
  }

  // 2. Acquire per-user send lock (serializes concurrent sends)
  const releaseLock = await acquireUserSendLock(senderUid || fromAddress);

  // Create promise for dedup registration
  let resolveTx: (result: SendUSDCResult) => void;
  let rejectTx: (error: Error) => void;
  const txPromise = new Promise<SendUSDCResult>((resolve, reject) => {
    resolveTx = resolve;
    rejectTx = reject;
  });

  // 3. Check-and-register in-flight dedup
  const { existing, cleanup } = checkAndRegisterInFlight(
    senderUid || fromAddress,
    toAddress,
    amountUsdc,
    txPromise
  );

  if (existing) {
    // Another identical tx is already in-flight — wait for it
    releaseLock();
    if (process.env.NODE_ENV !== 'production') console.log('[sendUSDC] Duplicate in-flight detected — waiting for existing tx');
    return existing as Promise<SendUSDCResult>;
  }

  // 4. Reserve idempotency key before executing
  idempotencyService.reserve(idemKey);

  try {
    const toPubkey = new PublicKey(toAddress);

    // Build transaction
    const tx = await buildUSDCTransferInstruction(
      connection,
      fromPubkey,
      toPubkey,
      amountUsdc,
    );

    // Set recent blockhash + fee payer
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    // Sign via wallet adapter (user approves in wallet popup)
    const signedTx = await signTransaction(tx);

    // Send raw transaction
    const txId = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    await connection.confirmTransaction(
      { signature: txId, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    // Mark idempotency as completed
    idempotencyService.markCompleted(idemKey, txId);

    // Record in Firestore
    if (senderUid) {
      await recordTransaction({
        txId,
        fromWallet: fromAddress,
        toWallet: toAddress,
        amount: amountUsdc,
        currency: 'USDC',
        senderUid,
        senderName,
        recipientName,
        recipientUid,
        note,
        idempotencyKey: idemKey,
        transactionType,
        transactionMethod,
      });
    }

    const result = { txId, amount: amountUsdc, currency: 'USDC' };
    resolveTx!(result);
    return result;
  } catch (error) {
    // Mark idempotency as failed — allows retry
    idempotencyService.markFailed(idemKey);
    rejectTx!(error as Error);
    throw error;
  } finally {
    cleanup();
    releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Send SOL — orchestrator
// ---------------------------------------------------------------------------

export interface SendSOLParams {
  connection: Connection;
  fromPubkey: PublicKey;
  toAddress: string;
  amountSol: number;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  note?: string;
  senderName?: string;
  recipientName?: string;
  recipientUid?: string;
  senderUid?: string;
  /** Optional idempotency key for duplicate prevention. If not provided, one is auto-generated. */
  idempotencyKey?: string;
  /** Transaction type recorded in Firestore — defaults to 'send' */
  transactionType?: 'send' | 'withdraw';
  /** Source platform — defaults to 'web_wallet_adapter' */
  transactionMethod?: 'web_wallet_adapter' | 'telegram_wallet';
}

export interface SendSOLResult {
  txId: string;
  amount: number;
  currency: string;
}

export async function sendSOL(params: SendSOLParams): Promise<SendSOLResult> {
  const {
    connection,
    fromPubkey,
    toAddress,
    amountSol,
    signTransaction,
    note,
    senderName,
    recipientName,
    recipientUid,
    senderUid,
    idempotencyKey: providedKey,
    transactionType,
    transactionMethod,
  } = params;

  const fromAddress = fromPubkey.toBase58();

  // Generate or use provided idempotency key
  const idemKey =
    providedKey ||
    generateIdempotencyKey({
      userId: senderUid || fromAddress,
      context: 'send_sol',
      amount: amountSol,
      recipientAddress: toAddress,
    });

  // 1. Check idempotency — return cached result if tx already completed
  const cachedResult = idempotencyService.check(idemKey);
  if (cachedResult) {
    if (process.env.NODE_ENV !== 'production') console.log('[sendSOL] Idempotency hit — returning cached tx');
    return {
      txId: cachedResult.signature,
      amount: amountSol,
      currency: 'SOL',
    };
  }

  // 2. Acquire per-user send lock (serializes concurrent sends)
  const releaseLock = await acquireUserSendLock(senderUid || fromAddress);

  // Create promise for dedup registration
  let resolveTx: (result: SendSOLResult) => void;
  let rejectTx: (error: Error) => void;
  const txPromise = new Promise<SendSOLResult>((resolve, reject) => {
    resolveTx = resolve;
    rejectTx = reject;
  });

  // 3. Check-and-register in-flight dedup
  const { existing, cleanup } = checkAndRegisterInFlight(
    senderUid || fromAddress,
    toAddress,
    amountSol,
    txPromise
  );

  if (existing) {
    // Another identical tx is already in-flight — wait for it
    releaseLock();
    if (process.env.NODE_ENV !== 'production') console.log('[sendSOL] Duplicate in-flight detected — waiting for existing tx');
    return existing as Promise<SendSOLResult>;
  }

  // 4. Reserve idempotency key before executing
  idempotencyService.reserve(idemKey);

  try {
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      }),
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = fromPubkey;

    const signedTx = await signTransaction(tx);

    const txId = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(
      { signature: txId, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    // Mark idempotency as completed
    idempotencyService.markCompleted(idemKey, txId);

    if (senderUid) {
      await recordTransaction({
        txId,
        fromWallet: fromAddress,
        toWallet: toAddress,
        amount: amountSol,
        currency: 'SOL',
        senderUid,
        senderName,
        recipientName,
        recipientUid,
        note,
        idempotencyKey: idemKey,
        transactionType,
        transactionMethod,
      });
    }

    const result = { txId, amount: amountSol, currency: 'SOL' };
    resolveTx!(result);
    return result;
  } catch (error) {
    // Mark idempotency as failed — allows retry
    idempotencyService.markFailed(idemKey);
    rejectTx!(error as Error);
    throw error;
  } finally {
    cleanup();
    releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Record transaction in Firestore (matching mobile app schema)
// ---------------------------------------------------------------------------

interface RecordTransactionParams {
  txId: string;
  fromWallet: string;
  toWallet: string;
  amount: number;
  currency: string;
  senderUid: string;
  senderName?: string;
  recipientName?: string;
  recipientUid?: string;
  note?: string;
  idempotencyKey?: string;
  /** Transaction type — defaults to 'send' */
  transactionType?: 'send' | 'withdraw';
  /** Source platform — defaults to 'web_wallet_adapter' */
  transactionMethod?: 'web_wallet_adapter' | 'telegram_wallet';
}

async function recordTransaction(params: RecordTransactionParams) {
  try {
    const txDoc = doc(db, 'transactions', params.txId);
    // S3-8: 'web_wallet_adapter' is intentional — distinguishes web from mobile's 'wallet_adapter'
    const method = params.transactionMethod ?? 'web_wallet_adapter';
    const recipientUid = params.recipientUid ?? '';
    await setDoc(txDoc, {
      id: params.txId,
      // snake_case (web convention)
      from_user: params.senderUid,
      to_user: recipientUid,
      from_wallet: params.fromWallet,
      to_wallet: params.toWallet,
      tx_hash: params.txId,
      sender_name: params.senderName ?? '',
      recipient_name: params.recipientName ?? '',
      blockchain_network: isDevnet() ? 'devnet' : 'mainnet-beta',
      transaction_method: method,
      idempotency_key: params.idempotencyKey ?? '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      // camelCase (mobile convention)
      fromUser: params.senderUid,
      toUser: recipientUid,
      fromWallet: params.fromWallet,
      toWallet: params.toWallet,
      txHash: params.txId,
      senderName: params.senderName ?? '',
      recipientName: params.recipientName ?? '',
      blockchainNetwork: isDevnet() ? 'devnet' : 'mainnet-beta',
      transactionMethod: method,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // shared
      type: params.transactionType ?? 'send',
      amount: params.amount,
      currency: params.currency,
      note: params.note ?? '',
      status: 'completed',
      idempotencyKey: params.idempotencyKey ?? '',
    });

    // Award points for completed transaction (non-blocking — don't fail the tx if this errors)
    if (params.transactionType !== 'withdraw') {
      awardTransactionPoints({
        userId: params.senderUid,
        txId: params.txId,
        amount: params.amount,
        currency: params.currency as 'USDC' | 'SOL',
      }).catch((err) => {
        console.warn('[TransactionService] Failed to award points:', err);
      });
    }
  } catch (err) {
    console.error('[TransactionService] Failed to record transaction:', err);
    // Don't throw — the on-chain tx already succeeded
  }
}
