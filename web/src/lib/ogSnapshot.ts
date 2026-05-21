// Slim per-slug snapshot read by the OG image routes. Built by
// `web/scripts/build-og-snapshot.mjs` — see that file for the field shorthand.
// Lets the OG routes avoid importing the ~4 MB `@/lib/data` module.

import snap from "@/data/ogSnapshot.json";
import { RARITIES, type RarityLabel } from "./types";

interface OgSnapshotEntry {
  n: string;
  t: string;
  d?: string;
  L?: number;
  T?: number;
  c?: number;
  r?: number;
  k?: 1;
}

interface OgSnapshot {
  items: Record<string, OgSnapshotEntry>;
  categoryCounts: Record<string, number>;
}

export interface OgItem {
  Name: string;
  Type: string;
  Description?: string;
  Level?: number;
  tier: number | null;
  Cost?: number;
  rarityLabel: RarityLabel;
  hasRecipe: boolean;
}

const data = snap as OgSnapshot;

export function getOgItem(slug: string): OgItem | null {
  const e = data.items[slug];
  if (!e) return null;
  return {
    Name: e.n,
    Type: e.t,
    Description: e.d,
    Level: e.L,
    tier: e.T ?? null,
    Cost: e.c,
    rarityLabel: RARITIES[e.r ?? 0] ?? "Common",
    hasRecipe: !!e.k,
  };
}

export function getOgCategoryCount(slug: string): number {
  return data.categoryCounts[slug] ?? 0;
}
