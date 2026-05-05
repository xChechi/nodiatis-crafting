# Nodiatis Wiki + Crafting App — Design

**Status:** v1 design locked, scaffolding next.
**Date:** 2026-05-04

## Goal

Become the de-facto Nodiatis wiki + crafting tool. Replace the unusable 6,000-row table at tools.nodiatis.com with proper navigation, item detail pages, favorites, and a crafting planner.

## Phasing

- **v1 (this build):** Static SPA, all data + images bundled at build, localStorage for favorites + planner. Deploy to Vercel free tier.
- **v2 (later):** Supabase auth (Google login). Cloud-sync favorites. Profile pages. Migrate localStorage on first signin.
- **v3 (later):** Sharing URLs, per-recipe comments, contribution layer.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Framer Motion (subtle polish)
- Lucide React (icons)
- Fuse.js (client-side fuzzy search)
- React Context + localStorage (favorites, planner)
- Vercel free tier (static hosting)

## Data sources (already scraped, sit in `../data/`)

- `allitems.json` — 5,488 items metadata
- `recipes.json` — 2,211 unique recipes (covers 2,973 craftable items via dedup by `(itemType, rarity, level, cost)`)
- `images/` — 1,706 image files (72% coverage; 666 dead refs on source skipped)

## Routing

| Path | Purpose |
|---|---|
| `/` | Hero + search + category cards |
| `/category/[slug]` | Filterable card grid (Tier, Level, Rarity, Sort) |
| `/items/[slug]` | Item detail: stats + recipe + back-references + Favorite + Planner buttons |
| `/favorites` | Saved items grid |
| `/planner` | Set per-item quantities → aggregated raw-mats shopping list |
| `/about` | Credits + attribution to tools.nodiatis.com |

## Item detail page contents

1. Header: image + name + tier + rarity badge + level + stats
2. Description
3. **How to craft** (if `RecipeType` set):
   - Consumable layer (1 craft, 1-3 mats)
   - Finished item (full breakdown to base mats, 4-7 mats)
   - Each material name links to its own item detail page
4. **Used in recipes** (back-references — items that need this as material)
5. ★ Favorite toggle
6. + Add to planner (with quantity input)

## Key UX wins over existing tool

1. Killed the table — categorized navigation
2. Material names in recipes are clickable → sideways exploration
3. Back-references both ways ("what makes me" + "what I'm used in")
4. Persistent filter state via URL (shareable)
5. Cmd+K-style global search

## Storage shape (localStorage v1, Supabase v2)

```ts
type Favorites = { itemSlug: string; addedAt: string }[];
type Planner   = { itemSlug: string; quantity: number }[];
```

Key prefixes: `nod:favorites`, `nod:planner`. Versioned for future migration.

## Project location

- Web app: `Projects/nodiatis-crafting/web/`
- Data + scripts: existing siblings (`data/`, `scripts/`)
- Build pipeline copies/symlinks `data/` into `web/public/` or `web/src/data/` at build time

## Out of scope for v1

- Auth / accounts
- Cross-device sync
- Comments / sharing
- "I have these mats — what can I craft?" (workflow B — defer to v3)
- Crafting-XP optimization (workflow C — defer to v3)
- Stat-based item comparison (workflow E — defer to v3)
