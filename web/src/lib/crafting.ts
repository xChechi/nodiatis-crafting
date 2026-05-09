import type { Item, Mat } from "./types";
import { getItemByName } from "./data";
import { synthesizeResourceRecipe } from "./syntheticRecipes";

export type CraftingDepth = "consumable" | "finished" | "base" | "leaves";

const RESOURCE_SUBTYPE_RE = /^Resource \(([^()]+?) Tier \d+\)$/;

/**
 * Group key for sorting: extracts the resource subtype (e.g. "Resin",
 * "Leather", "Ingot") from the item's Type field. Falls back to the full
 * Type for non-resource items, then to the mat name when no item record
 * exists. Used by mergeMats so the planner shopping list groups by
 * material kind and orders tiers high → low within each group.
 */
function matSubtype(mat: Mat): string {
  const item = getItemByName(mat.name);
  if (!item) return mat.name;
  const m = item.Type.match(RESOURCE_SUBTYPE_RE);
  if (m) return m[1].trim();
  return item.Type;
}

/**
 * Aggregate identical mats by `(name, tier)` and sum their quantities.
 * Returns a fresh array sorted by subtype asc, then tier desc, then name.
 */
function mergeMats(mats: Mat[]): Mat[] {
  const map = new Map<string, Mat>();
  for (const m of mats) {
    const key = `${m.name}::${m.tier}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += m.qty;
    } else {
      map.set(key, { ...m });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const sa = matSubtype(a);
    const sb = matSubtype(b);
    if (sa !== sb) return sa.localeCompare(sb);
    if (a.tier !== b.tier) return b.tier - a.tier;
    return a.name.localeCompare(b.name);
  });
}

const SAFETY_DEPTH = 12;

/**
 * Recursively expand a list of mats into their true base materials,
 * KEEPING every intermediate craftable mat in the output too.
 *
 * Why both: in-game a player might gather some mats from raw and buy/trade
 * for intermediates. The shopping list should surface every level so the
 * player can pick. (This is intentionally "additive" — adding the geodes
 * + the dye that's made from them. The player chooses which path to take.)
 *
 * A mat is "base" when its corresponding item has no recipe (i.e., gathered,
 * dropped, or bought). For craftable mats, we ALSO emit the mat itself
 * AND recurse into its `consumable` layer.
 */
export function expandToBaseMats(input: Mat[]): Mat[] {
  function recurse(mats: Mat[], depth: number): Mat[] {
    if (depth >= SAFETY_DEPTH) return mats;
    const out: Mat[] = [];
    for (const mat of mats) {
      // Always keep the mat in the output (whether it's craftable or base).
      // This way the player sees the consumable layer AND the deeper raw mats.
      out.push({ ...mat });

      const subItem = getItemByName(mat.name);

      // Use the stored recipe; otherwise try synthesizing one for known
      // resource intermediates (Cloth/Thread/Dye).
      let consumable: Mat[] | undefined = subItem?.recipe?.consumable;
      if ((!consumable || consumable.length === 0) && subItem) {
        const synth = synthesizeResourceRecipe(subItem.Type);
        if (synth) consumable = synth;
      }
      if (!consumable || consumable.length === 0) continue;

      // Self-referencing recipes (where a mat appears in its own consumable
      // layer) shouldn't recurse — bail without expanding further.
      const selfReferencing = consumable.some((m) => m.name === mat.name);
      if (selfReferencing) continue;

      const scaled = consumable.map((m) => ({
        ...m,
        qty: m.qty * mat.qty,
      }));
      out.push(...recurse(scaled, depth + 1));
    }
    return out;
  }
  return mergeMats(recurse(input, 0));
}

/**
 * Recursively expand a list of mats and return ONLY the terminal leaves —
 * mats with no recipe (stored or synthesized). Intermediates are collapsed
 * away so the result reads as "the irreducible shopping list."
 */
export function expandToLeaves(input: Mat[]): Mat[] {
  function recurse(mats: Mat[], depth: number): Mat[] {
    if (depth >= SAFETY_DEPTH) return mats;
    const out: Mat[] = [];
    for (const mat of mats) {
      const subItem = getItemByName(mat.name);
      let consumable: Mat[] | undefined = subItem?.recipe?.consumable;
      if ((!consumable || consumable.length === 0) && subItem) {
        const synth = synthesizeResourceRecipe(subItem.Type);
        if (synth) consumable = synth;
      }
      if (!consumable || consumable.length === 0) {
        out.push({ ...mat });
        continue;
      }
      if (consumable.some((m) => m.name === mat.name)) {
        out.push({ ...mat });
        continue;
      }
      const scaled = consumable.map((m) => ({ ...m, qty: m.qty * mat.qty }));
      out.push(...recurse(scaled, depth + 1));
    }
    return out;
  }
  return mergeMats(recurse(input, 0));
}

/**
 * Compute mats for a single item's recipe at the requested depth.
 */
export function matsForItemAtDepth(item: Item, depth: CraftingDepth): Mat[] {
  if (!item.recipe) return [];
  if (depth === "consumable") return item.recipe.consumable;
  if (depth === "finished") return item.recipe.finished;
  if (depth === "leaves")
    return expandToLeaves([
      ...item.recipe.consumable,
      ...item.recipe.finished,
    ]);
  return expandToBaseMats(item.recipe.consumable);
}

/**
 * Aggregate mats across multiple planner entries at the requested depth.
 * Each entry has an item + the quantity the user wants to craft.
 */
export function aggregatePlannerMats(
  entries: Array<{ item: Item; quantity: number }>,
  depth: CraftingDepth,
): Mat[] {
  const all: Mat[] = [];
  for (const { item, quantity } of entries) {
    const mats = matsForItemAtDepth(item, depth);
    for (const m of mats) {
      all.push({ ...m, qty: m.qty * quantity });
    }
  }
  return mergeMats(all);
}
