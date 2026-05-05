import type { Category } from "./types";

/**
 * Top-level browseable categories. The raw `Type` field uses structured
 * names like "Gem (Black)", "Resource (Bone Tier 1)", "Weapon (1H Slash)",
 * "Tool (Forge)", etc. We bucket them into player-friendly categories.
 */
export const CATEGORIES: Category[] = [
  {
    slug: "potions",
    label: "Potions",
    icon: "FlaskConical",
    matches: (t) => t === "Potion",
  },
  {
    slug: "weapons",
    label: "Weapons",
    icon: "Sword",
    matches: (t) => t.startsWith("Weapon") || t.startsWith("Archery"),
  },
  {
    slug: "armor",
    label: "Armor",
    icon: "Shield",
    matches: (t) => t.startsWith("Armor") || t === "Shield",
  },
  {
    slug: "gems",
    label: "Gems",
    icon: "Gem",
    matches: (t) => t.startsWith("Gem"),
  },
  {
    slug: "pets",
    label: "Pets",
    icon: "Cat",
    matches: (t) => t === "Pet" || t === "Pets",
  },
  {
    slug: "tools",
    label: "Tools",
    icon: "Hammer",
    matches: (t) => t.startsWith("Tool"),
  },
  {
    slug: "materials",
    label: "Materials",
    icon: "Package",
    matches: (t) => t.startsWith("Resource"),
  },
  {
    slug: "other",
    label: "Other",
    icon: "Sparkles",
    matches: (t) =>
      // Catch-all: anything not matched above
      !t.startsWith("Weapon") &&
      !t.startsWith("Archery") &&
      !t.startsWith("Armor") &&
      t !== "Shield" &&
      t !== "Potion" &&
      !t.startsWith("Gem") &&
      t !== "Pet" &&
      t !== "Pets" &&
      !t.startsWith("Tool") &&
      !t.startsWith("Resource"),
  },
];

export function findCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryForType(typeRaw: string): Category | undefined {
  return CATEGORIES.find((c) => c.matches(typeRaw));
}
