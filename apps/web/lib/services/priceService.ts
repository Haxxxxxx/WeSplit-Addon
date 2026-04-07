import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceData {
  symbol: string;
  price_usd: number;
}

// ---------------------------------------------------------------------------
// Internal cache state — module-level singletons (same pattern as mobile)
// ---------------------------------------------------------------------------

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const priceCache: Record<string, PriceData> = {};
const lastFetchTime: Record<string, number> = {};
const pendingRequests: Record<string, Promise<PriceData | null>> = {};

// ---------------------------------------------------------------------------
// CoinGecko ID mapping
// ---------------------------------------------------------------------------

function getCoinGeckoId(symbol: string): string {
  const coinGeckoIds: Record<string, string> = {
    SOL: 'solana',
    USDT: 'tether',
    BONK: 'bonk',
    RAY: 'raydium',
    ORCA: 'orca',
    JUP: 'jupiter',
    PYTH: 'pyth-network',
    USDC: 'usd-coin',
  };

  return coinGeckoIds[symbol.toUpperCase()] ?? symbol.toLowerCase();
}

// ---------------------------------------------------------------------------
// Core fetch with 3-retry exponential backoff
// ---------------------------------------------------------------------------

async function fetchPriceWithRetry(
  symbol: string,
  retries = 3,
): Promise<PriceData | null> {
  const coinId = getCoinGeckoId(symbol);
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`CoinGecko responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      const priceUsd: number | undefined = data[coinId]?.usd;

      if (priceUsd === undefined || priceUsd === null) {
        throw new Error(`No price field in CoinGecko response for ${symbol}`);
      }

      return { symbol: symbol.toUpperCase(), price_usd: priceUsd };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s …
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt)),
        );
      }
    }
  }

  console.error(
    `[priceService] Failed to fetch price for ${symbol} after ${retries} attempts:`,
    lastError?.message,
  );
  throw new Error(
    `Failed to fetch price for ${symbol} after ${retries} attempts: ${lastError?.message}`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the USD price for any supported crypto symbol.
 *
 * - Returns `null` only when the symbol is unknown or the response contains no
 *   price data (not a network failure — those throw after retries).
 * - Uses a 5-minute in-memory cache and deduplicates concurrent requests for
 *   the same symbol (same behaviour as the mobile priceService).
 */
export async function getCryptoPrice(
  symbol: string,
): Promise<PriceData | null> {
  const key = symbol.toUpperCase();
  const now = Date.now();

  // Return cached value if still fresh
  if (priceCache[key] && now - (lastFetchTime[key] ?? 0) < CACHE_DURATION) {
    return priceCache[key];
  }

  // Deduplicate: if a request for this symbol is already in-flight, wait for it
  if (pendingRequests[key] !== undefined) {
    return pendingRequests[key];
  }

  // Start a new fetch and register it as the pending request
  const requestPromise = (async (): Promise<PriceData | null> => {
    try {
      const result = await fetchPriceWithRetry(key);

      if (result) {
        priceCache[key] = result;
        lastFetchTime[key] = Date.now();
      }

      return result;
    } catch (error) {
      // Log and return null so callers can handle gracefully
      console.warn(
        `[priceService] getCryptoPrice(${key}) failed:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    } finally {
      delete pendingRequests[key];
    }
  })();

  pendingRequests[key] = requestPromise;
  return requestPromise;
}

/**
 * Convenience wrapper — returns the current SOL/USD price or throws if
 * the fetch fails after all retries.
 */
export async function getSOLPrice(): Promise<number> {
  const data = await getCryptoPrice('SOL');

  if (!data) {
    throw new Error('[priceService] Unable to retrieve SOL price');
  }

  return data.price_usd;
}

// ---------------------------------------------------------------------------
// React hook — TanStack Query v5
// ---------------------------------------------------------------------------

/**
 * React hook that subscribes to the SOL/USD price with a 5-minute stale time.
 * Uses TanStack Query so the price is shared across all components that call
 * this hook and is automatically refetched in the background.
 *
 * @example
 * const { data: solPrice, isLoading, error } = useSOLPrice();
 */
export function useSOLPrice() {
  return useQuery<number>({
    queryKey: ['price', 'SOL'],
    queryFn: getSOLPrice,
    staleTime: CACHE_DURATION,       // 5 minutes — matches the in-memory cache
    gcTime: CACHE_DURATION * 2,      // keep in cache for 10 min after unmount
    retry: false,                    // fetchPriceWithRetry already handles retries
    refetchOnWindowFocus: true,
  });
}
