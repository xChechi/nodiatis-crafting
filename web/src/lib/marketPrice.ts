import type { Item } from "./types";

/**
 * Resolve the price to use for cost calculations.
 *
 * Order of precedence:
 *   1. MarketHistory[0] — the most recent monthly ask reading
 *   2. Cost              — the scraped vendor cost (legacy placeholder for items without market data)
 *   3. 0                 — caller is responsible for treating 0 as "unknown"
 */
export function currentMarketPrice(item: Item | null | undefined): number {
  if (!item) return 0;
  const latest = item.MarketHistory?.[0];
  if (typeof latest === "number" && latest > 0) return latest;
  return item.Cost ?? 0;
}
