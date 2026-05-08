# Category Cards Redesign — Materials pattern across all categories

**Date:** 2026-05-08
**Status:** Design approved, ready for implementation plan
**Scope:** Apply the Materials cards-only-landing → drilldown pattern (shipped earlier today) to Potions, Weapons, Armor, Gems, and Other. Keep Pets and Tools as flat tables. Generalise the helpers and components extracted from `lib/materials.ts` and `MaterialsLanding`.

## Context

The Materials redesign that just shipped (commits `7df96e0…9cf1709`) introduced a clean two-step browse:
- `/category/materials` = cards-only landing with thumbnails + names
- `/category/materials/<type>` = standard `ItemTable` filtered to one type, with a `Materials › Bone`-style breadcrumb (parent clickable)

Stefan likes that flow and wants every other category that has meaningful subtypes to follow the same shape. Categories with no useful subtype (Pets, Tools) stay as flat tables. The visual style — small 5-col cards, thumbnail of a representative item, breadcrumb heading on drilldown, clickable parent — is consistent across the site.

## Decisions

Locked during brainstorming:

1. **Cards-only landings: Materials (already done), Potions, Weapons, Armor, Gems, Other.**
2. **Flat tables only (no landing redesign): Pets, Tools.** Pets defaults to level-asc, Tools to rarity-asc (the existing per-category default).
3. **Gems keeps its 3-tier flow** (color → gem identity → ranks) plus the 5 effect-shortcut cards on the L1 landing.
4. **Effect shortcuts navigate cross-color** to a flat table at `/category/gems/effect/<tag>` — a route, not an in-page filter.
5. **Image rule for subtype cards: highest-level item in the subtype.** Mirrors Materials' "T30" rule. Fall back to `<Package>` icon when no image exists.
6. **One spec, one plan** — single implementation cycle. Order: helpers → simple categories → Potions → Gems → Pets/Tools polish.

## Per-category breakdown

| Category | Items | Landing | L1 cards | L2 | L3 | Drilldown sort default |
|---|---:|---|---|---|---|---|
| **Materials** | 686 | shipped | 22 tiered + 4 special | tier-asc table | — | tier-asc |
| **Potions** | 393 | cards | 32 (name-derived: Agility, Armor, …, plus "Other" for Gate/Recall singletons) | name+level table | — | level-asc |
| **Weapons** | 793 | cards | 11 (1H/2H × Slash/Pierce/Crush/Whip + Bow/Arrow/Staff) | level-asc table | — | level-asc |
| **Armor** | 829 | cards | 5 (Breastplate, Helmet, Legging, Shield, Sleeve) | level-asc table | — | level-asc |
| **Gems** | 1616 | cards (3-tier) | 6 colors + 5 effect shortcuts | gem-identity cards per color (~27) | rank table per identity | name-asc + level-asc tiebreak |
| **Pets** | 111 | flat table | — | — | — | level-asc |
| **Tools** | 41 | flat table | — | — | — | rarity-asc |
| **Other** | 1019 | cards | 4 (Purchase, Rune, Travel Gear, Trophy) | level-asc table | — | level-asc |

## Architecture

### New helper module: `web/src/lib/subtypes.ts`

Generic subtype-summary infrastructure that any category can plug into. Mirrors the shape of `lib/materials.ts` but parameterised over the matching/extraction functions.

```ts
export interface SubtypeSummary {
  name: string;
  slug: string;
  count: number;
  imageUrl: string | null;
}

/** Build summaries for items matching `matches`, grouped by `subtypeOf(item)`. */
export function summariseSubtypes(
  items: Item[],
  matches: (item: Item) => boolean,
  subtypeOf: (item: Item) => string,
): SubtypeSummary[];

/** Slug an arbitrary subtype name. "1H Slash" → "1h-slash". */
export function subtypeSlug(name: string): string;

/** Extract the parens content from a Type string. "Weapon (1H Slash)" → "1H Slash". */
export function typeParensSubtype(rawType: string): string;
```

`summariseSubtypes` picks the **highest-level item** as the representative for each subtype's `imageUrl` (tie-breaker: highest rarity, then first-encountered). It is sort-stable: returns subtypes in alphabetical order.

`lib/materials.ts` continues to exist with its tier-aware logic (the resource Type string carries tier inline) and its existing `MaterialTypeSummary` interface. The Materials feature does NOT migrate to the new generic helpers — too much churn for too little gain. The two modules coexist. `SubtypeSummary` and `MaterialTypeSummary` are structurally identical (`name`, `slug`, `count`, `imageUrl`) plus Materials' extra `tierRange`; the new `CategoryLanding` component accepts the structural intersection so both flow into it.

