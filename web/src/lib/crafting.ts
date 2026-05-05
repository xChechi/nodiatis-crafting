import type { Item, Mat } from "./types";
import { getItemByName } from "./data";

export type CraftingDepth = "consumable" | "finished" | "base";

/**
 * Aggregate identical mats by `(name, tier)` and sum their quantities.
 * Returns a fresh sorted array.
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
    if (a.tier !== b.tier) return b.tier - a.tier;
    return a.name.localeCompare(b.name);
  });
}

const SAFETY_DEPTH = 12;

/**
 * Recursively expand a list of mats into their true base materials.
 *
 * A mat is "base" when its corresponding item has no `RecipeType` (i.e., it
 * isn't craftable — it's gathered, dropped, or bought). For craftable mats,
 * we use their `consumable` layer (the immediate per-craft inputs) and
 * multiply by the parent quantity.
 */
export function expandToBaseMats(input: Mat[]): Mat[] {
  function recurse(mats: Mat[], depth: number): Mat[] {
    if (depth >= SAFETY_DEPTH) return mats;
    const out: Mat[] = [];
    for (const mat of mats) {
      const subItem = getItemByName(mat.name);
      if (subItem?.recipe && subItem.recipe.consumable.length > 0) {
        // Self-referencing recipes (where a mat appears in its own consumable
        // layer) should NOT recurse — that's the "this dye is also the input"
        // pattern in Nodiatis. Bail to base in that case.
        const selfReferencing = subItem.recipe.consumable.some(
          (m) => m.name === mat.name,
        );
        if (selfReferencing) {
          out.push({ ...mat });
          continue;
        }
        const scaled = subItem.recipe.consumable.map((m) => ({
          ...m,
          qty: m.qty * mat.qty,
        }));
        out.push(...recurse(scaled, depth + 1));
      } else {
        out.push({ ...mat });
      }
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
