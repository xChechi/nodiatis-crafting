import historyJson from "@/data/market-history.json";

export interface PriceReading {
  /** ISO month, e.g. "2026-05". */
  month: string;
  /** Ask price in gold at capture time. */
  ask: number;
}

type HistoryLog = Record<string, PriceReading[]>;

// The JSON import is `unknown` at compile time; cast once at the boundary.
const log = historyJson as unknown as HistoryLog;

/** Full history (newest first) for a slug; empty array if no readings exist. */
export function getHistoryForSlug(slug: string): PriceReading[] {
  return log[slug] ?? [];
}

/** Every slug that has at least one reading. Unordered. */
export function getAllSlugsWithHistory(): string[] {
  return Object.keys(log).filter((k) => (log[k]?.length ?? 0) > 0);
}
