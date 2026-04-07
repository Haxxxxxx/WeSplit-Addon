/**
 * POST /api/rpc
 *
 * Server-side Solana JSON-RPC proxy.
 * Keeps Helius/Alchemy API keys off the client bundle.
 *
 * The client sends standard JSON-RPC payloads; this route forwards them
 * to the configured RPC endpoint and returns the response.
 *
 * Security:
 *  - Only POST is allowed (JSON-RPC standard)
 *  - Request body must be valid JSON with a `method` field
 *  - Dangerous admin methods are blocked
 *  - No API keys are exposed to the client
 */

import { NextRequest, NextResponse } from 'next/server';

// Server-only RPC URL — NOT prefixed with NEXT_PUBLIC_
const RPC_URL =
  process.env.HELIUS_RPC_URL ??
  process.env.ALCHEMY_RPC_URL ??
  'https://api.mainnet-beta.solana.com';

const DEVNET_RPC_URL =
  process.env.DEVNET_RPC_URL ??
  'https://api.devnet.solana.com';

// Methods that should never be proxied
const BLOCKED_METHODS = new Set([
  'requestAirdrop',       // devnet only, abuse vector
  'simulateTransaction',  // allow — needed for preflight
]);

// Determine which network to use
function getRpcUrl(): string {
  if (process.env.NEXT_PUBLIC_FORCE_MAINNET === 'true' || process.env.NEXT_PUBLIC_NETWORK === 'mainnet-beta') {
    return RPC_URL;
  }
  return DEVNET_RPC_URL;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support single and batch requests
    const isBatch = Array.isArray(body);
    const requests = isBatch ? body : [body];

    // Validate each request in the batch
    for (const req of requests) {
      if (!req.method || typeof req.method !== 'string') {
        return NextResponse.json(
          { error: 'Invalid JSON-RPC request: missing method' },
          { status: 400 },
        );
      }
      if (BLOCKED_METHODS.has(req.method)) {
        return NextResponse.json(
          { error: `Method not allowed: ${req.method}` },
          { status: 403 },
        );
      }
    }

    const rpcUrl = getRpcUrl();

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isBatch ? requests : requests[0]),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[RPC Proxy] Error:', error);
    return NextResponse.json(
      { error: 'RPC proxy error' },
      { status: 502 },
    );
  }
}
