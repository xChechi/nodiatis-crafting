// Inventory-line parser used by the Craftable page. Layered resolution:
// exact name → material-tier shorthand → tier range → gem color → fuzzy.
// Each strategy is a pure function over a string; the orchestrator
// (parseInventoryLine, added in Task 5) tries them in order.
//
// Sources items from `clientIndex` (slim, ~600 KB) rather than `./data`
// (full DB with recipes, ~4 MB). The parser only needs Name + Type, both
// of which are in the slim index — so this file is safe to import from
// client bundles. Server actions (which DO need recipes) call into
// `./data` separately for the recipe walk.

import Fuse from "fuse.js";
import {
  allIndexedItems,
  getIndexedItemByName,
  type IndexedItem,
} from "./clientIndex";

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

// clientIndex preserves the raw `Resource (X Tier N)` Type string. We parse
// the tier out of the Type itself rather than relying on IndexedItem.tier
// (which is extracted from item NAME's `(T<n>)` suffix and never set for
// resources, since resource names don't carry that suffix).
const RESOURCE_TIER_RE = /^Resource \((.+?)\s+Tier\s+(\d+)\)$/;

/** Look up a tiered material item by canonical type name and tier. */
function findMaterial(typeName: string, tier: number): IndexedItem | null {
  const wantType = `Resource (${typeName} Tier ${tier})`;
  return allIndexedItems().find((i) => i.Type === wantType) ?? null;
}

/** Names of the tiered material types (those whose Type carries a Tier N
 *  suffix), longest first so multi-word types win the disambiguation. */
let _tieredTypes: string[] | null = null;
function tieredTypesByLengthDesc(): string[] {
  if (_tieredTypes) return _tieredTypes;
  const seen = new Set<string>();
  for (const it of allIndexedItems()) {
    const m = it.Type.match(RESOURCE_TIER_RE);
    if (!m) continue;
    seen.add(m[1]);
  }
  _tieredTypes = Array.from(seen).sort((a, b) => b.length - a.length);
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
export function parseMaterialShorthand(input: string): IndexedItem | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);

  // Helper: try parsing tokens [a..b) as the tier and [c..d) as the type.
  const tryRanges = (
    tierStart: number,
    tierEnd: number,
    typeStart: number,
    typeEnd: number,
  ): IndexedItem | null => {
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
export function parseRangeShorthand(input: string): IndexedItem[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);

  const tryRanges = (
    rangeStart: number,
    rangeEnd: number,
    typeStart: number,
    typeEnd: number,
  ): IndexedItem[] | null => {
    const rangeStr = tokens.slice(rangeStart, rangeEnd).join(" ");
    const typeStr = tokens.slice(typeStart, typeEnd).join(" ");
    const range = readTierRange(rangeStr);
    if (!range) return null;
    const typeName = matchTieredType(typeStr);
    if (!typeName) return null;
    const out: IndexedItem[] = [];
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
export function parseGemColorShorthand(input: string): IndexedItem[] | null {
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

  const all = allIndexedItems().filter((i) => i.Type === `Gem (${colorMatch})`);
  if (rank === null) return all.length > 0 ? all : null;
  const filtered = all.filter((i) =>
    i.Name.match(new RegExp(`\\sRank\\s+${rank}$`, "i")),
  );
  return filtered.length > 0 ? filtered : null;
}

// Tightened from 0.35 → 0.2 per audit T14: at 0.35 a typo could land on a
// completely unintended item (e.g. "thorned" → "Throwing Stone Rank 1"). 0.2
// still catches normal typos but rejects wild guesses.
const FUZZY_THRESHOLD = 0.2;
let _fuse: Fuse<IndexedItem> | null = null;

function getFuse(): Fuse<IndexedItem> {
  if (_fuse) return _fuse;
  _fuse = new Fuse(allIndexedItems(), {
    keys: ["Name"],
    threshold: FUZZY_THRESHOLD,
    distance: 100,
    ignoreLocation: true,
    includeScore: true,
  });
  return _fuse;
}

/**
 * Fuzzy-match a query against all item names. Returns the top result above
 * the FUZZY_THRESHOLD, or null. Auto-pick semantics: ambiguous queries
 * silently take the best score.
 */
export function fuzzyResolve(query: string): IndexedItem | null {
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

  const wrap = (items: IndexedItem[]): InventoryEntry[] =>
    items.map((it) => ({ name: it.Name, qty: finalQty }));

  // 1. Exact name match — try the O(1) byName map first, fall back to a
  // case-insensitive scan so users typing "iron ore" still match "Iron Ore".
  const byName = getIndexedItemByName(name);
  if (byName) return { entries: wrap([byName]) };
  const lower = name.toLowerCase();
  const exact = allIndexedItems().find((i) => i.Name.toLowerCase() === lower);
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

  // 5. Fuzzy fallback — surface a warning so the user knows we guessed
  const fuzzy = fuzzyResolve(name);
  if (fuzzy) {
    return {
      entries: wrap([fuzzy]),
      warning:
        fuzzy.Name.toLowerCase() !== name.toLowerCase()
          ? `Matched "${name}" as "${fuzzy.Name}"`
          : undefined,
    };
  }

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

const MAX_SUGGESTIONS = 5;

/**
 * Produce up to 5 suggestion strings for the given partial input. Suggestions
 * are strings the user can accept to replace the active line.
 *
 * Order:
 *   1. Material-tier exact prefix matches ("t30 d" → "t30 Dye", "t30 Dust", ...)
 *   2. Tier-only prefix ("t5" → "t5 Bone", "t5 Cloth", ... up to 5)
 *   3. Gem color prefix matches
 *   4. Fuzzy literal item name matches
 */
export function generateSuggestions(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    if (out.length >= MAX_SUGGESTIONS) return;
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  // Strategy 1: tier + partial type (e.g. "t30 d" → "t30 Dye", "t30 Dust")
  const tierPrefixMatch = trimmed.match(/^([Tt]\d+|[Tt]ier\s+\d+)\s+(.+)$/);
  if (tierPrefixMatch) {
    const tierStr = tierPrefixMatch[1];
    const tier = readTier(tierStr);
    const typePrefix = tierPrefixMatch[2].toLowerCase().trim();
    if (tier !== null) {
      const types = tieredTypesByLengthDesc();
      for (const t of types) {
        if (t.toLowerCase().startsWith(typePrefix)) {
          push(`${tierStr} ${t}`);
        }
      }
    }
  }

  // Strategy 2: tier alone ("t5" with no type yet)
  const tierAlone = trimmed.match(/^([Tt]\d+|[Tt]ier\s+\d+)$/);
  if (tierAlone) {
    const tierStr = tierAlone[1];
    for (const t of tieredTypesByLengthDesc()) push(`${tierStr} ${t}`);
  }

  // Strategy 3: gem-color prefix
  const lower = trimmed.toLowerCase();
  for (const c of GEM_COLORS) {
    if (c.toLowerCase().startsWith(lower) || lower.startsWith(c.toLowerCase())) {
      push(`${c} gem`);
    }
  }

  // Strategy 4: fuzzy literal-name suggestions
  const fuse = getFuse();
  const fuzzyResults = fuse.search(trimmed, { limit: MAX_SUGGESTIONS });
  for (const r of fuzzyResults) push(r.item.Name);

  return out.slice(0, MAX_SUGGESTIONS);
}
