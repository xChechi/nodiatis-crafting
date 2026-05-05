# Nodiatis Wiki & Crafting Calculator

A modern, fast, searchable wiki + crafting planner for the [Nodiatis MMORPG](https://www.nodiatis.com/) — built to replace the unusable 6,000-row table at `tools.nodiatis.com` with proper navigation, recipe pages, favorites, and an aggregated crafting planner.

**Live demo:** *(deploying to Vercel)*

## What it does

- 📚 **Wiki** — Browse all 5,488 items by category (Potions, Weapons, Armor, Gems, Pets, Tools, Materials, Other)
- 🔍 **Global search** — `⌘K` / `Ctrl+K`, fuzzy-match across every item
- 📜 **Item pages** — Stats, recipe (consumable + full base-mat breakdown), back-references ("used in N recipes")
- ❤️ **Favorites** — Save items locally (cloud sync coming in v2)
- 🧮 **Crafting planner** — Add items with quantities, get a single aggregated shopping list

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

## Roadmap

- **v1** — Static SPA, localStorage favorites/planner ✅
- **v2** — Supabase auth, cloud-synced favorites, profile pages
- **v3** — Sharing URLs, comments, contribution layer
