// Slim client-side item index. Use this from CLIENT components instead of
// `./data` — it ships ~600 KB instead of ~4 MB. Schema mirrors the slim
// fields documented in data/INDEX.md.
//
// Server components (and the page-level data layer) should still import
// from `./data` for full Item records.

import rawIndex from "@/data/itemIndex.json";

interface RawIndexEntry {
  s: string;             // slug
  n: string;             // name
  t: string;             // raw Type
  r?: number;            // rarity (omitted when 0=Common)
  L?: number;            // level (omitted when 0)
  T?: number;            // tier (omitted when name has no `(T<n>)`)
  i?: string;            // image path
  k?: 1;                 // craftable flag (omitted when not craftable)
  cc?: number;           // consumable mat count per craft (craftable items only)
}

const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
export type RarityLabel = (typeof RARITIES)[number];

/** Slim shape used by client components. Mirrors the most-used fields of Item. */
export interface IndexedItem {
  slug: string;
  Name: string;
  Type: string;
  Rarity: number;
  rarityLabel: RarityLabel;
  Level: number;
  tier: number | null;
  imageUrl: string | null;
  craftable: boolean;
  /** Number of mats per craft (consumable layer). 0 if not craftable / unknown. */
  consumableCount: number;
}

const entries = rawIndex as RawIndexEntry[];

function expand(e: RawIndexEntry): IndexedItem {
  const rarity = e.r ?? 0;
  return {
    slug: e.s,
    Name: e.n,
    Type: e.t,
    Rarity: rarity,
    rarityLabel: RARITIES[rarity] ?? "Common",
    Level: e.L ?? 0,
    tier: e.T ?? null,
    imageUrl: e.i ? `/images/${e.i}` : null,
    craftable: e.k === 1,
    consumableCount: e.cc ?? 0,
  };
}

const bySlug = new Map<string, IndexedItem>();
const byName = new Map<string, IndexedItem>();
for (const raw of entries) {
  const item = expand(raw);
  bySlug.set(item.slug, item);
  // Names aren't unique — last write wins, matching data.ts behavior
  byName.set(item.Name, item);
}

export function getIndexedItemBySlug(slug: string): IndexedItem | undefined {
  return bySlug.get(slug);
}

export function getIndexedItemByName(name: string): IndexedItem | undefined {
  return byName.get(name);
}
