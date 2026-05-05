// Generate a lightweight search index from allitems.json.
// Run via `npm run build:search-index` (or automatically via prebuild).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "src", "data", "allitems.json");
const OUT = path.join(ROOT, "src", "data", "searchIndex.json");

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

const raw = JSON.parse(await fs.readFile(SRC, "utf8"));

const used = new Map();
const index = raw.map((item) => {
  const base = slugify(item.Name);
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  const slug = count === 0 ? base : `${base}-${count + 1}`;
  return {
    slug,
    name: item.Name,
    type: item.Type,
    rarity: item.Rarity ?? 0,
  };
});

await fs.writeFile(OUT, JSON.stringify(index));
const sizeKB = (await fs.stat(OUT)).size / 1024;
console.log(`Wrote ${index.length} entries to ${OUT} (${sizeKB.toFixed(1)} KB)`);
