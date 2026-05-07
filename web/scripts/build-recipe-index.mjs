// Pre-compute the recipe lookup tables that data.ts otherwise rebuilds on
// every server cold-start. Reads sharded recipes/*.json (mirrored from
// /data/recipes by copy-sharded-data.mjs). data.ts loads this directly.
//
// The recipe arrays are loaded in the same per-file order data.ts uses,
// so emitted indices line up.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const RECIPES_DIR = path.join(ROOT, "src", "data", "recipes");
const OUT = path.join(ROOT, "src", "data", "recipeIndex.json");

const files = (await fs.readdir(RECIPES_DIR))
  .filter((n) => n.endsWith(".json"))
  .sort();

const recipes = [];
for (const f of files) {
  const lst = JSON.parse(await fs.readFile(path.join(RECIPES_DIR, f), "utf8"));
  recipes.push(...lst);
}

const recipeIdxByItemName = {};
for (let i = 0; i < recipes.length; i++) {
  for (const itemName of recipes[i].items) {
    recipeIdxByItemName[itemName] = i;
  }
}

const itemNamesByMaterialName = {};
for (const r of recipes) {
  for (const mat of r.finished) {
    if (!itemNamesByMaterialName[mat.name]) itemNamesByMaterialName[mat.name] = [];
    for (const itemName of r.items) {
      if (!itemNamesByMaterialName[mat.name].includes(itemName)) {
        itemNamesByMaterialName[mat.name].push(itemName);
      }
    }
  }
}

const payload = { recipeIdxByItemName, itemNamesByMaterialName };
await fs.writeFile(OUT, JSON.stringify(payload));
const sizeKB = (await fs.stat(OUT)).size / 1024;
console.log(
  `Wrote recipe index (${
    Object.keys(recipeIdxByItemName).length
  } recipe-by-name, ${
    Object.keys(itemNamesByMaterialName).length
  } material-back-refs) to ${OUT} (${sizeKB.toFixed(1)} KB)`,
);
