// Helpers for the Materials category. Resource Type strings encode both
// the kind of material and its tier in one field — e.g. "Resource (Bone
// Tier 7)" → { name: "Bone", tier: 7 }. The 4 no-tier types (Armor
// Essence, Shield Essence, Junk, Heroic Essence) wrap inner text without
// a tier suffix.

import type { Item } from "./types";

const RESOURCE_PREFIX = "Resource";
const INNER_RE = /\(([^)]+)\)/;
const TIER_SUFFIX_RE = /\s+Tier\s+(\d+)$/i;

export interface MaterialTypeSummary {
  name: string;
  slug: string;
  count: number;
  /** [min, max] tier present, or null if no item in this type has a tier. */
  tierRange: [number, number] | null;
}

/** Parse a resource Type string into its canonical name and tier number. */
export function parseMaterialType(rawType: string): {
  name: string;
  tier: number | null;
} {
  const m = rawType.match(INNER_RE);
  if (!m) return { name: rawType.trim(), tier: null };
  const inner = m[1].trim();
  const tierMatch = inner.match(TIER_SUFFIX_RE);
  if (tierMatch) {
    return {
      name: inner.replace(TIER_SUFFIX_RE, "").trim(),
      tier: parseInt(tierMatch[1], 10),
    };
  }
  return { name: inner, tier: null };
}

/** Slugify a canonical type name for use in URLs. "Armor Essence" → "armor-essence". */
export function materialTypeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Group resource items by canonical type name. Returns one summary per
 * distinct type, sorted alphabetically. Non-resource items are ignored.
 */
export function summariseTypes(items: Item[]): MaterialTypeSummary[] {
  const buckets = new Map<
    string,
    { count: number; tiers: number[] }
  >();
  for (const item of items) {
    if (!item.Type.startsWith(RESOURCE_PREFIX)) continue;
    const { name, tier } = parseMaterialType(item.Type);
    let bucket = buckets.get(name);
    if (!bucket) {
      bucket = { count: 0, tiers: [] };
      buckets.set(name, bucket);
    }
    bucket.count += 1;
    if (tier !== null) bucket.tiers.push(tier);
  }
  return Array.from(buckets.entries())
    .map(([name, b]) => ({
      name,
      slug: materialTypeSlug(name),
      count: b.count,
      tierRange:
        b.tiers.length > 0
          ? ([Math.min(...b.tiers), Math.max(...b.tiers)] as [number, number])
          : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
