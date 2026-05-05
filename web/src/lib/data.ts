import rawItems from "@/data/allitems.json";
import rawRecipes from "@/data/recipes.json";
import imageManifest from "@/data/imageManifest.json";
import { slugify } from "./slug";
import { RARITIES, type Item, type RawItem, type RawRecipe } from "./types";

const items = rawItems as RawItem[];
const recipes = rawRecipes as RawRecipe[];
const validImages = new Set<string>(imageManifest as string[]);

// ─── Internal indexes (built once) ──────────────────────────────────────────

/** itemName → recipe (the recipe whose `items` array contains this item) */
const recipeByItemName = new Map<string, RawRecipe>();
for (const r of recipes) {
  for (const itemName of r.items) {
    recipeByItemName.set(itemName, r);
  }
}

/** materialName → list of item names that USE this material in their recipes */
const usedInByMaterialName = new Map<string, Set<string>>();
for (const r of recipes) {
  for (const mat of r.finished) {
    if (!usedInByMaterialName.has(mat.name)) {
      usedInByMaterialName.set(mat.name, new Set());
    }
    for (const itemName of r.items) {
      usedInByMaterialName.get(mat.name)!.add(itemName);
    }
  }
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
  const recipe = recipeByItemName.get(raw.Name) ?? null;
  const usedInNames = usedInByMaterialName.get(raw.Name);
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

  // stash for second pass
  (item as Item & { _usedInNames?: Set<string> })._usedInNames = usedInNames;
  return item;
});

// Second pass: resolve usedInSlugs (needs full slug map)
for (const item of enrichedItems) {
  const stash = item as Item & { _usedInNames?: Set<string> };
  if (stash._usedInNames) {
    for (const name of stash._usedInNames) {
      const ref = itemsByName.get(name);
      if (ref) item.usedInSlugs.push(ref.slug);
    }
    delete stash._usedInNames;
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
