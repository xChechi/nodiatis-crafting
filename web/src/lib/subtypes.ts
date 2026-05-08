// Generic subtype-summary helpers used by the cards-only category landings.
// Per-category public APIs (allWeaponSubtypes, etc.) are added in later tasks.

import type { Item } from "./types";
import { allItems } from "./data";

const PARENS_RE = /\(([^)]+)\)/;

export interface SubtypeSummary {
  name: string;
  slug: string;
  count: number;
  imageUrl: string | null;
}

/** Extract the content inside parens from a Type string, or return the whole input. */
export function typeParensSubtype(rawType: string): string {
  const m = rawType.match(PARENS_RE);
  return (m ? m[1] : rawType).trim();
}

/** Slug a subtype name for use in URLs. "1H Slash" -> "1h-slash". */
export function subtypeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build per-subtype summaries from a list of items. Items where `matches()`
 * returns false are skipped. Within each subtype, the representative item
 * (used for `imageUrl`) is the highest-level one; ties are broken by highest
 * rarity, then by first-encountered order.
 */
export function summariseSubtypes(
  items: Item[],
  matches: (item: Item) => boolean,
  subtypeOf: (item: Item) => string,
): SubtypeSummary[] {
  interface Bucket {
    count: number;
    repItem: Item;
  }
  const buckets = new Map<string, Bucket>();
  for (const item of items) {
    if (!matches(item)) continue;
    const name = subtypeOf(item);
    const existing = buckets.get(name);
    if (!existing) {
      buckets.set(name, { count: 1, repItem: item });
      continue;
    }
    existing.count += 1;
    const itemLevel = item.Level ?? 0;
    const repLevel = existing.repItem.Level ?? 0;
    if (
      itemLevel > repLevel ||
      (itemLevel === repLevel && (item.Rarity ?? 0) > (existing.repItem.Rarity ?? 0))
    ) {
      existing.repItem = item;
    }
  }
  return Array.from(buckets.entries())
    .map(([name, b]) => ({
      name,
      slug: subtypeSlug(name),
      count: b.count,
      imageUrl: b.repItem.imageUrl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Per-category accessors (lazy-memoised) ─────────────────────────────────

let _weapons: SubtypeSummary[] | null = null;
let _armor: SubtypeSummary[] | null = null;
let _other: SubtypeSummary[] | null = null;
let _potions: SubtypeSummary[] | null = null;

/** Strip " Rank N" from a potion's name and resolve its display subtype. */
function potionSubtypeOf(name: string): string {
  const noRank = name.replace(/\s+Rank\s+\d+$/i, "").trim();
  const m = noRank.match(/^(.+?)\s+Potion$/);
  if (m) return m[1].trim();
  if (/^Potion of /i.test(noRank)) return noRank;
  return "Other";
}

export function allWeaponSubtypes(): SubtypeSummary[] {
  if (_weapons) return _weapons;
  _weapons = summariseSubtypes(
    allItems(),
    (i) => i.Type.startsWith("Weapon") || i.Type.startsWith("Archery"),
    (i) => typeParensSubtype(i.Type),
  );
  return _weapons;
}

export function allArmorSubtypes(): SubtypeSummary[] {
  if (_armor) return _armor;
  _armor = summariseSubtypes(
    allItems(),
    (i) => i.Type.startsWith("Armor") || i.Type === "Shield",
    (i) => typeParensSubtype(i.Type),
  );
  return _armor;
}

export function allOtherSubtypes(): SubtypeSummary[] {
  if (_other) return _other;
  _other = summariseSubtypes(
    allItems(),
    (i) => {
      const t = i.Type;
      return (
        !t.startsWith("Weapon") &&
        !t.startsWith("Archery") &&
        !t.startsWith("Armor") &&
        t !== "Shield" &&
        t !== "Potion" &&
        !t.startsWith("Gem") &&
        t !== "Pet" &&
        t !== "Pets" &&
        !t.startsWith("Tool") &&
        !t.startsWith("Resource")
      );
    },
    (i) => typeParensSubtype(i.Type),
  );
  return _other;
}

export function allPotionSubtypes(): SubtypeSummary[] {
  if (_potions) return _potions;
  _potions = summariseSubtypes(
    allItems(),
    (i) => i.Type === "Potion",
    (i) => potionSubtypeOf(i.Name),
  );
  return _potions;
}
