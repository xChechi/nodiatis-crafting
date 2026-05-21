#!/usr/bin/env node
/**
 * Append a monthly market-price reading to:
 *   - data/market-history.json   (full append-only log, keyed by item slug)
 *   - data/allitems.json         (per-item MarketHistory rolling cache, last 3)
 *
 * Usage:
 *   node scripts/market-append.mjs <YYYY-MM> < readings.tsv
 *
 * Input format (TSV on stdin), one line per item:
 *   Citrine Geode\t48
 *   Liliac Geode\t39
 *
 * After updating both JSON files, the script chains:
 *   python scripts/shard_data.py       (regenerates data/items/<cat>.json)
 *   node web/scripts/copy-sharded-data.mjs  (mirrors into web/src/data/)
 *
 * Exits non-zero if any input name does not resolve to an item.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const ALLITEMS = path.join(ROOT, "data", "allitems.json");
const HISTORY = path.join(ROOT, "data", "market-history.json");
const HISTORY_CAP = 3;

// Mirror of web/src/lib/slug.ts and web/scripts/build-item-index.mjs.
// Keep all four in sync (also: scripts/shard_data.py:slugify_name).
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

function die(msg) {
  console.error(`market-append: ${msg}`);
  process.exit(1);
}

const month = process.argv[2];
if (!month || !/^\d{4}-\d{2}$/.test(month)) {
  die("first argument must be a YYYY-MM month (e.g. 2026-05).");
}

const stdin = fs.readFileSync(0, "utf8").trim();
if (!stdin) die("no input on stdin. Pipe a TSV of '<Name>\\t<ask>' lines.");

const readings = stdin
  .split(/\r?\n/)
  .map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return null;
    const parts = trimmed.split("\t");
    if (parts.length !== 2) die(`line ${i + 1}: expected 'Name<TAB>ask', got '${trimmed}'.`);
    const name = parts[0].trim();
    const raw = parts[1].trim().replace(/[,\s]/g, "");
    const ask = Number(raw);
    if (!Number.isFinite(ask) || ask <= 0) {
      die(`line ${i + 1}: '${raw}' is not a positive number.`);
    }
    return { name, ask };
  })
  .filter(Boolean);

if (readings.length === 0) die("no readings parsed.");

const items = JSON.parse(fs.readFileSync(ALLITEMS, "utf8"));

// Build Name→item and Name→unique-slug maps in one pass, mirroring the
// collision handling in web/scripts/build-item-index.mjs.
const byName = new Map();
const slugByName = new Map();
const usedSlugs = new Map();
for (const it of items) {
  const base = slugify(it.Name);
  const n = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, n + 1);
  const unique = n === 0 ? base : `${base}-${n + 1}`;
  // exact-duplicate Names (e.g. "Monkey Tail" exists as Resource Fish AND
  // Trophy): prefer Resource items since this script captures market
  // material prices. A Trophy never enters the market.
  const existing = byName.get(it.Name);
  const itIsResource = (it.Type ?? "").startsWith("Resource ");
  const existingIsResource = (existing?.Type ?? "").startsWith("Resource ");
  if (!existing || (itIsResource && !existingIsResource)) {
    byName.set(it.Name, it);
    slugByName.set(it.Name, unique);
  }
}

const log = JSON.parse(fs.readFileSync(HISTORY, "utf8"));

let updated = 0;
const missing = [];
for (const { name, ask } of readings) {
  const item = byName.get(name);
  if (!item) {
    missing.push(name);
    continue;
  }
  const slug = slugByName.get(item.Name);
  // Update full log (newest first, dedupe same month if re-run).
  const entries = (log[slug] ?? []).filter((e) => e.month !== month);
  entries.unshift({ month, ask });
  log[slug] = entries;
  // Derive the rolling cache from the log so same-month re-runs stay in sync.
  item.MarketHistory = entries.slice(0, HISTORY_CAP).map((e) => e.ask);
  updated += 1;
}

if (missing.length) {
  die(`${missing.length} name(s) not found in allitems.json:\n  - ${missing.join("\n  - ")}`);
}

fs.writeFileSync(ALLITEMS, JSON.stringify(items, null, 2) + "\n", "utf8");
fs.writeFileSync(HISTORY, JSON.stringify(log, null, 2) + "\n", "utf8");

console.log(`Updated ${updated} item(s) for month ${month}.`);
console.log("Running shard_data.py …");
execSync("python scripts/shard_data.py", { stdio: "inherit", cwd: ROOT });
console.log("Running web/scripts/copy-sharded-data.mjs …");
execSync("node web/scripts/copy-sharded-data.mjs", { stdio: "inherit", cwd: ROOT });
console.log("Done.");
