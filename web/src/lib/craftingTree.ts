// Server-side helper that recursively expands a recipe into a render-ready
// tree. The tree is fully serializable (no Item refs) so it can pass the
// React server→client boundary.

import { getItemByName } from "./data";
import { synthesizeResourceRecipe } from "./syntheticRecipes";
import type { Item, Mat } from "./types";

export interface CraftingTreeNode {
  name: string;
  tier: number;
  qty: number;
  /** Slug for linking to the mat's detail page. null if no item record. */
  slug: string | null;
  /** Image URL or null. */
  imageUrl: string | null;
  /** Empty when the mat is a base/gathered resource. */
  children: CraftingTreeNode[];
}

const MAX_DEPTH = 12;

function expandNode(
  name: string,
  tier: number,
  qty: number,
  depth: number,
  seen: Set<string>,
): CraftingTreeNode {
  const item = getItemByName(name);
  const node: CraftingTreeNode = {
    name,
    tier,
    qty,
    slug: item?.slug ?? null,
    imageUrl: item?.imageUrl ?? null,
    children: [],
  };

  if (depth >= MAX_DEPTH) return node;

  // Use the stored recipe if present; otherwise try synthesizing one for
  // known resource intermediates (Cloth/Thread/Dye).
  let consumable: Mat[] | undefined = item?.recipe?.consumable;
  if ((!consumable || consumable.length === 0) && item) {
    const synth = synthesizeResourceRecipe(item.Type);
    if (synth) consumable = synth;
  }
  if (!consumable || consumable.length === 0) return node;

  // Cycle guard. Recipes shouldn't reference themselves, but if data is wonky
  // we don't want to recurse forever.
  const key = `${name}@${tier}`;
  if (seen.has(key)) return node;

  const selfReferencing = consumable.some(
    (m) => m.name === name && m.tier === tier,
  );
  if (selfReferencing) return node;

  const nextSeen = new Set(seen);
  nextSeen.add(key);

  for (const sub of consumable) {
    node.children.push(
      expandNode(sub.name, sub.tier, sub.qty * qty, depth + 1, nextSeen),
    );
  }

  return node;
}

function buildTreeForMats(
  item: Item,
  mats: Mat[],
): CraftingTreeNode | null {
  if (mats.length === 0) return null;
  const seenRoot = new Set([`${item.Name}@${item.tier ?? 0}`]);
  return {
    name: item.Name,
    tier: item.tier ?? 0,
    qty: 1,
    slug: item.slug,
    imageUrl: item.imageUrl ?? null,
    children: mats.map((mat) =>
      expandNode(mat.name, mat.tier, mat.qty, 1, seenRoot),
    ),
  };
}

export function buildCraftingTree(item: Item): CraftingTreeNode | null {
  if (!item.recipe) return null;
  return buildTreeForMats(item, item.recipe.consumable);
}

export function buildFinishedTree(item: Item): CraftingTreeNode | null {
  if (!item.recipe) return null;
  return buildTreeForMats(item, item.recipe.finished);
}
