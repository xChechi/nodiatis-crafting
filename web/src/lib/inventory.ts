// Inventory-line parser used by the Craftable page. Layered resolution:
// exact name → material-tier shorthand → tier range → gem color → fuzzy.
// Each strategy is a pure function over a string; the orchestrator
// (parseInventoryLine, added in Task 5) tries them in order.

import Fuse from "fuse.js";
import { allItems, allMaterialTypes } from "./data";
import type { Item } from "./types";

const TIER_RE = /^[Tt](\d+)$/;
const TIER_WORD_RE = /^[Tt]ier\s+(\d+)$/i;
const TIER_RANGE_RE = /^[Tt](\d+)-(\d+)$/;
const TIER_WORD_RANGE_RE = /^[Tt]ier\s+(\d+)-(\d+)$/i;

/** Extract a tier number from a token like "T30" or "tier 30" (full string). */
function readTier(s: string): number | null {
  const m = s.match(TIER_RE) ?? s.match(TIER_WORD_RE);
  return m ? parseInt(m[1], 10) : null;
}

/** Extract a tier range from a token like "T1-30" or "tier 5-7" (full string). */
function readTierRange(s: string): { lo: number; hi: number } | null {
  const m = s.match(TIER_RANGE_RE) ?? s.match(TIER_WORD_RANGE_RE);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = parseInt(m[2], 10);
  if (lo > hi || lo < 1 || hi > 30) return null;
  return { lo, hi };
}

/** Look up a tiered material item by canonical type name and tier. */
function findMaterial(typeName: string, tier: number): Item | null {
  return (
    allItems().find((i) => i.Type === `Resource (${typeName} Tier ${tier})`) ??
    null
  );
}

/** Names of the 22 tiered material types, lowercase, longest first. */
let _tieredTypes: string[] | null = null;
function tieredTypesByLengthDesc(): string[] {
  if (_tieredTypes) return _tieredTypes;
  _tieredTypes = allMaterialTypes()
    .filter((t) => t.tierRange !== null)
    .map((t) => t.name)
    .sort((a, b) => b.length - a.length);
  return _tieredTypes;
}

/** Match the type name (case-insensitive, plural-tolerant) and return the canonical name. */
function matchTieredType(input: string): string | null {
  const normalised = input.trim().toLowerCase();
  const types = tieredTypesByLengthDesc();
  // Exact (singular) match first.
  for (const t of types) {
    if (t.toLowerCase() === normalised) return t;
  }
  // Plural: strip trailing 's' and retry.
  if (normalised.endsWith("s") && normalised.length > 1) {
    const singular = normalised.slice(0, -1);
    for (const t of types) {
      if (t.toLowerCase() === singular) return t;
    }
  }
  return null;
}

/**
 * Recognise material-tier shorthand. Examples that resolve:
 *   "t30 dye", "T1 ore", "tier 5 bone", "dye t30", "ore T1", "bone tier 5",
 *   "t1 bones" (plural).
 * Bare-number prefix ("30 dye") is intentionally NOT recognised — it conflicts
 * with the qty-prefix parsing upstream.
 */
export function parseMaterialShorthand(input: string): Item | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);

  // Helper: try parsing tokens [a..b) as the tier and [c..d) as the type.
  const tryRanges = (
    tierStart: number,
    tierEnd: number,
    typeStart: number,
    typeEnd: number,
  ): Item | null => {
    const tierStr = tokens.slice(tierStart, tierEnd).join(" ");
    const typeStr = tokens.slice(typeStart, typeEnd).join(" ");
    const tier = readTier(tierStr);
    if (tier === null) return null;
    const typeName = matchTieredType(typeStr);
    if (!typeName) return null;
    return findMaterial(typeName, tier);
  };

  // Two-token: "T30 dye" or "dye T30"
  if (tokens.length === 2) {
    return tryRanges(0, 1, 1, 2) ?? tryRanges(1, 2, 0, 1);
  }
  // Three-token: "tier 5 dye" / "dye tier 5"
  if (tokens.length === 3) {
    return tryRanges(0, 2, 2, 3) ?? tryRanges(1, 3, 0, 1);
  }
  // Four-token: "tier 5 armor essence" / "armor essence tier 5"
  if (tokens.length === 4) {
    return tryRanges(0, 2, 2, 4) ?? tryRanges(2, 4, 0, 2);
  }
  return null;
}

/**
 * Recognise tier-range shorthand. Examples:
 *   "t1-30 dye"        → 30 items (T1..T30 Dye)
 *   "tier 5-7 bone"    → 3 items
 *   "dye t1-3"         → 3 items (reversed order)
 * Inverted ranges (lo > hi) and unknown types return null.
 */
export function parseRangeShorthand(input: string): Item[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);

  const tryRanges = (
    rangeStart: number,
    rangeEnd: number,
    typeStart: number,
    typeEnd: number,
  ): Item[] | null => {
    const rangeStr = tokens.slice(rangeStart, rangeEnd).join(" ");
    const typeStr = tokens.slice(typeStart, typeEnd).join(" ");
    const range = readTierRange(rangeStr);
    if (!range) return null;
    const typeName = matchTieredType(typeStr);
    if (!typeName) return null;
    const out: Item[] = [];
    for (let t = range.lo; t <= range.hi; t++) {
      const it = findMaterial(typeName, t);
      if (it) out.push(it);
    }
    return out.length > 0 ? out : null;
  };

  if (tokens.length === 2) {
    return tryRanges(0, 1, 1, 2) ?? tryRanges(1, 2, 0, 1);
  }
  if (tokens.length === 3) {
    return tryRanges(0, 2, 2, 3) ?? tryRanges(1, 3, 0, 1);
  }
  return null;
}

