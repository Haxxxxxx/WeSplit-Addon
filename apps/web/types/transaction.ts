/**
 * Transaction-related types.
 */

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'deposit' | 'withdraw';
  amount: number;
  currency: string;
  from_user?: string;
  to_user?: string;
  from_wallet: string;
  to_wallet: string;
  tx_hash: string;
  /** Solana transaction signature — alias for tx_hash used in some contexts */
  signature?: string;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at?: string;
  company_fee?: number;
  net_amount?: number;
  gas_fee?: number;
  gas_fee_lamports?: number;
  sol_cost_recovered_usdc?: number;
  blockchain_network?: string;
  confirmation_count?: number;
  block_height?: number;
  recipient_name?: string;
  sender_name?: string;
  group_id?: string;
  transaction_method?: string;
  app_version?: string;
  device_info?: string;
  gas_fee_covered_by_company?: boolean;
  x402_enabled?: boolean;
  x402_validated?: boolean;
  x402_authorized?: boolean;
  x402_authorizationId?: string;
  x402_blocked?: boolean;
  x402_settled?: boolean;
  x402_settleTxId?: string;
  x402_metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// Transaction Summary
// ---------------------------------------------------------------------------

export interface TransactionSummary {
  total_sent: number;
  total_received: number;
  total_amount: number;
}
