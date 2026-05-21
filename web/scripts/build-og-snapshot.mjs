// Build a slim per-slug snapshot for the OG image routes so they don't
// have to import the ~4 MB `@/lib/data` module on every cold invocation.
//
// Output: web/src/data/ogSnapshot.json
//   { items: { [slug]: { n, t, d?, L?, T?, c?, r?, k? } },
//     categoryCounts: { [slug]: number } }
//
// Field shortening matches build-item-index.mjs conventions.
// Category matchers below must stay in sync with web/src/lib/categories.ts.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const REPO = path.resolve(ROOT, "..");
const ALLITEMS = path.join(REPO, "data", "allitems.json");
const RECIPES_DIR = path.join(ROOT, "src", "data", "recipes");
const OUT = path.join(ROOT, "src", "data", "ogSnapshot.json");

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

function extractNameTier(name) {
  const m = name.match(/\(T(\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

function extractResourceTier(type) {
  const m = type.match(/\(([^)]+)\)/);
  if (!m) return null;
  const tm = m[1].match(/\s+Tier\s+(\d+)$/i);
  return tm ? parseInt(tm[1], 10) : null;
}

// Keep in sync with web/src/lib/categories.ts
const CATEGORY_MATCHERS = [
  ["potions", (t) => t === "Potion"],
  ["weapons", (t) => t.startsWith("Weapon") || t.startsWith("Archery")],
  ["armor", (t) => t.startsWith("Armor") || t === "Shield"],
  ["gems", (t) => t.startsWith("Gem")],
  ["pets", (t) => t === "Pet" || t === "Pets"],
  ["tools", (t) => t.startsWith("Tool")],
  ["materials", (t) => t.startsWith("Resource")],
  [
    "other",
    (t) =>
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
  ],
];

const raw = JSON.parse(await fs.readFile(ALLITEMS, "utf8"));

// Build a name→has-recipe set from the recipe shards.
const recipeFiles = (await fs.readdir(RECIPES_DIR))
  .filter((n) => n.endsWith(".json"))
  .sort();
const hasRecipeNames = new Set();
for (const f of recipeFiles) {
  const lst = JSON.parse(await fs.readFile(path.join(RECIPES_DIR, f), "utf8"));
  for (const r of lst) {
    for (const itemName of r.items) hasRecipeNames.add(itemName);
  }
}

const used = new Map();
const items = {};
const categoryCounts = Object.fromEntries(
  CATEGORY_MATCHERS.map(([slug]) => [slug, 0]),
);

for (const item of raw) {
  const base = slugify(item.Name);
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  const slug = n === 0 ? base : `${base}-${n + 1}`;

  const type = item.Type ?? "";
  const tier = type.startsWith("Resource ")
    ? extractResourceTier(type)
    : extractNameTier(item.Name);

  const entry = { n: item.Name, t: type };
  // OG route renders this verbatim. Apply the same 120-char ellipsis the
  // route used to do at request time, so the snapshot is render-ready.
  if (item.Description) {
    entry.d =
      item.Description.length > 120
        ? item.Description.slice(0, 117) + "…"
        : item.Description;
  }
  if (item.Level) entry.L = item.Level;
  if (tier !== null) entry.T = tier;
  if (item.Cost) entry.c = item.Cost;
  if (item.Rarity) entry.r = item.Rarity;
  if (hasRecipeNames.has(item.Name)) entry.k = 1;
  items[slug] = entry;

  for (const [catSlug, matches] of CATEGORY_MATCHERS) {
    if (matches(type)) {
      categoryCounts[catSlug] += 1;
      break;
    }
  }
}

await fs.writeFile(OUT, JSON.stringify({ items, categoryCounts }));
const sizeKB = (await fs.stat(OUT)).size / 1024;
console.log(
  `Wrote ${Object.keys(items).length} OG-snapshot entries to ${OUT} (${sizeKB.toFixed(
    1,
  )} KB)`,
);
console.log("  categoryCounts:", categoryCounts);
