# Market prices — design

**Date:** 2026-05-21
**Status:** approved, awaiting implementation plan
**Owner:** Stefan (Chechi)

## Problem

Today every material in `data/allitems.json` carries a `Cost` field with the scraped vendor cost — typically `4-6` gold for Tier 1-30 geodes. This is the wholesale NPC sell value and bears no relation to the real player-market price (real ask: 48g for T1 Citrine Geode, 1,516,807g for T30 Livmalign Geode).

The planner cost calculations and the per-tier cost sparkline both feed off `Cost` directly, so every "how much will it cost to craft X" number on the site is wildly wrong. Stefan wants the **real in-game market ask price** to drive every calculation and a **rolling history** of those prices over time so we can see how the market moves.

## Goals

1. Real market ask prices drive all crafting cost calculations on the site.
2. A rolling history of past readings is kept, browsable per item, never silently lost on re-scrape.
3. New readings can be captured monthly through a semi-automated Playwright flow (Stefan handles auth, Claude drives the in-game market UI and extracts prices).
4. The seed batch (30 geodes, May 2026) lands from manually-extracted screenshot data without needing the Playwright flow yet.

## Non-goals

- Real-time / hourly market scraping.
- Bid prices, spread analysis, liquidity metrics. Ask price only.
- Anything beyond materials in round 1 (gems, weapons, potions on the market come later if at all).
- Replacing the existing `Cost` field. It stays as a fallback for items with no market data.

## Architecture

Two storage layers, both checked into git. Three UI surfaces, each independent. One capture pipeline.

### Storage layer 1: per-item rolling cache

Add a `MarketHistory` field on materials in `data/allitems.json`. Rolling list of the last 3 ask readings, newest-first:

```json
{
  "Name": "Citrine Geode",
  "Cost": 4,
  "MarketHistory": [48, 47, 50],
  ...
}
```

Items with no market data omit the field entirely. This is a **derived cache** — it lives in `allitems.json` so it survives the existing shard pipeline (allitems → shard_data.py → data/items/materials.json → copy-sharded-data.mjs → web/src/data/items/materials.json) and reaches every read site without further plumbing.

### Storage layer 2: full history log

New file `data/market-history.json` keyed by item slug, append-only:

```json
{
  "citrine-geode": [
    { "month": "2026-05", "ask": 48 },
    { "month": "2026-04", "ask": 47 },
    { "month": "2026-03", "ask": 50 }
  ],
  "diamond-geode": [
    { "month": "2026-05", "ask": 30577 }
  ]
}
```

Read only by the item-detail "Price history" section and the `/market` page. The per-item `MarketHistory[0..2]` cache is just the head of this log for that slug.

### Calculation integration

New helper `web/src/lib/marketPrice.ts`:

```ts
export function currentMarketPrice(item: Item | null | undefined): number {
  return item?.MarketHistory?.[0] ?? item?.Cost ?? 0;
}
```

Patch two read sites:

- `web/src/lib/plannerActions.ts:106,133` — replace `matItem?.Cost ?? 0` with `currentMarketPrice(matItem)`
- `web/src/app/category/materials/[type]/page.tsx:14-15` — same swap in `buildTierCostPoints` (the per-tier sparkline source)

Existing planner manual override (`priceOverrides[name]`) stays on top of this chain: `priceOverrides[name] ?? currentMarketPrice(mat)`. Users can still override individual prices per planning session.

### UI surface 1 — inline sparkline in materials tables

New column on `web/src/components/ItemTable.tsx`, rendering a 3-point SVG fed by `MarketHistory`. Reuses the `TierCostSparkline` visual language (gold stroke, ~80×24 px). Items without history show "—". Hidden on small viewports to keep tables tight.

### UI surface 2 — full chart on item detail page

New "Price history" section on `web/src/app/items/[slug]/ItemDetailClient.tsx`, below the crafting trees. Line chart of the full timeline from `market-history.json` for this slug. Lazy-loaded (only the slice for this slug). Empty state: "No market data captured yet."

### UI surface 3 — dedicated /market page

New route `web/src/app/market/page.tsx`. Sortable table of all items with `MarketHistory`:

| Item | Tier | Current ask | Δ vs last month | Sparkline |

Sortable by tier / category / price / % change. Filterable by material family. Becomes the market overview entry point.

### Capture pipeline (monthly)

Semi-automated. Per month:

