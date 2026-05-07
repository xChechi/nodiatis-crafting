"use server";

// Server action that does all the planner aggregation server-side. The
// planner client sends `{slug, qty}[]` + depth and gets back an enriched
// shopping list with cost summary. The full ~4 MB recipe DB never leaves
// the server.

import { aggregatePlannerMats, type CraftingDepth } from "./crafting";
import { getItemBySlug, getItemByName } from "./data";
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
}

export interface PlannerAggregateResult {
  aggregated: AggregatedMatRow[];
  costSummary: {
    buyable: number;
    buyableLines: number;
    unbuyableLines: number;
  };
  /** Echo back so the client can detect stale responses if requests overlap. */
  computedFor: { slugs: string[]; depth: CraftingDepth };
}

const EMPTY_RESULT: PlannerAggregateResult = {
  aggregated: [],
  costSummary: { buyable: 0, buyableLines: 0, unbuyableLines: 0 },
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
export async function aggregatePlannerForDisplay(
  input: PlannerEntryInput[],
  depth: CraftingDepth,
): Promise<PlannerAggregateResult> {
  const entries = resolveEntries(input);
  if (entries.length === 0) return EMPTY_RESULT;

  const mats: Mat[] = aggregatePlannerMats(entries, depth);

  let buyable = 0;
  let buyableLines = 0;
  let unbuyableLines = 0;
  const aggregated: AggregatedMatRow[] = mats.map((m) => {
    const matItem = getItemByName(m.name);
    const unitCost = matItem?.Cost ?? 0;
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
    };
  });

  return {
    aggregated,
    costSummary: { buyable, buyableLines, unbuyableLines },
    computedFor: {
      slugs: entries.map((e) => e.item.slug),
      depth,
    },
  };
}
