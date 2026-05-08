// Inventory-line parser used by the Craftable page. Layered resolution:
// exact name → material-tier shorthand → tier range → gem color → fuzzy.
// Each strategy is a pure function over a string; the orchestrator
// (parseInventoryLine, added in Task 5) tries them in order.

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
