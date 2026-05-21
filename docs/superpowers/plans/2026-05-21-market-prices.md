# Market Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder vendor `Cost` (4–6g) with real in-game market ask prices that drive every cost calculation, plus a rolling per-item history (last 3 readings inline) and a full per-slug history log behind a dedicated `/market` page and per-item charts.

**Architecture:** Two storage layers, both checked into git. (1) A per-item `MarketHistory: number[]` field on items in `data/allitems.json` — newest-first rolling cache of the last 3 ask prices, propagated through the existing shard + copy pipeline. (2) A new `data/market-history.json` keyed by item slug, append-only, one entry per monthly capture. A `currentMarketPrice(item)` helper centralises the fallback chain `MarketHistory[0] ?? Cost ?? 0` and is plugged into the two existing read sites (planner cost + tier-cost sparkline). New UI: inline 3-point sparkline column on materials tables, full chart section on item detail pages, dedicated `/market` overview route. A new `scripts/market-append.mjs` ingests monthly captures and rewrites both storage layers.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Vitest, Playwright (e2e). Node ≥ 22 (matches existing `web/scripts/*.mjs`). Python 3 for the existing `shard_data.py` shard step.

**Spec:** [`docs/superpowers/specs/2026-05-21-market-prices-design.md`](../specs/2026-05-21-market-prices-design.md)

---

## File Structure

**New files (created by this plan):**

| Path | Responsibility |
|---|---|
| `web/src/lib/marketPrice.ts` | `currentMarketPrice(item)` helper — single source of truth for the fallback chain |
| `web/src/lib/marketPrice.test.ts` | Unit tests for the helper |
| `web/src/lib/marketHistory.ts` | Server-side loader for `web/src/data/market-history.json`; `getHistoryForSlug(slug)` returns the entries newest-first |
| `web/src/lib/marketHistory.test.ts` | Unit tests for the loader (using a fixture) |
| `web/src/components/MarketSparkline.tsx` | Small inline SVG showing up to 3 points; used in materials tables |
| `web/src/components/MarketHistoryChart.tsx` | Full SVG line chart for the item detail page |
| `web/src/app/market/page.tsx` | Server component — collects all items with `MarketHistory`, passes to `MarketClient` |
| `web/src/app/market/MarketClient.tsx` | Client component — sortable/filterable table with inline sparklines |
| `data/market-history.json` | Canonical full history log, keyed by slug |
| `web/src/data/market-history.json` | Mirror of the canonical log (produced by `copy-sharded-data.mjs`) |
| `scripts/market-append.mjs` | Append script: reads stdin or a file, updates `data/allitems.json` + `data/market-history.json`, then runs `shard_data.py` + `web/npm run build:data` |

**Modified files:**

| Path | Change |
|---|---|
| `web/src/lib/types.ts` | Add `MarketHistory?: number[]` to `RawItem` (flows into `Item`) |
| `web/src/lib/plannerActions.ts` (L106, L133) | Replace `matItem?.Cost ?? 0` with `currentMarketPrice(matItem)` |
| `web/src/app/category/materials/[type]/page.tsx` (L10–20) | Replace `item.Cost` with `currentMarketPrice(item)` in `buildTierCostPoints` |
| `web/src/components/ItemTable.tsx` | Add a "Market" column between Cost and Weight showing current price + `MarketSparkline` |
| `web/src/app/items/[slug]/ItemDetailClient.tsx` | Insert a "Price history" section below the crafting trees |
| `web/scripts/copy-sharded-data.mjs` | Also copy `data/market-history.json` → `web/src/data/market-history.json` |
| `data/allitems.json` | Mutated by `market-append.mjs` (Task 8) — 30 geodes get `MarketHistory: [<ask>]` |

**Pattern note — keep things small:** The new files cap out at ~150 LOC. No file gains more than ~40 LOC. `MarketSparkline` and `MarketHistoryChart` are intentionally separate (different size, different responsibilities) — do not merge them. `marketPrice.ts` (pure helper) and `marketHistory.ts` (file I/O wrapper) are also kept separate so each one has a single reason to change.

---

## Task 1: Add `MarketHistory` to the item type

**Files:**
- Modify: `web/src/lib/types.ts:25` (insert after `LastSeen?`)

- [ ] **Step 1: Add the field to `RawItem`**

Open `web/src/lib/types.ts`. Inside the `RawItem` interface, after the `LastSeen?: string;` line, add:

```ts
  /** Rolling cache of the last 3 monthly market ask prices, newest first.
   * Maintained by scripts/market-append.mjs. Full timeline lives in
   * data/market-history.json. */
  MarketHistory?: number[];
```

`Item extends RawItem`, so no change needed there.

- [ ] **Step 2: Type-check the project**

Run from repo root:

```bash
cd web && npx tsc --noEmit
```

