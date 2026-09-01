/*
 * Recipe computation for new items — companion to sync_mst.py.
 *
 * tools.nodiatis.com's recipe calculator went fully client-side: the page
 * at /calculators/recipe ships the whole algorithm (plus mats tables) as
 * inline JS. The old POST ?results-only endpoint now 405s. So instead of
 * scraping per-combo, this fetches the page once, extracts that script,
 * runs it in Node with a stubbed `document`, and computes every missing
 * (RecipeType, rarity, level, cost) combo locally.
 *
 * Validated against stored recipes (e.g. Rabid Bloodbond Aura) — output
 * is byte-identical to what scrape_recipes.py used to collect.
 *
 * Usage:  node scripts/compute_recipes.mjs [--dry-run]
 * Reads:  data/allitems.json, data/recipes.json
 * Writes: data/recipes.json (appends missing combos)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLITEMS = path.join(ROOT, 'data', 'allitems.json');
const RECIPES = path.join(ROOT, 'data', 'recipes.json');
const CALC_URL = 'https://tools.nodiatis.com/calculators/recipe';

const dryRun = process.argv.includes('--dry-run');

// Same rule as scrape_recipes.py: 'Foo }II{' etc. are uptier-only (no
// fresh recipe); 'Foo }I{' does get one.
const isUptierOnly = (name) => name.includes('{') && !name.includes('}I{');

const resp = await fetch(CALC_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (nodiacraft recipe sync)' } });
if (!resp.ok) throw new Error(`calculator page: HTTP ${resp.status}`);
const page = await resp.text();
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const calcSrc = scripts.reduce((a, b) => (a.length >= b.length ? a : b), '');
if (!calcSrc.includes('calculateRecipe')) throw new Error('calculateRecipe not found in page JS');

const form = {};
let resultsHtml = '';
globalThis.document = {
  getElementById(id) {
    return {
      get value() { return form[id]; },
      set value(v) { form[id] = v; },
      set innerHTML(html) { resultsHtml = html; },
      addEventListener() {},
    };
  },
  addEventListener() {},
};
globalThis.window = { location: { search: '' } };
// eslint-disable-next-line no-eval
const calculateRecipe = new Function(`${calcSrc}; return calculateRecipe;`)();

function grab(html, id) {
  const m = html.match(new RegExp(`<ul id="${id}">([\\s\\S]*?)</ul>`));
  if (!m) return null;
  const li = /<li>\s*(\d+)\s+(.+?)\s+\(T(\d+)\)\s*<\/li>/g;
  const mats = [];
  let mm;
  while ((mm = li.exec(m[1])) !== null) {
    mats.push({ name: mm[2].trim(), tier: Number(mm[3]), qty: Number(mm[1]) });
  }
  return mats;
}

const items = JSON.parse(fs.readFileSync(ALLITEMS, 'utf-8'));
const recipes = JSON.parse(fs.readFileSync(RECIPES, 'utf-8'));
const have = new Set(recipes.map((r) => `${r.itemType}|${r.rarity}|${r.level}|${r.cost}`));

const combos = new Map();
for (const item of items) {
  if (!item.RecipeType || isUptierOnly(item.Name)) continue;
  const key = `${item.RecipeType}|${item.Rarity ?? 0}|${item.Level ?? 0}|${item.Cost ?? 0}`;
  if (have.has(key)) continue;
  if (!combos.has(key)) {
    combos.set(key, {
      itemType: item.RecipeType, rarity: item.Rarity ?? 0,
      level: item.Level ?? 0, cost: item.Cost ?? 0, items: [],
    });
  }
  combos.get(key).items.push(item.Name);
}
console.log(`${combos.size} missing recipe combos`);

let ok = 0, fail = 0;
for (const combo of combos.values()) {
  form.itemType = combo.itemType;
  form.rarity = String(combo.rarity);
  form.level = String(combo.level);
  form.cost = String(combo.cost);
  resultsHtml = '';
  try {
    calculateRecipe();
  } catch (e) {
    console.log(`  FAIL ${combo.itemType} r${combo.rarity} L${combo.level} $${combo.cost} (${combo.items[0]}): ${e.message}`);
    fail += 1;
    continue;
  }
  const consumable = grab(resultsHtml, 'consumableUl');
  const finished = grab(resultsHtml, 'itemUl');
  if (!consumable || !finished || (consumable.length === 0 && finished.length === 0)) {
    console.log(`  no-mats ${combo.itemType} r${combo.rarity} L${combo.level} $${combo.cost} (${combo.items[0]})`);
    fail += 1;
    continue;
  }
  recipes.push({ ...combo, consumable, finished });
  ok += 1;
}
console.log(`computed ${ok}, failed/skipped ${fail}`);

if (!dryRun && ok > 0) {
  fs.writeFileSync(RECIPES, `${JSON.stringify(recipes, null, 2)}\n`);
  console.log(`wrote ${RECIPES} (${recipes.length} recipes)`);
}
