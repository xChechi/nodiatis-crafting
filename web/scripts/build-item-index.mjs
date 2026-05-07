// Build a slim per-item index that's safe to ship to the client.
// Reads from sharded items/*.json. ~600 KB output (vs 4 MB full DB).
//
// Also embeds `c` (consumable mat count) for craftable items so the planner
// can render "X direct mats per craft" without needing the full recipe data.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const ITEMS_DIR = path.join(ROOT, "src", "data", "items");
const RECIPES_DIR = path.join(ROOT, "src", "data", "recipes");
const OUT = path.join(ROOT, "src", "data", "itemIndex.json");

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/}/g, "-")
    .replace(/{/g, "-")
    .replace(/[éè]/g, "e")
    .replace(/[àâ]/g, "a")
    .replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTier(name) {
  const m = name.match(/\(T(\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

async function loadAllItems() {
  const files = (await fs.readdir(ITEMS_DIR))
    .filter((n) => n.endsWith(".json"))
    .sort();
  const all = [];
  for (const f of files) {
    const lst = JSON.parse(await fs.readFile(path.join(ITEMS_DIR, f), "utf8"));
    all.push(...lst);
  }
  return all;
}

const raw = await loadAllItems();

// Build a name→consumable-count map from the recipe shards.
async function loadConsumableCounts() {
  const files = (await fs.readdir(RECIPES_DIR))
    .filter((n) => n.endsWith(".json"))
    .sort();
  const counts = new Map();
  for (const f of files) {
    const lst = JSON.parse(await fs.readFile(path.join(RECIPES_DIR, f), "utf8"));
    for (const r of lst) {
      const c = (r.consumable ?? []).length;
      for (const itemName of r.items) counts.set(itemName, c);
    }
  }
  return counts;
}
const consumableCounts = await loadConsumableCounts();

const used = new Map();
const indexEntries = raw.map((item) => {
  const base = slugify(item.Name);
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  const slug = n === 0 ? base : `${base}-${n + 1}`;
  const entry = {
    s: slug,
    n: item.Name,
    t: item.Type ?? "",
  };
  if (item.Rarity) entry.r = item.Rarity;
  if (item.Level) entry.L = item.Level;
  const tier = extractTier(item.Name);
  if (tier !== null) entry.T = tier;
  if (item.Image) entry.i = item.Image;
  if (item.RecipeType) entry.k = 1; // craftable flag
  const cc = consumableCounts.get(item.Name);
  if (cc !== undefined) entry.cc = cc; // consumable-mat count per craft
  return entry;
});

await fs.writeFile(OUT, JSON.stringify(indexEntries));
const sizeKB = (await fs.stat(OUT)).size / 1024;
console.log(
  `Wrote ${indexEntries.length} item-index entries to ${OUT} (${sizeKB.toFixed(
    1,
  )} KB)`,
);