### Per-category public APIs (also in `lib/subtypes.ts`)

```ts
export function allPotionSubtypes(): SubtypeSummary[];
export function allWeaponSubtypes(): SubtypeSummary[];
export function allArmorSubtypes(): SubtypeSummary[];
export function allOtherSubtypes(): SubtypeSummary[];

// Gems is 3-tier — three accessors:
export function allGemColors(): SubtypeSummary[];
export function gemIdentitiesForColor(colorSlug: string): SubtypeSummary[] | null;
//   returns null if color doesn't exist
export function gemsByEffectTag(tag: string): Item[] | null;
//   returns null if tag has no items; else the filtered list for the effect-table page
```

Each accessor is lazily memoised (same pattern as `allMaterialTypes`).

### Generic `CategoryLanding` component

Lifted from `MaterialsLanding.tsx`. Rendered as a client component that takes a generic prop shape:

```tsx
interface Props {
  category: { slug: string; label: string; icon: string };
  primary: { title: string; cards: SubtypeSummary[] };
  special?: { title: string; cards: SubtypeSummary[] };
  shortcuts?: { title: string; cards: ShortcutCard[] };
}

interface ShortcutCard {
  slug: string;
  name: string;
  href: string;
  count: number;
  icon: LucideIcon;
}
```

- `primary` always renders (5-col grid, no count badge).
- `special` renders below if present (4-col grid, with count badge, gold-tinted accent — Materials-style).
- `shortcuts` renders below special (4-col grid, with icon + count). Used by Gems for effect cards.

The existing `MaterialsLanding` becomes a thin wrapper that constructs the props from `allMaterialTypes()` and renders `<CategoryLanding>`. Same for `PotionsLanding`, `WeaponsLanding`, `ArmorLanding`, `OtherLanding`, `GemsLanding`. (Gems' L1 has shortcuts; the others don't.)

### Routes

#### Simple cases (`Potions`, `Weapons`, `Armor`, `Other`)

Add `web/src/app/category/<cat>/[subtype]/page.tsx` for each:

```tsx
// app/category/weapons/[subtype]/page.tsx
export function generateStaticParams() {
  return allWeaponSubtypes().map((s) => ({ subtype: s.slug }));
}

export default async function WeaponSubtypePage({ params }: ...) {
  const { subtype } = await params;
  const summary = allWeaponSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  // ... filter items, render <CategoryClient> with lockedSubtype={summary.name}
}
```

The `subtype` segment matches a slug; the page resolves the canonical name and passes it to `CategoryClient`'s existing `lockedSubtype` prop. The breadcrumb heading and tier-asc default already work.

#### Gems (3-tier + effects)

Four route files:
- `app/category/gems/[color]/page.tsx` — L2 gem-identity cards (uses `gemIdentitiesForColor(color)`); renders `<CategoryLanding>` with primary section
- `app/category/gems/[color]/[identity]/page.tsx` — L3 ranks table (renders `<CategoryClient>` with `lockedSubtype={identityName}` plus a custom 3-segment breadcrumb)
- `app/category/gems/effect/[tag]/page.tsx` — cross-color tag-filtered table
- (No new file for L1; `app/category/[slug]/page.tsx` branches `slug === "gems"` to a new `<GemsLanding>` component)

Gems' breadcrumb on L3 needs three clickable segments: `Gems › <Color> › <Identity>`. Extend the existing `lockedSubtype` rendering in `CategoryClient` to optionally accept a `breadcrumbCrumbs?: { label: string; href?: string }[]` prop instead of the simple two-segment form.

### Branching `app/category/[slug]/page.tsx`

The existing branch on `slug === "materials"` extends to a switch:

```tsx
if (slug === "materials") return <MaterialsLanding ... />;
if (slug === "potions")   return <PotionsLanding ... />;
if (slug === "weapons")   return <WeaponsLanding ... />;
if (slug === "armor")     return <ArmorLanding ... />;
if (slug === "gems")      return <GemsLanding ... />;
if (slug === "other")     return <OtherLanding ... />;
// Pets and Tools fall through to standard CategoryClient rendering below.
```

### CategoryClient changes

