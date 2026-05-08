// Generate a lightweight search index from the sharded item files.
// Reads web/src/data/items/*.json (mirrored from /data/items by
// copy-sharded-data.mjs) — no monolithic allitems.json needed.
//
// Tags are extracted from each item's Description so users can search by
// spell mechanics (dot, heal, cure, aura, dd, ...) instead of just name.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const ITEMS_DIR = path.join(ROOT, "src", "data", "items");
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

// Spell-mechanic tag rules. Each rule: short tag → list of regex patterns to
// look for in the description. Order doesn't matter; tags are deduped.
// MUST stay in sync with web/src/lib/tags.ts. Tags are deliberately broad:
// granular CC (stun/blind/taunt/root/snare) → "debuff", protections
// (shield/absorb/resist) → "buff".
const TAG_RULES = [
  ["dd", [/\bdd\b/i, /direct damage/i, /\bnuke\b/i]],
  ["dot", [/\bdot\b/i, /damage over time/i]],
  [
    "heal",
    [
      /\bheal(?:s|ing|er)?\b/i,
      /\bregen(?:eration)?\b/i,
      /hitpoint heal/i,
      /\bcure(?:s)?\b/i,
      /removes?[^.]*\bdot/i,
    ],
  ],
  ["aura", [/\baura(?:s)?\b/i]],
  [
    "debuff",
    [
      /\bdebuff/i,
      /\btaunt\b/i,
      /forces[^.]*to target/i,
      /\bstun(?:s|ned)?\b/i,
      /\bblind(?:s|ness)?\b/i,
      /\broot(?:s|ed)?\b/i,
      /prevents?[^.]*escape/i,
      /immobiliz/i,
      /\bsnare(?:s|d)?\b/i,
      /\bslow(?:s|ed)?\b/i,
      /listless/i,
      /reduces?[^.]*regen/i,
      /weak(?:en|ness)/i,
    ],
  ],
  [
    "buff",
    [
      /\bbuff/i,
      /grants?[^.]*\bbonus/i,
      /increase(?:s|d)?[^.]*chance/i,
      /\babsorb(?:er|s)?\b/i,
      /damage absorber/i,
      /\bshield\b/i,
      /\bresistance\b/i,
      /\bresist(?:s|ant)?\b/i,
    ],
  ],
  ["mana", [/\bmana\b/i]],
  ["energy", [/\benergy\b/i]],
  ["arena", [/\barena\b/i]],
  ["pvp", [/\bpvp\b/i, /\bplayer vs/i]],
  ["xp", [/\bexp\b/i, /\bexperience\b/i, /\bxp\b/i]],
  ["recastable", [/\brecastable\b/i]],
];

function extractTags(description) {
  if (!description) return undefined;
  const tags = new Set();
  for (const [tag, patterns] of TAG_RULES) {
    if (patterns.some((p) => p.test(description))) tags.add(tag);
  }
  return tags.size > 0 ? Array.from(tags) : undefined;
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

const used = new Map();
let tagged = 0;
const index = raw.map((item) => {
  const base = slugify(item.Name);
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  const slug = count === 0 ? base : `${base}-${count + 1}`;
  const entry = {
    slug,
    name: item.Name,
    type: item.Type,
    rarity: item.Rarity ?? 0,
  };
  const tags = extractTags(item.Description);
  if (tags) {
    entry.tags = tags;
    tagged += 1;
  }
  return entry;
});

console.log(`Tagged ${tagged} of ${index.length} items with spell mechanics`);

await fs.writeFile(OUT, JSON.stringify(index));
const sizeKB = (await fs.stat(OUT)).size / 1024;
console.log(`Wrote ${index.length} entries to ${OUT} (${sizeKB.toFixed(1)} KB)`);
