# Materials category — card landing + per-type tier table

**Date:** 2026-05-08
**Status:** Design approved, ready for implementation plan
**Scope:** Materials category only. Other categories unchanged.

## Context

The Materials category currently flows into the standard `CategoryClient` view: one big sortable table containing all 686 items across 26 distinct material types. With each tiered type providing a complete T1–T30 progression of 30 items, browsing this as a flat table buries the structure. Users looking for "all the bones" or "T15 ingots" must lean on filters that aren't tuned for this shape.

The data is unusually clean: 22 of the 26 types have an exact T1–T30 progression (one item per tier). The other 4 are no-tier collections (Armor Essence ×11, Shield Essence ×11, Junk ×3, Heroic Essence ×1). This regular shape supports a curated two-tier browse without much custom code.

## Decisions

Locked during brainstorming (visual companion mockups + terminal Q&A):

1. **Landing layout: two sections.** 22 tiered types in a dense 5-column grid up top; 4 special types in a separate 4-column "Special" section below with subtly different card styling. Acknowledges the data-shape difference instead of forcing a single rhythm.
2. **Drilldown: route-based.** Each type card links to `/category/materials/<type-slug>`. Shareable, bookmarkable, plays with browser back/forward. Mirrors how categories already drill into items.
3. **Per-type page: standard `ItemTable`.** Reuse the existing component with default sort = tier asc. Filter chips, search, and column headers behave the same as on other category pages — no new mental model.
4. **Scope: Materials only.** No similar landings planned for Armor, Weapons, or other categories at this time.

## Architecture

| Route | Component | Behaviour |
|---|---|---|
| `/category/materials` | New `MaterialsLanding` | Two-section card grid; replaces `CategoryClient` for this slug only |
| `/category/materials/[type]` | New server page → existing `CategoryClient` + `ItemTable` | Items filtered to that type, tier-asc default sort, all existing controls intact |
| `/category/<other>` | Unchanged `CategoryClient` | No regression to other categories |

The existing `category/[slug]/page.tsx` adds a `slug === "materials"` branch that renders `MaterialsLanding` instead of `CategoryClient`. The drilldown lives at `category/materials/[type]/page.tsx` — a literal `materials` segment so the nested route applies only to this category and doesn't unintentionally activate for `/category/<other>/<x>`.

## Type extraction

Material `Type` strings carry both kind and tier: `"Resource (Bone Tier 7)"` → canonical name `"Bone"`, tier `7`. A new helper module mirrors the `uptier.ts` pattern:

```ts
// web/src/lib/materials.ts
parseMaterialType(rawType: string): { name: string; tier: number | null }
materialTypeSlug(name: string): string          // "Armor Essence" → "armor-essence"
allMaterialTypes(): MaterialTypeSummary[]       // sorted, with count + tier range
```

`MaterialTypeSummary` shape:
```ts
{ name: string; slug: string; count: number; tierRange: [number, number] | null }
```

The existing `tier` field on `Item` is currently extracted from item names via `extractTier(raw.Name)`. For materials we extract from `Type` instead — a one-line conditional in `data.ts` enrichment, gated on `Type.startsWith("Resource ")`.

## Components

- **`MaterialsLanding.tsx`** (new, ~80 lines, client component). Receives pre-computed `{ tiered: MaterialTypeSummary[]; special: MaterialTypeSummary[] }` from the server. Renders the two-section grid. Cards link to `/category/materials/${slug}`.
- **`web/src/app/category/materials/[type]/page.tsx`** (new server component). Resolves the type slug → canonical name; if unknown, calls `notFound()`. Filters items to that type, passes them to `CategoryClient` with a `lockedSubtype` prop and sort default. Also generates `generateStaticParams()` returning all known type slugs for SSG.
- **`CategoryClient.tsx`** (small extension). Accept optional `lockedSubtype?: string` prop. When set, hide the subtype selector (the user already picked it via the card) and treat the secondary sort and tier-asc default as the new initial state.

## Edge cases

- **Heroic Essence (1 item)** — same pattern, `ItemTable` renders 1 row. Consistency over special-casing.
- **Junk (3 items), Armor/Shield Essence (11 each)** — no-tier types fall back to name-asc default sort; tier column is hidden when no item in the set has a tier.
- **Unknown type slug** — `notFound()` (Next.js 404 page).
- **Items with malformed `Type`** — `parseMaterialType` returns `{ name: rawTypeContent, tier: null }`; the type appears as its own card in the special section. Defensive but unreachable with current data.
- **No Materials URLs to preserve** — no shareable `?subtype=Bone` links in the wild yet; this is the first redesign.

## Testing

- **Unit tests** in `web/src/lib/materials.test.ts` (new): tier extraction for tiered names, no-tier handling, slug stability across renames, empty-input behaviour. Extends the existing `crafting.test.ts` style; uses Vitest.
- **Snapshot test** for `MaterialsLanding`: locks the two-section structure and the tiered/special partitioning of the 26 known types.
- **Drilldown page**: thin server wrapper over `CategoryClient`; covered transitively by existing `CategoryClient` tests once the `lockedSubtype` prop is introduced.
- All existing tests must continue to pass — `CategoryClient` extension is additive.

## Out of scope

- Card-landing redesigns for any other category (Weapons, Armor, etc.) — not now.
- Icons per material type (Bone, Wood, Ore icons) — possible future polish; current cards are text-only.
- Backwards-compat with hypothetical `?subtype=` query strings — none exist.
- Cross-tier comparison views ("show me T15 across all materials") — not requested.
- Search by tier number on the landing page — drill into a type first, then use the existing tier filter.
