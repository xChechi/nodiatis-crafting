// In-game recipes for resource intermediates aren't in the scraped data —
// `tools.nodiatis.com` only exposes recipes for end-game craftables. We
// know the rules though, so we synthesize them here. All inputs are the
// same tier as the output unless noted otherwise.
//
//   Cloth   = 1 Dye   + 2 Thread
//   Thread  = 2 Silk
//   Dye     = 2 Plant
//   Leather = 2 Skin  + 1 Oil
//   Ingot   = 3 Ore   + 1 Wood
//   Geode   = 3 Ore
//   Oil     = 2 Vegetable + 1 Fish (T1)   ← fish is ALWAYS T1, regardless of oil tier
//   Plank   = 3 Wood
//
// Skins, Plants, Silks, Vegetables, Ores, Wood, Bones, Sinews, Scales,
// Fish, Prey, Rodents, Resin, Dust, and Geode-source ores are gathered →
// genuinely base.

import { allItems } from "./data";
import type { Mat } from "./types";

const SYNTH_TYPE_RE =
  /^Resource \((Cloth|Thread|Dye|Leather|Ingot|Geode|Oil|Plank) Tier (\d+)\)$/;
const RESOURCE_TYPE_RE =
  /^Resource \((Cloth|Thread|Dye|Silk|Plant|Skin|Wood|Ore|Vegetable|Fish|Leather|Ingot|Geode|Oil|Plank) Tier (\d+)\)$/;

let _resourceMap: Map<string, string> | null = null;

function resourceNameByTypeAndTier(
  subtype:
    | "Cloth"
    | "Thread"
    | "Dye"
    | "Silk"
    | "Plant"
    | "Skin"
    | "Wood"
    | "Ore"
    | "Vegetable"
    | "Fish"
    | "Leather"
    | "Ingot"
    | "Geode"
    | "Oil"
    | "Plank",
  tier: number,
): string | undefined {
  if (!_resourceMap) {
    const m = new Map<string, string>();
    for (const it of allItems()) {
      const match = it.Type.match(RESOURCE_TYPE_RE);
      if (match) m.set(`${match[1]}@${match[2]}`, it.Name);
    }
    _resourceMap = m;
  }
  return _resourceMap.get(`${subtype}@${tier}`);
}

/**
 * Returns synthesized ingredient list for a known crafted-resource
 * intermediate, or null if the item isn't one of the listed types or a
 * needed lookup is missing.
 */
export function synthesizeResourceRecipe(itemType: string): Mat[] | null {
  const m = itemType.match(SYNTH_TYPE_RE);
  if (!m) return null;
  const subtype = m[1] as
    | "Cloth"
    | "Thread"
    | "Dye"
    | "Leather"
    | "Ingot"
    | "Geode"
    | "Oil"
    | "Plank";
  const tier = parseInt(m[2], 10);
  const at = (
    sub: Parameters<typeof resourceNameByTypeAndTier>[0],
    t: number,
  ) => resourceNameByTypeAndTier(sub, t);

  switch (subtype) {
    case "Cloth": {
      const dye = at("Dye", tier);
      const thread = at("Thread", tier);
      if (!dye || !thread) return null;
      return [
        { name: dye, qty: 1, tier },
        { name: thread, qty: 2, tier },
      ];
    }
    case "Thread": {
      const silk = at("Silk", tier);
      if (!silk) return null;
      return [{ name: silk, qty: 2, tier }];
    }
    case "Dye": {
      const plant = at("Plant", tier);
      if (!plant) return null;
      return [{ name: plant, qty: 2, tier }];
    }
    case "Leather": {
      const skin = at("Skin", tier);
      const oil = at("Oil", tier);
      if (!skin || !oil) return null;
      return [
        { name: skin, qty: 2, tier },
        { name: oil, qty: 1, tier },
      ];
    }
    case "Ingot": {
      const ore = at("Ore", tier);
      const wood = at("Wood", tier);
      if (!ore || !wood) return null;
      return [
        { name: ore, qty: 3, tier },
        { name: wood, qty: 1, tier },
      ];
    }
    case "Geode": {
      const ore = at("Ore", tier);
      if (!ore) return null;
      return [{ name: ore, qty: 3, tier }];
    }
    case "Oil": {
      const veg = at("Vegetable", tier);
      const fishT1 = at("Fish", 1);
      if (!veg || !fishT1) return null;
      // Fish is always T1 for oil crafting — even for T30 oil.
      return [
        { name: veg, qty: 2, tier },
        { name: fishT1, qty: 1, tier: 1 },
      ];
    }
    case "Plank": {
      const wood = at("Wood", tier);
      if (!wood) return null;
      return [{ name: wood, qty: 3, tier }];
    }
  }
}
