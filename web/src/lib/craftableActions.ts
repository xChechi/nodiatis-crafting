"use server";

// Server action for the /craftable page. The client posts the user's raw
// inventory text; the server parses it, walks every recipe in the DB, and
// returns the ranked matches. The full ~3.5 MB recipe DB never enters the
// client bundle for this page.

import { allItems, getItemByName } from "./data";
import { parseInventory, type InventoryEntry } from "./inventory";
import { expandToBaseMats } from "./crafting";
import { parseMaterialType } from "./materials";
import type { Item, Mat } from "./types";

export interface SerializedMatch {
  item: {
    slug: string;
    Name: string;
    Type: string;
  };
  canCraft: number;
  covered: number;
  total: number;
  missing: Array<{ name: string; tier: number; need: number; have: number }>;
}

export interface CraftableResult {
  entries: InventoryEntry[];
  warnings: string[];
  matches: SerializedMatch[];
}

const EMPTY: CraftableResult = { entries: [], warnings: [], matches: [] };

function buildInventoryMap(entries: InventoryEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const item = getItemByName(e.name);
    if (!item) continue;
    if (item.Type.startsWith("Resource (")) {
      const parsed = parseMaterialType(item.Type);
      if (parsed.tier !== null) {
        m.set(`${parsed.name}:${parsed.tier}`, e.qty);
      }
    }
    m.set(e.name, e.qty);
  }
  return m;
}

function evaluateRecipe(
  item: Item,
  consumable: Mat[],
  inventory: Map<string, number>,
): SerializedMatch | null {
  if (consumable.length === 0) return null;
  let canCraft = Infinity;
  let covered = 0;
  const missing: SerializedMatch["missing"] = [];
  for (const mat of consumable) {
    const have =
      inventory.get(`${mat.name}:${mat.tier}`) ??
      inventory.get(mat.name) ??
      0;
    if (have >= mat.qty) {
      covered += 1;
      canCraft = Math.min(canCraft, Math.floor(have / mat.qty));
    } else {
      missing.push({ name: mat.name, tier: mat.tier, need: mat.qty, have });
      canCraft = 0;
    }
  }
  if (covered === 0) return null;
  return {
    item: { slug: item.slug, Name: item.Name, Type: item.Type },
    canCraft,
    covered,
    total: consumable.length,
    missing,
  };
}

export async function findCraftable(rawInput: string): Promise<CraftableResult> {
  if (!rawInput.trim()) return EMPTY;

  const { entries, warnings } = parseInventory(rawInput);
  if (entries.length === 0) return { entries, warnings, matches: [] };

  const inventoryMap = buildInventoryMap(entries);
  const matches: SerializedMatch[] = [];

  for (const item of allItems()) {
    if (!item.recipe) continue;
    const baseMats = expandToBaseMats([
      ...item.recipe.consumable,
      ...item.recipe.finished,
    ]);
    const m = evaluateRecipe(item, baseMats, inventoryMap);
    if (!m) continue;

    if (entries.length > 1) {
      const matKeys = new Set<string>();
      for (const mat of baseMats) {
        matKeys.add(`${mat.name}:${mat.tier}`);
        matKeys.add(mat.name);
      }
      let userMatsInRecipe = 0;
      for (const e of entries) {
        if (matKeys.has(e.name)) {
          userMatsInRecipe++;
          continue;
        }
        const userItem = getItemByName(e.name);
        if (userItem?.Type.startsWith("Resource (")) {
          const parsed = parseMaterialType(userItem.Type);
          if (
            parsed.tier !== null &&
            matKeys.has(`${parsed.name}:${parsed.tier}`)
          ) {
            userMatsInRecipe++;
          }
        }
      }
      if (userMatsInRecipe < entries.length) continue;
    }

    matches.push(m);
  }

  matches.sort((a, b) => {
    if (a.canCraft !== b.canCraft) return b.canCraft - a.canCraft;
    const aPct = a.covered / a.total;
    const bPct = b.covered / b.total;
    if (aPct !== bPct) return bPct - aPct;
    return a.item.Name.localeCompare(b.item.Name);
  });

  return { entries, warnings, matches: matches.slice(0, 500) };
}
