// Helpers for the Nodiatis "uptier" item naming convention.
// Items like "Aliangel Chestpiece }I{" are the freshly-craftable base; the
// `}II{`, `}III{`, ... variants are the same item progressively upgraded
// (gives more stats, but cannot be crafted from scratch — only by upgrading
// the previous tier in-game).
//
// We hide non-`}I{` variants from category listings and surface them as a
// sibling list on the base item's detail page.

const UPTIER_RE = /\}([IVX]+)\{/;

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
};

/** Convert a Roman numeral string (uppercase, IVX only) to its integer value. */
export function romanToInt(roman: string): number {
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const cur = ROMAN_VALUES[roman[i]] ?? 0;
    const next = ROMAN_VALUES[roman[i + 1]] ?? 0;
    total += next > cur ? -cur : cur;
  }
  return total;
}

/**
 * Returns the Roman numeral suffix of a name if it's part of an uptier chain,
 * or null. e.g. "Aliangel Chestpiece }II{" -> "II"; "Bone Sword" -> null.
 */
export function getUptierRoman(name: string): string | null {
  const m = name.match(UPTIER_RE);
  return m ? m[1] : null;
}

/**
 * True if the name uses the uptier suffix AND is NOT the }I{ base.
 * These items are hidden from category listings.
 */
export function isUptierVariant(name: string): boolean {
  const r = getUptierRoman(name);
  return r !== null && r !== "I";
}

/**
 * True if the item is the }I{ base of an uptier chain (the craftable variant).
 */
export function isUptierBase(name: string): boolean {
  return getUptierRoman(name) === "I";
}

/**
 * Strip the `}<roman>{` suffix from a name, returning the chain's base name.
 * Used to group uptier siblings.
 */
export function getChainBaseName(name: string): string {
  return name.replace(/\s*\}[IVX]+\{\s*$/, "").trim();
}

// ─── "Rank N" series ─────────────────────────────────────────────────────────
// A different sibling pattern used for things like potions, gems, and auras:
// "Allevium Rank 1", "Allevium Rank 2", ... — each rank is its OWN freshly
// craftable item (unlike uptiers, which must be upgraded in-game). We surface
// these as a separate "Other ranks" section so users can see the progression.

const RANK_RE = /\s+Rank\s+(\d+)$/i;

/** Returns the rank number suffix of a name, or null. */
export function getRankNumber(name: string): number | null {
  const m = name.match(RANK_RE);
  return m ? parseInt(m[1], 10) : null;
}

/** Strip the `Rank N` suffix to get the series base name. */
export function getRankBaseName(name: string): string {
  return name.replace(RANK_RE, "").trim();
}
