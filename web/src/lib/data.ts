// HEAVY MODULE — bundles the full ~4 MB item DB. Use this from:
//   - server components / pages (always fine, runs once at build/request time)
//   - the planner (PlannerClient) — needs full recipe data for crafting math
//
// Client components that only need to render an item link/card should import
// from `./clientIndex` instead (~600 KB slim payload).

import { allRawItems } from "@/data/items/_all";
import { allRawRecipes } from "@/data/recipes/_all";
import imageManifest from "@/data/imageManifest.json";
import recipeIndex from "@/data/recipeIndex.json";
import { slugify } from "./slug";
import { RARITIES, type Item, type RawItem, type RawRecipe } from "./types";

const items: RawItem[] = allRawItems;
const recipes: RawRecipe[] = allRawRecipes;
const validImages = new Set<string>(imageManifest as string[]);

// ─── Pre-computed indexes (built at build time, see scripts/build-recipe-index.mjs) ──

const { recipeIdxByItemName, itemNamesByMaterialName } = recipeIndex as {
  recipeIdxByItemName: Record<string, number>;
  itemNamesByMaterialName: Record<string, string[]>;
};

/** itemName → recipe (the recipe whose `items` array contains this item) */
function lookupRecipe(itemName: string): RawRecipe | null {
  const idx = recipeIdxByItemName[itemName];
  return idx === undefined ? null : recipes[idx];
}

/** materialName → list of item names that USE this material in their recipes */
function lookupUsedIn(materialName: string): string[] | undefined {
  return itemNamesByMaterialName[materialName];
}

/** Slug uniqueness map */
const usedSlugs = new Map<string, number>();
function uniqueSlug(name: string): string {
  const base = slugify(name);
  const count = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

/** Extract tier number from a Name like "Mongoose Leg Bone (T1)" → 1 */
function extractTier(name: string): number | null {
  const m = name.match(/\(T(\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

// ─── Build enriched Item array ──────────────────────────────────────────────

const itemsBySlug = new Map<string, Item>();
const itemsByName = new Map<string, Item>();
const enrichedItems: Item[] = items.map((raw) => {
  const slug = uniqueSlug(raw.Name);
  const recipe = lookupRecipe(raw.Name);
  const usedInSlugs: string[] = []; // populated in second pass

  const item: Item = {
    ...raw,
    slug,
    rarityLabel: RARITIES[raw.Rarity ?? 0] ?? "Common",
    imageUrl: raw.Image && validImages.has(raw.Image) ? `/images/${raw.Image}` : null,
    tier: extractTier(raw.Name),
    recipe,
    usedInSlugs,
  };
  itemsBySlug.set(slug, item);
  itemsByName.set(raw.Name, item);
  return item;
});

// Second pass: resolve usedInSlugs (needs full slug map)
for (const item of enrichedItems) {
  const usedInNames = lookupUsedIn(item.Name);
  if (!usedInNames) continue;
  for (const name of usedInNames) {
    const ref = itemsByName.get(name);
    if (ref) item.usedInSlugs.push(ref.slug);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function allItems(): Item[] {
  return enrichedItems;
}

export function getItemBySlug(slug: string): Item | undefined {
  return itemsBySlug.get(slug);
}

export function getItemByName(name: string): Item | undefined {
  return itemsByName.get(name);
}

export function allItemSlugs(): string[] {
  return Array.from(itemsBySlug.keys());
}

export function totalItemCount(): number {
  return enrichedItems.length;
}

export function totalRecipeCount(): number {
  return recipes.length;
}