1. Stefan logs in to nodiatis.com in a Chromium that Playwright MCP can drive (Stefan does this so credentials never enter the prompt).
2. Stefan navigates to the in-game market once so the URL structure is captured; Claude records the navigation steps.
3. Claude drives Playwright through each material family (Geodes, Cloth, Thread, Dye, Leather, Ingot, Plank, Oil, plus base mats if marketable). Per family: screenshot listings, extract ask prices via vision into `{ slug → ask }` pairs.
4. Review step: Claude shows the parsed table; Stefan confirms or corrects outliers (stacked listings at inflated prices, etc.).
5. Append step: `node scripts/market-append.mjs <YYYY-MM>` reads the reviewed table and:
   - Appends each `{ month, ask }` to `data/market-history.json[slug]` (newest-first).
   - Updates `MarketHistory` on the matching entry in `data/allitems.json` (sliced to the latest 3).
   - Re-runs `python scripts/shard_data.py` + `npm run build:data` to propagate to `web/src/data/`.
   - Prints diff summary (added / changed / unchanged).

### Seed batch (May 2026)

The 30 geode ask prices Stefan provided in screenshots on 2026-05-21 are the first reading. Run `market-append.mjs 2026-05` once with this data, no Playwright needed for round 1. Source-of-truth for the values:

| Tier | Geode | Ask (g) |
|---|---|---|
| 1 | Citrine | 48 |
| 2 | Liliac | 39 |
| 3 | Coal | 39 |
| 4 | Quartz | 69 |
| 5 | Jonquil | 58 |
| 6 | Capri | 86 |
| 7 | Spotted Tabac | 114 |
| 8 | Apetite | 115 |
| 9 | Amethyst | 167 |
| 10 | Amazonite | 173 |
| 11 | Aquamarine | 186 |
| 12 | Coral | 256 |
| 13 | Lace Agate | 404 |
| 14 | Emerald | 411 |
| 15 | Firestone | 915 |
| 16 | Boreale | 638 |
| 17 | Volcano | 747 |
| 18 | Calcite Hive | 1,221 |
| 19 | Onyx | 2,855 |
| 20 | Chrysolite | 5,267 |
| 21 | Crystal | 5,669 |
| 22 | Erinite | 8,286 |
| 23 | Aquadepths | 14,748 |
| 24 | Diamond | 30,577 |
| 25 | Aurum | 60,325 |
| 26 | Nepherite | 121,839 |
| 27 | Labradorite | 239,577 |
| 28 | Suzulite | 415,911 |
| 29 | Temorite | 854,200 |
| 30 | Livmalign | 1,516,807 |

## Type changes

`web/src/lib/types.ts`: add `MarketHistory?: number[]` to the `Item` interface.

`scripts/shard_data.py`: no change. The shard step copies whatever fields are on the canonical record, so adding `MarketHistory` to `allitems.json` propagates automatically.

`web/src/lib/data.ts`: no change. The Item record passes through unchanged.

## Failure modes & fallbacks

- **Item with no market data:** `MarketHistory` field omitted. `currentMarketPrice()` falls back to `Cost`. Planner shows old default-ish numbers but at least doesn't crash. Inline sparkline column shows "—".
- **Item with only 1-2 readings:** sparkline still renders (degrades gracefully — 1 point = dot, 2 points = line segment).
- **Misextracted price during Playwright run:** the review step before commit is the safety net. If a price slips through, next month's reading prevails on the per-item cache; the bad reading stays visible only in the full history log (acceptable trade — better than silent loss).
- **Playwright session expires mid-capture:** abort the script, re-run after re-auth. Partial progress not persisted until the append step at the end.

## Testing

Unit tests:

- `marketPrice.test.ts` — fallback chain (`MarketHistory[0] → Cost → 0`), empty history, undefined item.
- `plannerActions.test.ts` (existing) — extend with a fixture item carrying `MarketHistory` and assert the planner uses it.

E2E smoke (Playwright):

- `/market` page loads, sparklines render for the 30 seeded geodes.
- An item detail page (e.g. Diamond Geode) shows the full history chart.
- Planner cost for a recipe that uses geodes reflects the new ask price.

## Out of scope (deferred)

- Bid prices, spread tracking, transaction volume.
- Marketplace UI for non-material items (gems on market, etc.).
- Multi-server / per-realm prices.
- Automated alerts on % change thresholds.
- Currency conversion (Nodiatis only has gold; no FX problem).

## Open questions

None blocking. Future iterations may revisit:

- Whether to expose the bid-ask spread once a few months of bid data exist (would require schema extension).
- Whether `MarketHistory` length should grow beyond 3 (currently capped to keep `allitems.json` lean).
