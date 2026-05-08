# Nodiatis Wiki & Crafting Calculator

A modern, fast, searchable wiki + crafting planner for the [Nodiatis MMORPG](https://www.nodiatis.com/) — built to replace the unusable 6,000-row table at `tools.nodiatis.com` with proper navigation, recipe pages, favorites, and an aggregated crafting planner.

**Live:** [nodiatis-crafting.vercel.app](https://nodiatis-crafting.vercel.app)

## What it does

- 📚 **Wiki** — Browse 5,488 items by category (Potions, Weapons, Armor, Gems, Pets, Tools, Materials, Other) with per-category landings, sort, and chip filters
- 🔍 **Global search** — `⌘K` / `Ctrl+K` opens an instant fuzzy-match dialog; `/search` is a full-page version
- 📜 **Item pages** — Stats, recipe (consumable + full base-mat breakdown + collapsible crafting tree), back-references ("used in N recipes"), uptier/rank siblings, base-mats gold cost
- 🔮 **What can I craft?** — Paste your inventory, get every recipe you can complete with category-grouped results and a one-click "+ Plan" button
- ❤️ **Favorites** — Save items locally; share a list with `?f=slug1,slug2`
- 🧮 **Crafting planner** — Add items with quantities, get a single aggregated shopping list with editable unit prices, per-item subtotals, and "owned" reductions when you have a saved inventory
- 🏷️ **Persistent inventory** — Save your inventory once on `/craftable`; the planner reuses it to subtract owned mats from the shopping list

## Repo structure

```
nodiatis-crafting/
├── data/                      # Raw scraped data (input for the web app)
│   ├── allitems.json          # 5,488 items (1.7 MB)
│   ├── recipes.json           # 2,211 unique recipes (2 MB)
│   └── images/                # 1,706 item images (gitignored — re-fetch via scripts)
├── scripts/                   # Python scrapers
│   ├── scrape_recipes.py      # Pull recipes from tools.nodiatis.com
│   └── download_images.py     # Pull item artwork
├── docs/
│   └── design.md              # v1 design + roadmap (v2/v3)
└── web/                       # The Next.js app
    ├── src/                   # App + components + data layer
    ├── public/images/         # Bundled artwork (deployed)
    ├── scripts/               # Build-time helpers (search index, image manifest)
    └── package.json
```

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + custom dark fantasy theme
- **Search:** Fuse.js (client-side fuzzy)
- **State:** React Context + localStorage (v1)
- **Hosting:** Vercel free tier

## Local development

```bash
# 1. Install dependencies
cd web
npm install

# 2. Re-create the bundled image set if needed (requires Python)
cd ..
python scripts/download_images.py
cp -r data/images web/public/images

# 3. Run dev server (http://localhost:3000)
cd web
npm run dev
```

## Deploying

Vercel project root: `web/` (the Next.js app lives in a subdirectory of this repo).

## Data attribution

All item & recipe data is sourced from the community tool at [tools.nodiatis.com](https://tools.nodiatis.com/neo-items/). This project is not affiliated with Glitchless or Nodiatis.

## Refreshing the data

When `tools.nodiatis.com` adds new items or recipes, refresh the bundled
copy in this repo:

```bash
# 1. Re-scrape items + recipes
python scripts/scrape_recipes.py
python scripts/download_images.py

# 2. Copy fresh artwork into the web app
cp -r data/images/* web/public/images/

# 3. Rebuild the slim indices and search index
cd web
npm run build:data    # regenerates itemIndex / searchIndex / imageManifest / recipeIndex
```

Commit the regenerated `data/` and `web/src/data/*.json` files; Vercel
auto-deploys on push.

## License

MIT for the code (see `LICENSE`). Bundled item data, recipes, and artwork
are derived from `tools.nodiatis.com` under non-commercial fair-use; not
affiliated with Glitchless or Nodiatis.

## Roadmap

- **v1** — Static SPA with full wiki, planner, craftable, search, favorites, sharing ✅
- **v2** — Supabase auth, cloud-synced favorites, multi-device planner
- **v3** — Drop-source data layer, NPC merchant locations, character-build planner
