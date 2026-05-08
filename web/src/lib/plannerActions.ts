"use server";

// Server action that does all the planner aggregation server-side. The
// planner client sends `{slug, qty}[]` + depth and gets back an enriched
// shopping list with cost summary. The full ~4 MB recipe DB never leaves
// the server.

import { aggregatePlannerMats, type CraftingDepth } from "./crafting";
import { getItemBySlug, getItemByName } from "./data";
import { parseInventory } from "./inventory";
import { parseMaterialType } from "./materials";
import type { Item, Mat } from "./types";

export interface PlannerEntryInput {
  slug: string;
  quantity: number;
}

export interface AggregatedMatRow {
  name: string;
  tier: number;
  qty: number;
  /** Slug for linking to the mat's detail page. null if no item record. */
  matSlug: string | null;
  /** Image path under /images/, or null. */
  matImage: string | null;
  /** In-game gold cost per unit; 0 if not bought from a merchant. */
  unitCost: number;
  /** Quantity already owned per the user's saved inventory. 0 when unknown. */
  ownedQty: number;
}

export interface PlannerAggregateResult {
  aggregated: AggregatedMatRow[];
  costSummary: {
    buyable: number;
    buyableLines: number;
    unbuyableLines: number;
  };
  /** Per-planned-item buyable gold subtotal, keyed by item slug. */
  perItemCosts: Record<string, number>;
  /** Echo back so the client can detect stale responses if requests overlap. */
  computedFor: { slugs: string[]; depth: CraftingDepth };
}

const EMPTY_RESULT: PlannerAggregateResult = {
  aggregated: [],
  costSummary: { buyable: 0, buyableLines: 0, unbuyableLines: 0 },
  perItemCosts: {},
  computedFor: { slugs: [], depth: "base" },
};

/** Resolve planner inputs to full server-side Items. Skips unknown slugs. */
function resolveEntries(input: PlannerEntryInput[]): Array<{
  item: Item;
  quantity: number;
}> {
  const out: Array<{ item: Item; quantity: number }> = [];
  for (const e of input) {
    if (!e.slug || !Number.isFinite(e.quantity) || e.quantity <= 0) continue;
    const item = getItemBySlug(e.slug);
    if (!item) continue;
    out.push({ item, quantity: e.quantity });
  }
  return out;
}

/**
 * Compute the aggregated shopping list + cost summary entirely server-side.
 * Safe to call frequently; response is small (~few KB).
 */
/** Look up owned qty for `name @ tier` against the user's parsed inventory. */
function buildOwnedLookup(inventoryText: string): (name: string, tier: number) => number {
  if (!inventoryText.trim()) return () => 0;
  const { entries } = parseInventory(inventoryText);
  const byKey = new Map<string, number>();
  for (const e of entries) {
    const item = getItemByName(e.name);
    if (!item) continue;
    if (item.Type.startsWith("Resource (")) {
      const parsed = parseMaterialType(item.Type);
      if (parsed.tier !== null) byKey.set(`${parsed.name}:${parsed.tier}`, e.qty);
    }
    byKey.set(e.name, e.qty);
  }
  return (name, tier) =>
    byKey.get(`${name}:${tier}`) ?? byKey.get(name) ?? 0;
}

export async function aggregatePlannerForDisplay(
  input: PlannerEntryInput[],
  depth: CraftingDepth,
  inventoryText = "",
): Promise<PlannerAggregateResult> {
  const entries = resolveEntries(input);
  if (entries.length === 0) return EMPTY_RESULT;

  const mats: Mat[] = aggregatePlannerMats(entries, depth);
  const ownedFor = buildOwnedLookup(inventoryText);

  let buyable = 0;
  let buyableLines = 0;
  let unbuyableLines = 0;
  const aggregated: AggregatedMatRow[] = mats.map((m) => {
    const matItem = getItemByName(m.name);
    const unitCost = matItem?.Cost ?? 0;
    const ownedQty = ownedFor(m.name, m.tier);
    if (unitCost > 0) {
      buyable += unitCost * m.qty;
      buyableLines += 1;
    } else {
      unbuyableLines += 1;
    }
    return {
      name: m.name,
      tier: m.tier,
      qty: m.qty,
      matSlug: matItem?.slug ?? null,
      matImage: matItem?.imageUrl ?? null,
      unitCost,
      ownedQty,
    };
  });

  // Per-item subtotal: run the same aggregation against a single-entry set
  // so we know what each planned item contributes to the buyable total.
  const perItemCosts: Record<string, number> = {};
  for (const e of entries) {
    const itemMats = aggregatePlannerMats([e], depth);
    let itemTotal = 0;
    for (const m of itemMats) {
      const matItem = getItemByName(m.name);
      const unitCost = matItem?.Cost ?? 0;
      if (unitCost > 0) itemTotal += unitCost * m.qty;
    }
    perItemCosts[e.item.slug] = itemTotal;
  }

  return {
    aggregated,
    costSummary: { buyable, buyableLines, unbuyableLines },
    perItemCosts,
    computedFor: {
      slugs: entries.map((e) => e.item.slug),
      depth,
    },
  };
}