const GEM_COLORS = ["Black", "Blue", "Green", "Grey", "Red", "White"] as const;
const GEM_TOKEN_RE = /^gems?$/i;

/**
 * Recognise gem-color shorthand. Examples:
 *   "red gem"          → all red gems, all ranks
 *   "red t5 gem"       → all red gems at rank 5
 *   "blue tier 3 gem"  → all blue gems at rank 3
 *   "black gems"       → plural ok
 * Requires the trailing "gem"/"gems" token.
 */
export function parseGemColorShorthand(input: string): Item[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  // Last token must be "gem" or "gems".
  if (!GEM_TOKEN_RE.test(tokens[tokens.length - 1])) return null;
  const inner = tokens.slice(0, -1);

  // First token must be a color (case-insensitive).
  const colorMatch = GEM_COLORS.find(
    (c) => c.toLowerCase() === inner[0].toLowerCase(),
  );
  if (!colorMatch) return null;

  // Optional rank: remaining tokens form a tier expression ("t5" or "tier 5").
  let rank: number | null = null;
  if (inner.length > 1) {
    const rankStr = inner.slice(1).join(" ");
    rank = readTier(rankStr);
    if (rank === null) return null;
  }

  const all = allItems().filter((i) => i.Type === `Gem (${colorMatch})`);
  if (rank === null) return all.length > 0 ? all : null;
  const filtered = all.filter((i) =>
    i.Name.match(new RegExp(`\\sRank\\s+${rank}$`, "i")),
  );
  return filtered.length > 0 ? filtered : null;
}

const FUZZY_THRESHOLD = 0.35;
let _fuse: Fuse<Item> | null = null;

function getFuse(): Fuse<Item> {
  if (_fuse) return _fuse;
  _fuse = new Fuse(allItems(), {
    keys: ["Name"],
    threshold: FUZZY_THRESHOLD,
    distance: 100,
    ignoreLocation: true,
  });
  return _fuse;
}

/**
 * Fuzzy-match a query against all item names. Returns the top result above
 * the FUZZY_THRESHOLD, or null. Auto-pick semantics: ambiguous queries
 * silently take the best score.
 */
export function fuzzyResolve(query: string): Item | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const results = getFuse().search(trimmed, { limit: 1 });
  return results.length > 0 ? results[0].item : null;
}

export interface InventoryEntry {
  /** Canonical item name. */
  name: string;
  /** Quantity. `Infinity` means "unbounded" — user has at least the recipe asks. */
  qty: number;
}

/**
 * Extract optional qty from a line and return { name, qty | null }.
 * Supports "name: qty", "qty name", "name qty". If no qty is found, returns
 * the full input as `name` with qty=null.
 */
function splitQty(line: string): { name: string; qty: number | null } {
  const trimmed = line.trim();

  const colon = trimmed.match(/^(.+?)\s*:\s*(\d+)\s*$/);
  if (colon) return { name: colon[1].trim(), qty: parseInt(colon[2], 10) };

  const leading = trimmed.match(/^(\d+)\s+(.+)$/);
  if (leading) return { name: leading[2].trim(), qty: parseInt(leading[1], 10) };

  const trailing = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (trailing) return { name: trailing[1].trim(), qty: parseInt(trailing[2], 10) };

  return { name: trimmed, qty: null };
}

/**
 * Resolve a single line. Tries strategies in order:
 *   1. Exact name (case-insensitive)
 *   2. Material-tier shorthand
 *   3. Tier-range shorthand
 *   4. Gem color shorthand
 *   5. Fuzzy fallback
 * Returns 0+ entries with the line's qty (or Infinity if not specified).
 * If no strategy matches, returns a `warning` describing the unrecognised input.
 */
export function parseInventoryLine(line: string): {
  entries: InventoryEntry[];
  warning?: string;
} {
  const { name, qty } = splitQty(line);
  if (!name) return { entries: [] };
  const finalQty = qty ?? Infinity;

  const wrap = (items: Item[]): InventoryEntry[] =>
    items.map((it) => ({ name: it.Name, qty: finalQty }));

  // 1. Exact name match (case-insensitive)
  const exact = allItems().find(
    (i) => i.Name.toLowerCase() === name.toLowerCase(),
  );
  if (exact) return { entries: wrap([exact]) };

  // 2. Material-tier
  const mat = parseMaterialShorthand(name);
  if (mat) return { entries: wrap([mat]) };

  // 3. Tier-range
  const range = parseRangeShorthand(name);
  if (range) return { entries: wrap(range) };

  // 4. Gem color
  const gems = parseGemColorShorthand(name);
  if (gems) return { entries: wrap(gems) };

  // 5. Fuzzy fallback
  const fuzzy = fuzzyResolve(name);
  if (fuzzy) return { entries: wrap([fuzzy]) };

  return { entries: [], warning: `Unknown item: "${name}"` };
}

/**
 * Parse a full textarea input. Splits on newline AND comma. Lines are
 * resolved independently via parseInventoryLine. Entries with the same
 * canonical name are merged: max qty wins, so Infinity beats any finite.
 */
export function parseInventory(input: string): {
  entries: InventoryEntry[];
  warnings: string[];
} {
  const lines = input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = new Map<string, number>();
  const warnings: string[] = [];

  for (const line of lines) {
    const { entries, warning } = parseInventoryLine(line);
    if (warning) warnings.push(warning);
    for (const e of entries) {
      const prev = merged.get(e.name);
      const next = prev === undefined ? e.qty : Math.max(prev, e.qty);
      merged.set(e.name, next);
    }
  }

  const entries: InventoryEntry[] = [];
  for (const [name, qty] of merged) entries.push({ name, qty });
  return { entries, warnings };
}
