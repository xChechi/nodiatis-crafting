# Data directory — navigation index

**Purpose:** Help anyone (human or agent) reading this folder land on what they need without slurping 4 MB of JSON into context.

## Files

| File | Size | Format | Read when |
|---|---|---|---|
| `_index.json` | ~80 KB | Slim per-item record (slug, name, category, type, rarity, tier, level, hasRecipe, image) | You need to look up "what items exist" or filter by category/rarity/level. **Start here.** |
| `items/{category}.json` | 100–400 KB each | Full item records for one category | You need full stats/description/etc for items in a specific category |
| `recipes/{itemType}.json` | varies | Full recipes for one itemType (e.g. `Arrow.json`, `Sword.json`) | You're working on a recipe-related feature |
| `allitems.json` | 1.7 MB | **DEPRECATED — kept only for scrapers/migration.** Single array of all 5,488 items. | Avoid. Use `_index.json` + `items/*.json` instead. |
| `recipes.json` | 2 MB | **DEPRECATED — kept only for migration.** Flat array of all 2,211 recipes. | Avoid. Use `recipes/*.json` instead. |
| `_app.js.ref` | 13 KB | Captured upstream JS reference from tools.nodiatis.com — context only, not used at runtime | Reading the upstream calculator's logic |
| `images/` | 28 MB, 1,711 files | Item artwork mirrored from tools.nodiatis.com. Gitignored — re-fetch via `python scripts/download_images.py` | Image processing |

## Categories (matches `web/src/lib/categories.ts`)

| Slug | Includes raw `Type` matching | Approx item count |
|---|---|---|
| `potions` | `Potion` | ~440 |
| `weapons` | `Weapon*`, `Archery*` | ~1100 |
| `armor` | `Armor*`, `Shield` | ~720 |
| `gems` | `Gem*` | ~200 |
| `pets` | `Pet`, `Pets` | ~140 |
| `tools` | `Tool*` | ~90 |
| `materials` | `Resource*` | ~1300 |
| `other` | everything else | ~1500 |

(Counts are approximate — query `_index.json` for current numbers.)

## Item shape

**Slim (`_index.json`)** — short keys, defaults omitted to keep the file small:

| Key | Field | Notes |
|---|---|---|
| `s` | slug | always present |
| `n` | name | always present |
| `c` | category | always present (one of the 8 slugs above) |
| `t` | type | always present (raw `Type` string) |
| `r` | rarity | omitted when `0` (Common); else 1=Uncommon, 2=Rare, 3=Epic, 4=Legendary |
| `T` | tier | only present when name contains `(T<n>)` |
| `L` | level | omitted when `0` |
| `k` | craftable | only present (and `true`) when item has a recipe |
| `i` | image | path under `images/`; omitted when no image |

```json
{"s":"algae-tipped-arrow","n":"Algae Tipped Arrow","c":"weapons",
 "t":"Archery (Arrow)","r":1,"L":11,"k":true,"i":"ex/weapons/weapon_24_5.png"}
```

**Full (`items/{category}.json`)** uses the original verbose `RawItem` shape (capitalized field names) and adds:
- `Cost`, `Resell`, `Weight`, `Damage`, `Description`
- `Energy`, `Mana`, `Delay`, `Accuracy`, `ArmorClass`
- `Stats`, `Virtues`, `RangeHaste`, `MaxArrowWeight`
- `Location`, `Prereq`, `LastSeen`
- `RecipeType` (the key into `recipes/*.json`)

## Recipe shape (`recipes/{itemType}.json`)

```json
{ "itemType": "Arrow", "rarity": 1, "level": 11, "cost": 1150,
  "items": ["Algae Tipped Arrow"],
  "consumable": [{"name": "Thistleberry Dye", "tier": 3, "qty": 1}, ...],
  "finished":  [{"name": "Thistleberries",   "tier": 3, "qty": 2}, ...] }
```

A recipe matches an item via `(itemType, rarity, level, cost) → recipe`.
Multiple items can share one recipe (~2,973 craftable items map to 2,211 unique recipes).

## How the web app consumes this

1. **`web/scripts/build-search-index.mjs`** reads `_index.json` → emits `web/src/data/searchIndex.json` (Fuse.js index)
2. **Server components** (e.g. `app/category/[slug]/page.tsx`) read only the relevant `items/{category}.json` + matching `recipes/*.json`
3. **Client components** receive items as props — they do **not** import the data files directly. A slim `web/src/data/clientIndex.json` covers cross-item lookups (mat-name → item link, "used in N recipes")

## Common tasks → which file to read

| Task | Read |
|---|---|
| "List all weapons" | `items/weapons.json` |
| "Find an item by slug" | `_index.json` (then read the matching category file if you need full data) |
| "What recipes use Cloth as a mat?" | grep across `recipes/*.json` |
| "What's the recipe for an Arrow at L11?" | `recipes/Arrow.json` (filter by `level==11, cost==1150`) |
| "Total item count" | `wc -l _index.json` ÷ ~1 (one entry per line) |