Expected: no errors. (We haven't added consumers yet, so nothing references the new field.)

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/types.ts
git commit -m "types: add MarketHistory rolling cache to RawItem"
```

---

## Task 2: `currentMarketPrice` helper with tests (TDD)

**Files:**
- Create: `web/src/lib/marketPrice.ts`
- Create: `web/src/lib/marketPrice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/marketPrice.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { currentMarketPrice } from "./marketPrice";
import type { Item } from "./types";

function fakeItem(over: Partial<Item>): Item {
  return {
    Name: "x",
    Type: "Resource (Geode Tier 1)",
    Rarity: 0,
    Cost: 0,
    slug: "x",
    rarityLabel: "Common",
    imageUrl: null,
    tier: 1,
    tags: [],
    recipe: null,
    usedInSlugs: [],
    ...over,
  };
}

describe("currentMarketPrice", () => {
  test("returns the newest entry from MarketHistory when present", () => {
    const item = fakeItem({ Cost: 4, MarketHistory: [48, 47, 50] });
    expect(currentMarketPrice(item)).toBe(48);
  });

  test("falls back to Cost when MarketHistory is missing", () => {
    const item = fakeItem({ Cost: 5, MarketHistory: undefined });
    expect(currentMarketPrice(item)).toBe(5);
  });

  test("falls back to Cost when MarketHistory is an empty array", () => {
    const item = fakeItem({ Cost: 5, MarketHistory: [] });
    expect(currentMarketPrice(item)).toBe(5);
  });

  test("returns 0 when neither MarketHistory nor Cost is set", () => {
    const item = fakeItem({ Cost: undefined, MarketHistory: undefined });
    expect(currentMarketPrice(item)).toBe(0);
  });

  test("handles a null/undefined item gracefully", () => {
    expect(currentMarketPrice(null)).toBe(0);
    expect(currentMarketPrice(undefined)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run from `web/`:

```bash
npx vitest run src/lib/marketPrice.test.ts
```

Expected: FAIL — `Cannot find module './marketPrice'`.

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/lib/marketPrice.ts`:

```ts
import type { Item } from "./types";

/**
 * Resolve the price to use for cost calculations.
 *
 * Order of precedence:
 *   1. MarketHistory[0] — the most recent monthly ask reading
 *   2. Cost              — the scraped vendor cost (legacy placeholder for items without market data)
 *   3. 0                 — caller is responsible for treating 0 as "unknown"
 */
export function currentMarketPrice(item: Item | null | undefined): number {
  if (!item) return 0;
  const latest = item.MarketHistory?.[0];
  if (typeof latest === "number" && latest > 0) return latest;
  return item.Cost ?? 0;
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run src/lib/marketPrice.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/marketPrice.ts web/src/lib/marketPrice.test.ts
git commit -m "feat(market): currentMarketPrice helper with fallback to Cost"
```

---

## Task 3: Wire the helper into the planner

**Files:**
- Modify: `web/src/lib/plannerActions.ts:106, 133`

- [ ] **Step 1: Patch the aggregate cost line**

Open `web/src/lib/plannerActions.ts`. At the top of the file, add the import (alongside existing imports):

```ts
import { currentMarketPrice } from "./marketPrice";
```

Then change line 106 from:

```ts
    const unitCost = matItem?.Cost ?? 0;
```

to:

```ts
    const unitCost = currentMarketPrice(matItem);
```

- [ ] **Step 2: Patch the per-item subtotal line**

In the same file, change line 133 from:

```ts
      const unitCost = matItem?.Cost ?? 0;
```

to:

```ts
      const unitCost = currentMarketPrice(matItem);
```

- [ ] **Step 3: Run the planner tests**

There is no `plannerActions.test.ts` today — the planner is exercised indirectly. Run the full test suite from `web/`:

```bash
npx vitest run
```

Expected: every existing test still passes. (None reference `Cost` semantics directly; the helper preserves the previous behaviour for items without `MarketHistory`.)

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/plannerActions.ts
git commit -m "feat(planner): use currentMarketPrice for cost aggregation"
```

---

## Task 4: Wire the helper into the per-tier sparkline

**Files:**
- Modify: `web/src/app/category/materials/[type]/page.tsx:10-20`

- [ ] **Step 1: Patch `buildTierCostPoints`**

Open `web/src/app/category/materials/[type]/page.tsx`. Add the import (after the existing `import type { Item } from "@/lib/types";` line):

```ts
import { currentMarketPrice } from "@/lib/marketPrice";
```

Replace the `buildTierCostPoints` function (lines 10–20) with:

```ts
function buildTierCostPoints(items: Item[]): Array<{ tier: number; cost: number }> {
  const byTier = new Map<number, number>();
  for (const item of items) {
    if (item.tier === null) continue;
    const cost = currentMarketPrice(item);
    if (cost <= 0) continue;
    if (!byTier.has(item.tier)) byTier.set(item.tier, cost);
  }
  return Array.from(byTier.entries())
    .map(([tier, cost]) => ({ tier, cost }))
    .sort((a, b) => a.tier - b.tier);
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/category/materials/[type]/page.tsx
git commit -m "feat(materials): per-tier sparkline reflects market price"
```

---

## Task 5: Extend `copy-sharded-data.mjs` to mirror `market-history.json`

**Files:**
- Modify: `web/scripts/copy-sharded-data.mjs`

- [ ] **Step 1: Add the single-file copy step**

Open `web/scripts/copy-sharded-data.mjs`. After the two `await copyDir(...)` calls at the bottom, append:

```js
// Single-file mirror — market history log is not shardable, so it lives
// at data/market-history.json (root) and we mirror it whole into web/src/data/.
const HISTORY_SRC = path.join(SRC_DATA, "market-history.json");
const HISTORY_DST = path.join(DST_DATA, "market-history.json");
try {
  await fs.access(HISTORY_SRC);
  await fs.copyFile(HISTORY_SRC, HISTORY_DST);
  const stat = await fs.stat(HISTORY_DST);
  console.log(`Mirrored market-history.json (${(stat.size / 1024).toFixed(1)} KB)`);
} catch (err) {
  if (err.code === "ENOENT") {
    console.log("Skipping market-history.json — source not present yet.");
  } else {
    throw err;
  }
}
```

- [ ] **Step 2: Smoke the script**

From `web/`:

```bash
node scripts/copy-sharded-data.mjs
```

Expected output ends with `Skipping market-history.json — source not present yet.` (we haven't created it yet).

- [ ] **Step 3: Commit**

```bash
git add web/scripts/copy-sharded-data.mjs
git commit -m "build: mirror data/market-history.json into web/src/data/"
```

---

## Task 6: Seed an empty `market-history.json` and verify the mirror

**Files:**
- Create: `data/market-history.json`

- [ ] **Step 1: Create the canonical empty file**

Create `data/market-history.json` with exactly:

```json
{}
```

(Yes, two characters plus a trailing newline.)

- [ ] **Step 2: Re-run the copy step**

From `web/`:

```bash
node scripts/copy-sharded-data.mjs
```

Expected output now includes `Mirrored market-history.json (0.0 KB)` (or similar tiny size). Verify the mirror exists:

```bash
ls web/src/data/market-history.json
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add data/market-history.json web/src/data/market-history.json
git commit -m "feat(market): seed empty market-history.json log"
```

---

## Task 7: `scripts/market-append.mjs` — the capture sink

**Files:**
- Create: `scripts/market-append.mjs`

- [ ] **Step 1: Write the script**

Create `scripts/market-append.mjs`:

```js
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

// Mirror of scripts/shard_data.py:slugify_name and web/src/lib/slug.ts.
// Keep all three in sync.
function slugify(name) {
  let out = name.toLowerCase();
  for (const ch of "}{") out = out.split(ch).join("-");
  const repl = { é: "e", è: "e", à: "a", â: "a", ñ: "n" };
  for (const [s, d] of Object.entries(repl)) out = out.split(s).join(d);
  out = out.replace(/[^a-z0-9]+/g, "-");
  return out.replace(/^-+|-+$/g, "");
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
    const ask = Number(parts[1].replace(/[, ]/g, ""));
    if (!Number.isFinite(ask) || ask <= 0) {
      die(`line ${i + 1}: '${parts[1]}' is not a positive number.`);
    }
    return { name, ask };
  })
  .filter(Boolean);

if (readings.length === 0) die("no readings parsed.");

const items = JSON.parse(fs.readFileSync(ALLITEMS, "utf8"));
const byName = new Map(items.map((it) => [it.Name, it]));

const log = JSON.parse(fs.readFileSync(HISTORY, "utf8"));

let updated = 0;
const missing = [];
for (const { name, ask } of readings) {
  const item = byName.get(name);
  if (!item) {
    missing.push(name);
    continue;
  }
  const slug = slugify(item.Name);
  // Update full log (newest first, dedupe same month if re-run).
  const entries = (log[slug] ?? []).filter((e) => e.month !== month);
  entries.unshift({ month, ask });
  log[slug] = entries;
  // Update per-item rolling cache (newest first, cap to HISTORY_CAP).
  const cache = [ask, ...(item.MarketHistory ?? []).filter((_, i) => i < HISTORY_CAP - 1)];
  item.MarketHistory = cache.slice(0, HISTORY_CAP);
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
```

- [ ] **Step 2: Smoke the script with an empty stdin (should fail cleanly)**

```bash
echo "" | node scripts/market-append.mjs 2026-05
```

Expected exit code non-zero, message `market-append: no readings parsed.`.

- [ ] **Step 3: Smoke the script with a missing item name (should fail cleanly)**

```bash
printf "No Such Item\t100\n" | node scripts/market-append.mjs 2026-05
```

Expected exit code non-zero, message `... 1 name(s) not found in allitems.json ...`. Verify that `data/allitems.json` and `data/market-history.json` are UNCHANGED (`git diff data/` is clean).

- [ ] **Step 4: Commit**

```bash
git add scripts/market-append.mjs
git commit -m "feat(market): scripts/market-append.mjs ingests monthly readings"
```

---

## Task 8: Seed the May 2026 reading (30 geodes)

**Files:**
- Modify: `data/allitems.json` (via the script)
- Modify: `data/market-history.json` (via the script)
- Generated: `data/items/materials.json`, `web/src/data/items/materials.json`, `web/src/data/market-history.json`

- [ ] **Step 1: Create a temporary TSV with the May 2026 ask prices**

Write a file `/tmp/seed-2026-05.tsv` (or `%TEMP%\seed-2026-05.tsv` on Windows) with exactly these 30 lines (single tab between Name and price; no trailing whitespace):

```
Citrine Geode	48
Liliac Geode	39
Coal Geode	39
Quartz Geode	69
Jonquil Geode	58
Capri Geode	86
Spotted Tabac Geode	114
Apetite Geode	115
Amethyst Geode	167
Amazonite Geode	173
Aquamarine Geode	186
Coral Geode	256
Lace Agate Geode	404
Emerald Geode	411
Firestone Geode	915
Boreale Geode	638
Volcano Geode	747
Calcite Hive Geode	1221
Onyx Geode	2855
Chrysolite Geode	5267
Crystal Geode	5669
Erinite Geode	8286
Aquadepths Geode	14748
Diamond Geode	30577
Aurum Geode	60325
Nepherite Geode	121839
Labradorite Geode	239577
Suzulite Geode	415911
Temorite Geode	854200
Livmalign Geode	1516807
```

- [ ] **Step 2: Run the append script**

From the repo root (`nodiatis-crafting/`):

```bash
node scripts/market-append.mjs 2026-05 < /tmp/seed-2026-05.tsv
```

(Windows PowerShell: `Get-Content $env:TEMP\seed-2026-05.tsv | node scripts/market-append.mjs 2026-05`.)

Expected output ends with `Done.`, with `Updated 30 item(s) for month 2026-05.` near the top.

- [ ] **Step 3: Verify the data shape**

```bash
node -e "const d=require('./data/allitems.json'); const g=d.find(i=>i.Name==='Diamond Geode'); console.log(JSON.stringify(g, null, 2));"
```

Expected: the `Diamond Geode` record now has `"MarketHistory": [30577]`.

```bash
node -e "const h=require('./data/market-history.json'); console.log(h['diamond-geode']);"
```

Expected: `[ { month: '2026-05', ask: 30577 } ]`.

```bash
node -e "const d=require('./web/src/data/items/materials.json'); const g=d.find(i=>i.Name==='Diamond Geode'); console.log(g.MarketHistory);"
```

Expected: `[ 30577 ]` (proves the shard + copy pipeline carried the field through).

- [ ] **Step 4: Verify the planner numbers update**

Start the dev server (`cd web && npm run dev`), open the planner, add any recipe that uses geode materials (e.g. an epic gem). The cost-summary line should now show realistic numbers (tens of thousands of gold rather than single digits).

- [ ] **Step 5: Commit**

```bash
git add data/allitems.json data/market-history.json data/items/materials.json web/src/data/items/materials.json web/src/data/market-history.json
git commit -m "data(market): seed May 2026 geode ask prices (30 entries)"
```

Discard the temp TSV — it does not belong in git.

---

## Task 9: `MarketSparkline` mini component

**Files:**
- Create: `web/src/components/MarketSparkline.tsx`

- [ ] **Step 1: Write the component**

Create `web/src/components/MarketSparkline.tsx`:

```tsx
/**
 * Inline mini sparkline for the rolling MarketHistory cache (up to 3 points).
 * Newest value is on the RIGHT (chronological reading order).
 *
 * Visual language mirrors TierCostSparkline: gold stroke on bg-2.
 */
interface MarketSparklineProps {
  /** Newest-first array of up to 3 ask prices, as stored on Item.MarketHistory. */
  history: number[] | undefined;
  width?: number;
  height?: number;
}

const DEFAULT_W = 64;
const DEFAULT_H = 20;
const PAD = 2;

export function MarketSparkline({
  history,
  width = DEFAULT_W,
  height = DEFAULT_H,
}: MarketSparklineProps) {
  if (!history || history.length === 0) {
    return <span className="text-[var(--color-fg-3)] font-mono text-xs">—</span>;
  }

  // Reverse to plot oldest-on-left, newest-on-right.
  const series = [...history].reverse();
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(1, max - min);

  const xStep = series.length === 1 ? 0 : (width - PAD * 2) / (series.length - 1);
  const points = series.map((v, i) => {
    const x = PAD + xStep * i;
    const y = height - PAD - ((v - min) / span) * (height - PAD * 2);
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];
  const trendUp = series.length >= 2 && series[series.length - 1] > series[0];
  const trendColor = trendUp
    ? "var(--color-rose)"
    : series.length >= 2 && series[series.length - 1] < series[0]
      ? "var(--color-emerald)"
      : "var(--color-gold)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Last ${series.length} market reading${series.length === 1 ? "" : "s"}: ${series.join(", ")} gold`}
      className="inline-block align-middle"
    >
      {series.length === 1 ? (
        <circle cx={width / 2} cy={height / 2} r={2} fill={trendColor} />
      ) : (
        <polyline
          points={polyline}
          fill="none"
          stroke={trendColor}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {series.length >= 2 && (
        <circle cx={last.x} cy={last.y} r={1.75} fill={trendColor} />
      )}
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MarketSparkline.tsx
git commit -m "feat(market): MarketSparkline mini inline component"
```

---

## Task 10: Add the "Market" column to `ItemTable`

**Files:**
- Modify: `web/src/components/ItemTable.tsx`

- [ ] **Step 1: Import the helper and the component**

Open `web/src/components/ItemTable.tsx`. After the existing `import type` lines (around line 10), add:

```tsx
import { currentMarketPrice } from "@/lib/marketPrice";
import { MarketSparkline } from "./MarketSparkline";
```

- [ ] **Step 2: Compute whether any item has market data**

Inside the `ItemTable` function, alongside the existing `hasDamage`, `hasArmor`, etc. computations (around line 75), add:

```tsx
  const hasMarket = items.some((i) => (i.MarketHistory?.length ?? 0) > 0);
```

- [ ] **Step 3: Add the table header column**

In the desktop `<thead>` block (around line 98), insert a new `<th>` immediately after the Cost `SortableHeader`:

```tsx
              {hasMarket && (
                <th className="text-right p-2 w-32 uppercase tracking-wider text-[10px] text-[var(--color-fg-3)]">
                  Market
                </th>
              )}
```

(No sort for now — market price is rendered alongside the sparkline; sorting by market price will come on the dedicated `/market` page in Task 14.)

- [ ] **Step 4: Add the corresponding `<td>` body cell**

Inside the row body, immediately after the Cost `<td>` (around line 176), insert:

```tsx
                {hasMarket && (
                  <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs whitespace-nowrap">
                    {(() => {
                      const price = currentMarketPrice(item);
                      const hasHistory = (item.MarketHistory?.length ?? 0) > 0;
                      if (!hasHistory) {
                        return <span className="text-[var(--color-fg-3)]">—</span>;
                      }
                      return (
                        <span className="inline-flex items-center gap-2 justify-end">
                          <span>{price.toLocaleString("en-US")}</span>
                          <MarketSparkline history={item.MarketHistory} />
                        </span>
                      );
                    })()}
                  </td>
                )}
```

- [ ] **Step 5: Run the dev server and eyeball it**

```bash
cd web && npm run dev
```

Open `http://localhost:3000/category/materials/geode` and confirm:
- A "Market" column appears between Cost and Weight.
- Each of the 30 geode rows shows a price (e.g. 48, 39, 30,577) followed by a single-dot sparkline (only 1 reading).
- Non-geode material pages (e.g. `/category/materials/bone`) do NOT show the column (because `hasMarket === false`).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/ItemTable.tsx
git commit -m "feat(market): Market column with inline sparkline in ItemTable"
```

---

## Task 11: `marketHistory.ts` server loader

**Files:**
- Create: `web/src/lib/marketHistory.ts`
- Create: `web/src/lib/marketHistory.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/marketHistory.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach } from "vitest";

vi.mock("@/data/market-history.json", () => ({
  default: {
    "diamond-geode": [
      { month: "2026-05", ask: 30577 },
      { month: "2026-04", ask: 28500 },
    ],
    "citrine-geode": [{ month: "2026-05", ask: 48 }],
  },
}));

import { getHistoryForSlug, getAllSlugsWithHistory } from "./marketHistory";

describe("marketHistory", () => {
  test("returns the history entries newest-first for a known slug", () => {
    expect(getHistoryForSlug("diamond-geode")).toEqual([
      { month: "2026-05", ask: 30577 },
      { month: "2026-04", ask: 28500 },
    ]);
  });

  test("returns an empty array for an unknown slug", () => {
    expect(getHistoryForSlug("nonexistent-item")).toEqual([]);
  });

  test("getAllSlugsWithHistory lists every slug that has at least one reading", () => {
    expect(getAllSlugsWithHistory().sort()).toEqual([
      "citrine-geode",
      "diamond-geode",
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd web && npx vitest run src/lib/marketHistory.test.ts
```

Expected: FAIL — `Cannot find module './marketHistory'`.

- [ ] **Step 3: Write the implementation**

Create `web/src/lib/marketHistory.ts`:

```ts
import historyJson from "@/data/market-history.json";

export interface PriceReading {
  /** ISO month, e.g. "2026-05". */
  month: string;
  /** Ask price in gold at capture time. */
  ask: number;
}

type HistoryLog = Record<string, PriceReading[]>;

// The JSON import is `unknown` at compile time; cast once at the boundary.
const log = historyJson as unknown as HistoryLog;

/** Full history (newest first) for a slug; empty array if no readings exist. */
export function getHistoryForSlug(slug: string): PriceReading[] {
  return log[slug] ?? [];
}

/** Every slug that has at least one reading. Unordered. */
export function getAllSlugsWithHistory(): string[] {
  return Object.keys(log).filter((k) => (log[k]?.length ?? 0) > 0);
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npx vitest run src/lib/marketHistory.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/marketHistory.ts web/src/lib/marketHistory.test.ts
git commit -m "feat(market): marketHistory loader and lookup helpers"
```

---

## Task 12: `MarketHistoryChart` full chart component

**Files:**
- Create: `web/src/components/MarketHistoryChart.tsx`

- [ ] **Step 1: Write the component**

Create `web/src/components/MarketHistoryChart.tsx`:

```tsx
import type { PriceReading } from "@/lib/marketHistory";

interface MarketHistoryChartProps {
  /** Newest-first as returned by getHistoryForSlug. */
  readings: PriceReading[];
}

const WIDTH = 560;
const HEIGHT = 180;
const PAD_X = 40;
const PAD_Y = 20;

export function MarketHistoryChart({ readings }: MarketHistoryChartProps) {
  if (readings.length === 0) {
    return (
      <div className="text-sm text-[var(--color-fg-3)] italic">
        No market data captured yet.
      </div>
    );
  }

  // Oldest on the left.
  const series = [...readings].reverse();
  const prices = series.map((r) => r.ask);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1, max - min);

  const xStep =
    series.length === 1 ? 0 : (WIDTH - PAD_X * 2) / (series.length - 1);

  const points = series.map((r, i) => {
    const x = PAD_X + xStep * i;
    const y = HEIGHT - PAD_Y - ((r.ask - min) / span) * (HEIGHT - PAD_Y * 2);
    return { x, y, ...r };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`Price history with ${series.length} reading${series.length === 1 ? "" : "s"}`}
      >
        {/* y-axis labels */}
        <text x={4} y={PAD_Y + 4} fontSize={10} fill="var(--color-fg-3)">
          {max.toLocaleString("en-US")}
        </text>
        <text x={4} y={HEIGHT - PAD_Y + 4} fontSize={10} fill="var(--color-fg-3)">
          {min.toLocaleString("en-US")}
        </text>
        {/* line */}
        {series.length === 1 ? (
          <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={3} fill="var(--color-gold)" />
        ) : (
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* points + month labels */}
        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={p.x} cy={p.y} r={2.5} fill="var(--color-gold)">
              <title>{`${p.month}: ${p.ask.toLocaleString("en-US")}g`}</title>
            </circle>
            {(i === 0 || i === points.length - 1) && (
              <text
                x={p.x}
                y={HEIGHT - 4}
                fontSize={10}
                fill="var(--color-fg-3)"
                textAnchor={i === 0 ? "start" : "end"}
              >
                {p.month}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MarketHistoryChart.tsx
git commit -m "feat(market): MarketHistoryChart full SVG line chart"
```

---

## Task 13: Add the "Price history" section to the item detail page

**Files:**
- Modify: `web/src/app/items/[slug]/ItemDetailClient.tsx` (or the surrounding server page if data must be loaded server-side)

- [ ] **Step 1: Locate the right insertion point**

Open `web/src/app/items/[slug]/ItemDetailClient.tsx` and skim it. Note where the two crafting trees end (look for the closing element of the "consumable / other mats" two-column block). The new section goes **immediately after** that block.

If `ItemDetailClient.tsx` is a `"use client"` component, the history must come from a prop, not from importing `marketHistory.ts` directly. In that case:

  (a) Open the parent server page: `web/src/app/items/[slug]/page.tsx`.
  (b) Import the loader: `import { getHistoryForSlug } from "@/lib/marketHistory";`
  (c) Where the page renders `<ItemDetailClient ... />`, add a prop: `priceHistory={getHistoryForSlug(item.slug)}`.
  (d) In `ItemDetailClient.tsx`, add a typed prop `priceHistory: PriceReading[]` (import the type from `@/lib/marketHistory`).

If `ItemDetailClient.tsx` is already a server component (no `"use client"` at the top), you can call `getHistoryForSlug(item.slug)` directly inside it and skip the prop dance.

- [ ] **Step 2: Render the section**

Wherever you decided to render, insert:

```tsx
{priceHistory.length > 0 && (
  <section className="mt-8">
    <h2 className="text-lg font-semibold text-[var(--color-fg-1)] mb-3">
      Price history
    </h2>
    <MarketHistoryChart readings={priceHistory} />
  </section>
)}
```

(If you went the server-component route, replace `priceHistory` with `history` and compute it inline at the top of the component.)

Add the import at the top of the file (mirroring the file's import style):

```tsx
import { MarketHistoryChart } from "@/components/MarketHistoryChart";
```

And if you needed the type:

```tsx
import type { PriceReading } from "@/lib/marketHistory";
```

- [ ] **Step 3: Eyeball it in the dev server**

```bash
cd web && npm run dev
```

Visit `http://localhost:3000/items/diamond-geode`. Expected: a "Price history" heading appears below the crafting trees, with a small chart showing a single point at the May 2026 mark labelled with 30,577.

Visit `http://localhost:3000/items/mongoose-leg-bone` (or any item without market data). Expected: NO "Price history" section is rendered.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/items/[slug]/ItemDetailClient.tsx web/src/app/items/[slug]/page.tsx
git commit -m "feat(market): show price history on item detail page"
```

---

## Task 14: The `/market` overview page

**Files:**
- Create: `web/src/app/market/page.tsx`
- Create: `web/src/app/market/MarketClient.tsx`

- [ ] **Step 1: Write the server page**

Create `web/src/app/market/page.tsx`:

```tsx
import type { Metadata } from "next";
import { allItems } from "@/lib/data";
import { getAllSlugsWithHistory } from "@/lib/marketHistory";
import { currentMarketPrice } from "@/lib/marketPrice";
import { MarketClient, type MarketRow } from "./MarketClient";

export const metadata: Metadata = {
  title: "Market — Nodiatis Crafting",
  description:
    "Live in-game market ask prices across materials, with monthly history.",
  alternates: { canonical: "/market" },
};

function buildRows(): MarketRow[] {
  const slugsWithHistory = new Set(getAllSlugsWithHistory());
  return allItems()
    .filter((i) => slugsWithHistory.has(i.slug))
    .map((i) => {
      const history = i.MarketHistory ?? [];
      const current = currentMarketPrice(i);
      const previous = history.length >= 2 ? history[1] : null;
      const changePct =
        previous && previous > 0 ? ((current - previous) / previous) * 100 : null;
      return {
        slug: i.slug,
        name: i.Name,
        type: i.Type,
        tier: i.tier,
        imageUrl: i.imageUrl,
        current,
        history,
        changePct,
      };
    });
}

export default function MarketPage() {
  const rows = buildRows();
  return (
    <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
      <h1 className="text-2xl font-semibold mb-1 text-[var(--color-fg-1)]">Market</h1>
      <p className="text-sm text-[var(--color-fg-3)] mb-6">
        Latest in-game ask prices captured monthly. Click an item for the full
        history chart.
      </p>
      <MarketClient rows={rows} />
    </main>
  );
}
```

- [ ] **Step 2: Write the client component**

Create `web/src/app/market/MarketClient.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp } from "lucide-react";
import { MarketSparkline } from "@/components/MarketSparkline";

export interface MarketRow {
  slug: string;
  name: string;
  type: string;
  tier: number | null;
  imageUrl: string | null;
  current: number;
  history: number[];
  changePct: number | null;
}

type SortColumn = "name" | "tier" | "current" | "changePct";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortColumn; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Item", align: "left" },
  { key: "tier", label: "Tier", align: "right" },
  { key: "current", label: "Ask", align: "right" },
  { key: "changePct", label: "Δ vs last", align: "right" },
];

export function MarketClient({ rows }: { rows: MarketRow[] }) {
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir }>({
    column: "current",
    dir: "desc",
  });
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    const filtered = filter
      ? rows.filter((r) =>
          r.name.toLowerCase().includes(filter.toLowerCase()) ||
          r.type.toLowerCase().includes(filter.toLowerCase()),
        )
      : rows;
    const cmp = (a: MarketRow, b: MarketRow) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.column) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "tier":
          return ((a.tier ?? -1) - (b.tier ?? -1)) * dir;
        case "current":
          return (a.current - b.current) * dir;
        case "changePct":
          return ((a.changePct ?? 0) - (b.changePct ?? 0)) * dir;
      }
    };
    return [...filtered].sort(cmp);
  }, [rows, sort, filter]);

  function toggleSort(column: SortColumn) {
    setSort((s) =>
      s.column === column
        ? { column, dir: s.dir === "asc" ? "desc" : "asc" }
        : { column, dir: column === "name" || column === "tier" ? "asc" : "desc" },
    );
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Filter by name or type…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 w-full sm:w-80 px-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded text-sm"
      />
      <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-3)]">
            <tr>
              <th className="text-left p-2 w-12"></th>
              {COLUMNS.map((col) => {
                const active = sort.column === col.key;
                const Arrow = active && sort.dir === "desc" ? ArrowDown : ArrowUp;
                return (
                  <th
                    key={col.key}
                    className={`p-2 text-${col.align} uppercase tracking-wider text-[10px] text-[var(--color-fg-3)]`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : "justify-start"} w-full hover:text-[var(--color-fg-1)] transition-colors ${
                        active ? "text-[var(--color-gold)]" : ""
                      }`}
                    >
                      {col.label}
                      {active && <Arrow size={10} />}
                    </button>
                  </th>
                );
              })}
              <th className="p-2 text-right uppercase tracking-wider text-[10px] text-[var(--color-fg-3)] w-24">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.slug}
                className="border-t border-[var(--color-border)]/40 hover:bg-[var(--color-bg-3)] transition-colors [&>td]:py-3"
              >
                <td className="p-1">
                  <Link href={`/items/${row.slug}`} className="block">
                    <div className="w-9 h-9 bg-[var(--color-bg-3)] rounded flex items-center justify-center overflow-hidden">
                      {row.imageUrl ? (
                        <Image
                          src={row.imageUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="object-contain max-w-full max-h-full"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[8px] text-[var(--color-fg-3)] font-mono">--</span>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <Link
                    href={`/items/${row.slug}`}
                    className="text-[var(--color-fg-1)] hover:text-[var(--color-gold)]"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs">
                  {row.tier !== null ? `T${row.tier}` : "—"}
                </td>
                <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs">
                  {row.current.toLocaleString("en-US")}
                </td>
                <td className="p-2 text-right font-mono text-xs">
                  {row.changePct === null ? (
                    <span className="text-[var(--color-fg-3)]">—</span>
                  ) : (
                    <span
                      className={
                        row.changePct > 0
                          ? "text-[var(--color-rose)]"
                          : row.changePct < 0
                            ? "text-[var(--color-emerald)]"
                            : "text-[var(--color-fg-3)]"
                      }
                    >
                      {row.changePct > 0 ? "+" : ""}
                      {row.changePct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="p-2 text-right">
                  <MarketSparkline history={row.history} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Eyeball it**

```bash
cd web && npm run dev
```

Visit `http://localhost:3000/market`. Expected:
- A page titled "Market" with a filter box and a sortable table.
- 30 rows (the seeded geodes), default-sorted by Ask descending — Livmalign Geode at the top with 1,516,807.
- The "Δ vs last" column shows "—" for every row (only one reading exists so far).
- Clicking any column header re-sorts the table.
- Typing "diamond" in the filter narrows to one row.
- Clicking a row navigates to that item's detail page (where the Price history chart lives).

- [ ] **Step 4: Commit**

```bash
git add web/src/app/market/
git commit -m "feat(market): /market overview page with sortable table and sparklines"
```

---

## Task 15: E2E smoke + final verification

**Files:**
- Modify: existing e2e test directory under `web/tests/` (find the smoke-test file; the project uses Playwright per `web/package.json`)

- [ ] **Step 1: Locate the e2e file**

From `web/`:

```bash
ls tests/
```

Add an `e2e/market.spec.ts` file (or whatever convention the existing tests follow — match the naming you find).

- [ ] **Step 2: Write the smoke test**

Create `web/tests/e2e/market.spec.ts` (adjust path to match the existing convention):

```ts
import { test, expect } from "@playwright/test";

test("market page lists the seeded geodes and links to detail", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: "Market" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Diamond Geode/ })).toBeVisible();
  await expect(page.getByText("30,577")).toBeVisible();
});

test("item detail page shows price history for a seeded item", async ({ page }) => {
  await page.goto("/items/diamond-geode");
  await expect(page.getByRole("heading", { name: "Price history" })).toBeVisible();
});

test("item detail page omits price history for an item without market data", async ({ page }) => {
  // Pick any non-geode material item that exists in the data set.
  await page.goto("/items/silk-tier-1");
  await expect(page.getByRole("heading", { name: "Price history" })).not.toBeVisible();
});
```

(If `silk-tier-1` is not the actual slug, swap it for any base-material slug you can verify exists with `node -e "const i=require('./web/src/data/items/materials.json'); console.log(i.filter(x=>x.Type.startsWith('Resource (Silk')).map(x=>x.Name))"`.)

- [ ] **Step 3: Run the e2e tests**

```bash
cd web && npx playwright test e2e/market.spec.ts
```

Expected: 3 tests pass.

- [ ] **Step 4: Run the full unit suite as a last gate**

```bash
cd web && npx vitest run
```

Expected: every test passes (including the new `marketPrice` and `marketHistory` tests).

- [ ] **Step 5: Final manual eyeball**

Start the dev server (`cd web && npm run dev`) and verify each of:
- `/category/materials/geode` — per-tier sparkline now climbs sharply (T1=48 → T30=1.5M) and the table has a "Market" column.
- `/category/materials/bone` (or any base material with no `MarketHistory`) — table renders normally, no "Market" column.
- `/items/diamond-geode` — "Price history" section renders below the crafting trees, showing one point at 30,577.
- `/items/citrine-geode` — same, one point at 48.
- `/items/mongoose-leg-bone` (or any non-market item) — no "Price history" section.
- `/market` — sortable table with all 30 geodes; filter works; sparklines render.
- `/planner` — add any recipe that uses geodes; cost summary uses the real prices.

- [ ] **Step 6: Commit**

```bash
git add web/tests/
git commit -m "test(market): e2e smoke for /market and item detail history"
```

- [ ] **Step 7: Push**

```bash
git push origin main
```

Vercel preview build will run automatically — verify it goes green and the live site reflects the changes.

---

## Self-review

**Spec coverage:**
- Storage layer 1 (`MarketHistory` on items) — Task 1 (type) + Task 8 (seed).
- Storage layer 2 (`market-history.json`) — Task 6 (seed empty) + Task 8 (populate).
- `currentMarketPrice` helper — Task 2.
- Planner read site swap — Task 3.
- Tier-cost sparkline read site swap — Task 4.
- Inline sparkline in materials tables — Task 9 + Task 10.
- Item detail "Price history" section — Task 11 (loader) + Task 12 (chart) + Task 13 (wire-in).
- `/market` route — Task 14.
- `market-append.mjs` script — Task 7.
- Build-pipeline mirroring of the new JSON — Task 5.
- Seed batch of 30 May 2026 geode prices — Task 8.
- Unit tests — Task 2, Task 11. E2E smoke — Task 15.

**Placeholder scan:** No "TBD" or "implement later" references remain. Every code step contains complete, copy-pasteable code. The one place the plan asks the engineer to make a judgement call — Task 13 step 1 (server vs client component routing for the detail page) — provides both branches with concrete instructions, so it is not a placeholder.

**Type consistency:** `currentMarketPrice(item)` consistently named throughout. `MarketHistory: number[]` consistently named. `PriceReading = { month: string; ask: number }` defined in Task 11 and reused in Task 12 + Task 13 + Task 14 (via `MarketRow`). `getHistoryForSlug(slug)` and `getAllSlugsWithHistory()` defined in Task 11 and used in Task 13 + Task 14. No drift.
