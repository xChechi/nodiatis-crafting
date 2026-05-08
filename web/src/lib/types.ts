// Raw shape from data/allitems.json
export interface RawItem {
  Name: string;
  Type: string;
  Image?: string;
  RecipeType?: string;
  Rarity?: number;
  Level?: number;
  Cost?: number;
  Resell?: number;
  Weight?: number;
  Description?: string;
  Damage?: string;
  Energy?: number;
  Mana?: number;
  Delay?: string;
  Accuracy?: number;
  ArmorClass?: number;
  Stats?: string;
  Location?: string;
  Prereq?: string;
  Virtues?: string;
  RangeHaste?: number;
  MaxArrowWeight?: number;
  LastSeen?: string;
}

// Raw shape from data/recipes.json
export interface RawRecipe {
  itemType: string;
  rarity: number;
  level: number;
  cost: number;
  items: string[];
  consumable: Mat[];
  finished: Mat[];
}

export interface Mat {
  name: string;
  tier: number;
  qty: number;
}

// Enriched/normalized shape used throughout the app
export interface Item extends RawItem {
  slug: string;
  rarityLabel: RarityLabel;
  imageUrl: string | null;
  /** Tier extracted from name (e.g. "Mongoose Leg Bone (T1)" → 1), if present */
  tier: number | null;
  /** Recipe object if this item is craftable AND a recipe exists */
  recipe: RawRecipe | null;
  /** Slugs of items that use THIS item as a material */
  usedInSlugs: string[];
  /** Spell-mechanic tags derived from Description (heal, dot, aura, ...) */
  tags: string[];
}

export type RarityLabel = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export const RARITIES: RarityLabel[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
];

// Top-level browseable categories (mapped from raw `Type` field)
export interface Category {
  slug: string;
  label: string;
  /** RawItem.Type values that belong here */
  matches: (typeRaw: string) => boolean;
  icon: string; // lucide icon name
}