- Generalise `lockedSubtype` heading to support 2 OR 3 breadcrumb crumbs (for Gems L3).
- Update `defaultSortFor` to lock both Pets and Tools to their preferred sorts: Pets = level-asc, Tools = rarity-asc. Tools already has rarity-asc as an explicit override; Pets currently relies on the global level-asc default — make it an explicit entry in `DEFAULT_SORT_BY_CATEGORY` so future global-default changes don't silently affect Pets.
- No other changes — `lockedSubtype` already does the right thing.

## Components

| File | New / Modify | Purpose |
|---|---|---|
| `web/src/lib/subtypes.ts` | New | Generic helpers + per-category public APIs |
| `web/src/lib/subtypes.test.ts` | New | Unit tests for helpers and per-category accessors |
| `web/src/app/_landings/CategoryLanding.tsx` | New | Generic landing component (thumbnail card grid with primary/special/shortcuts sections) |
| `web/src/app/category/materials/MaterialsLanding.tsx` | Modify | Becomes a thin wrapper around `<CategoryLanding>` |
| `web/src/app/category/potions/PotionsLanding.tsx` | New | Wraps `<CategoryLanding>` |
| `web/src/app/category/weapons/WeaponsLanding.tsx` | New | Wraps `<CategoryLanding>` |
| `web/src/app/category/armor/ArmorLanding.tsx` | New | Wraps `<CategoryLanding>` |
| `web/src/app/category/other/OtherLanding.tsx` | New | Wraps `<CategoryLanding>` |
| `web/src/app/category/gems/GemsLanding.tsx` | New | Wraps `<CategoryLanding>` with shortcuts |
| `web/src/app/category/potions/[subtype]/page.tsx` | New | Drilldown |
| `web/src/app/category/weapons/[subtype]/page.tsx` | New | Drilldown |
| `web/src/app/category/armor/[subtype]/page.tsx` | New | Drilldown |
| `web/src/app/category/other/[subtype]/page.tsx` | New | Drilldown |
| `web/src/app/category/gems/[color]/page.tsx` | New | L2 gem-identity cards |
| `web/src/app/category/gems/[color]/[identity]/page.tsx` | New | L3 ranks table |
| `web/src/app/category/gems/effect/[tag]/page.tsx` | New | Cross-color effect table |
| `web/src/app/category/[slug]/page.tsx` | Modify | Switch over slug to dispatch the right landing |
| `web/src/app/category/[slug]/CategoryClient.tsx` | Modify | Extend breadcrumb to support N crumbs (for Gems L3) |
| `web/src/app/category/[slug]/CategoryClient.tsx` | Modify | Lock pets/tools default sort |

## Edge cases

- **Potions "Other" bucket** (Gate, Recall, etc., 24 items) — appears as a card with `count: 24`. Drilldown shows all 24 in a flat table. Same treatment as a normal subtype.
- **Gems with no items in a tag** — `gemsByEffectTag` returns `null`; `app/category/gems/effect/[tag]/page.tsx` calls `notFound()`.
- **Unknown subtype slugs** — `notFound()` (Next.js 404) consistently across all drilldown pages.
- **Items where `imageUrl === null`** — `<Package>` icon fallback (existing pattern from PlannerClient and MaterialsLanding).
- **Direct deep-links like `/category/weapons?st=Sword`** — query string is preserved by the existing CategoryClient logic when not on a locked page; users hitting these links land on the cards-only landing instead of a filtered table. Cosmetic regression only; the same items are reachable via `/category/weapons/sword`.
- **Tools/Pets** — these fall through to the existing CategoryClient render path, no change to URL or behaviour beyond the default-sort lock for Pets.

## Testing

- `subtypes.test.ts` — unit tests for `summariseSubtypes`, `subtypeSlug`, `typeParensSubtype`, plus one integration test per public accessor (count of subtypes matches expectation, slug stability, alphabetical ordering, image picking picks highest-level item).
- No component tests (project has no React Testing Library); UI verification via dev-server smoke at the end of the plan.
- All existing tests must remain passing — the changes are additive plus a small CategoryClient breadcrumb extension.

## Out of scope

- Home page redesign (still uses the existing category card grid).
- Card visuals beyond thumbnail + name + optional count (no rarity glow, no animation).
- Migration of `/category/<cat>?st=...` URLs to redirect to drilldown routes — too much fiddly bookkeeping; the cards-only landing is fine for direct links to the bare category.
- Search index changes — tags are already indexed.
- Any animation or micro-interaction (the task is rework, not feature add).
- Mobile-specific layout tuning beyond the existing responsive grid breakpoints.
