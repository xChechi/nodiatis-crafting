# Materials Card Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/category/materials` flat item-table with a two-section card landing (22 tiered + 4 special), wired to a per-type drilldown at `/category/materials/[type]` that reuses the standard `CategoryClient` view filtered to one type and defaulted to tier-asc sort.

**Architecture:** A new pure helper module (`web/src/lib/materials.ts`) parses `"Resource (Bone Tier 7)"` into `{name: "Bone", tier: 7}` and produces type summaries. A new `MaterialsLanding` client component renders the two-section grid. The existing `CategoryClient` gains an optional `lockedSubtype` prop so the drilldown route can pre-filter and hide the subtype selector. Materials gets a literal route segment (`category/materials/[type]/page.tsx`) so the nested route never activates for other categories.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, TypeScript 5, Vitest 2 (unit tests only — no React Testing Library or jsdom in this project; UI is verified via the dev-server smoke check at the end).

**Spec:** `docs/superpowers/specs/2026-05-08-materials-card-landing-design.md`

---

## File map

| File | New/Modify | Purpose |
|---|---|---|
| `web/src/lib/materials.ts` | **New** | Pure helpers: `parseMaterialType`, `materialTypeSlug`, `summariseTypes`, `allMaterialTypes` |
| `web/src/lib/materials.test.ts` | **New** | Vitest unit tests for the four helpers |
| `web/src/lib/data.ts` | Modify | For resource items, extract tier from `Type` (`"Resource (Bone Tier 7)"`) instead of name |
| `web/src/app/category/[slug]/CategoryClient.tsx` | Modify | Add optional `lockedSubtype?: string` prop; when set, hide subtype selector, force the filter, and default sort to `tier asc` |
| `web/src/app/category/[slug]/page.tsx` | Modify | Branch on `slug === "materials"` to render `MaterialsLanding` instead of `CategoryClient` |
| `web/src/app/category/materials/MaterialsLanding.tsx` | **New** | Two-section card grid client component |
| `web/src/app/category/materials/[type]/page.tsx` | **New** | Drilldown server page; resolves slug, filters items, renders `CategoryClient` with `lockedSubtype` |

---

## Task 1: Pure helpers in `lib/materials.ts`

**Files:**
- Create: `web/src/lib/materials.ts`
- Test: `web/src/lib/materials.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/materials.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  parseMaterialType,
  materialTypeSlug,
  summariseTypes,
} from "./materials";
import type { Item } from "./types";

function fakeItem(over: Partial<Item>): Item {
  return {
    Name: "x",
    Type: "Resource (Bone Tier 1)",
    Rarity: 0,
    Image: null,
    Description: null,
    Cost: 0,
    slug: "x",
    rarityLabel: "Common",
    imageUrl: null,
    tier: null,
    tags: [],
    recipe: null,
    usedInSlugs: [],
    ...over,
  };
}

describe("parseMaterialType", () => {
  test("extracts name and tier from a tiered resource type", () => {
    expect(parseMaterialType("Resource (Bone Tier 7)")).toEqual({
      name: "Bone",
      tier: 7,
    });
  });

  test("handles two-word names", () => {
    expect(parseMaterialType("Resource (Armor Essence Tier 3)")).toEqual({
      name: "Armor Essence",
      tier: 3,
    });
  });

  test("returns null tier when the type has no tier suffix", () => {
    expect(parseMaterialType("Resource (Armor Essence)")).toEqual({
      name: "Armor Essence",
      tier: null,
    });
  });

  test("returns the raw inner content if structure is unexpected", () => {
    expect(parseMaterialType("Resource (Junk)")).toEqual({
      name: "Junk",
      tier: null,
    });
  });

  test("returns name='Resource' and tier=null for malformed input", () => {
    expect(parseMaterialType("Resource")).toEqual({
      name: "Resource",
      tier: null,
    });
  });
});

describe("materialTypeSlug", () => {
  test("lowercases single-word names", () => {
    expect(materialTypeSlug("Bone")).toBe("bone");
  });

  test("hyphenates multi-word names", () => {
    expect(materialTypeSlug("Armor Essence")).toBe("armor-essence");
    expect(materialTypeSlug("Heroic Essence")).toBe("heroic-essence");
  });

  test("collapses repeated whitespace", () => {
    expect(materialTypeSlug("Armor   Essence")).toBe("armor-essence");
  });
});

describe("summariseTypes", () => {
  test("groups items by canonical type name and counts them", () => {
    const items = [
      fakeItem({ Type: "Resource (Bone Tier 1)", Name: "a" }),
      fakeItem({ Type: "Resource (Bone Tier 2)", Name: "b" }),
      fakeItem({ Type: "Resource (Ore Tier 1)", Name: "c" }),
      fakeItem({ Type: "Resource (Armor Essence)", Name: "d" }),
    ];
    const result = summariseTypes(items);
    expect(result.find((t) => t.name === "Bone")).toEqual({
      name: "Bone",
      slug: "bone",
      count: 2,
      tierRange: [1, 2],
    });
    expect(result.find((t) => t.name === "Ore")).toEqual({
      name: "Ore",
      slug: "ore",
      count: 1,
      tierRange: [1, 1],
    });
    expect(result.find((t) => t.name === "Armor Essence")).toEqual({
      name: "Armor Essence",
      slug: "armor-essence",
      count: 1,
      tierRange: null,
    });
  });

  test("sorts results alphabetically by name", () => {
    const items = [
      fakeItem({ Type: "Resource (Wood Tier 1)" }),
      fakeItem({ Type: "Resource (Bone Tier 1)" }),
      fakeItem({ Type: "Resource (Ore Tier 1)" }),
    ];
    expect(summariseTypes(items).map((t) => t.name)).toEqual([
      "Bone",
      "Ore",
      "Wood",
    ]);
  });

  test("ignores non-resource items", () => {
    const items = [
      fakeItem({ Type: "Resource (Bone Tier 1)" }),
      fakeItem({ Type: "Weapon (Sword)" }),
      fakeItem({ Type: "Potion" }),
    ];
    expect(summariseTypes(items)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `web/`: `npm test -- materials.test.ts`
Expected: FAIL — module `./materials` not found.

- [ ] **Step 3: Implement `lib/materials.ts`**

Create `web/src/lib/materials.ts`:

```ts
// Helpers for the Materials category. Resource Type strings encode both
// the kind of material and its tier in one field — e.g. "Resource (Bone
// Tier 7)" → { name: "Bone", tier: 7 }. The 4 no-tier types (Armor
// Essence, Shield Essence, Junk, Heroic Essence) wrap inner text without
// a tier suffix.

import type { Item } from "./types";

const RESOURCE_PREFIX = "Resource";
const INNER_RE = /\(([^)]+)\)/;
const TIER_SUFFIX_RE = /\s+Tier\s+(\d+)$/i;

export interface MaterialTypeSummary {
  name: string;
  slug: string;
  count: number;
  /** [min, max] tier present, or null if no item in this type has a tier. */
  tierRange: [number, number] | null;
}

/** Parse a resource Type string into its canonical name and tier number. */
export function parseMaterialType(rawType: string): {
  name: string;
  tier: number | null;
} {
  const m = rawType.match(INNER_RE);
  if (!m) return { name: rawType.trim(), tier: null };
  const inner = m[1].trim();
  const tierMatch = inner.match(TIER_SUFFIX_RE);
  if (tierMatch) {
    return {
      name: inner.replace(TIER_SUFFIX_RE, "").trim(),
      tier: parseInt(tierMatch[1], 10),
    };
  }
  return { name: inner, tier: null };
}

/** Slugify a canonical type name for use in URLs. "Armor Essence" → "armor-essence". */
export function materialTypeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Group resource items by canonical type name. Returns one summary per
 * distinct type, sorted alphabetically. Non-resource items are ignored.
 */
export function summariseTypes(items: Item[]): MaterialTypeSummary[] {
  const buckets = new Map<
    string,
    { count: number; tiers: number[] }
  >();
  for (const item of items) {
    if (!item.Type.startsWith(RESOURCE_PREFIX)) continue;
    const { name, tier } = parseMaterialType(item.Type);
    let bucket = buckets.get(name);
    if (!bucket) {
      bucket = { count: 0, tiers: [] };
      buckets.set(name, bucket);
    }
    bucket.count += 1;
    if (tier !== null) bucket.tiers.push(tier);
  }
  return Array.from(buckets.entries())
    .map(([name, b]) => ({
      name,
      slug: materialTypeSlug(name),
      count: b.count,
      tierRange:
        b.tiers.length > 0
          ? ([Math.min(...b.tiers), Math.max(...b.tiers)] as [number, number])
          : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `web/`: `npm test -- materials.test.ts`
Expected: PASS — 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/materials.ts web/src/lib/materials.test.ts
git commit -m "feat(materials): add type-extraction helpers + tests"
```

---

## Task 2: `allMaterialTypes()` wrapper in `lib/data.ts`

**Files:**
- Modify: `web/src/lib/data.ts`

This wrapper is trivial (one filter + one call) so it lives in `data.ts` alongside the other public data accessors. No standalone test — the pure work is in `summariseTypes` (covered in Task 1) and the wrapper is exercised by Task 5's snapshot of the actual landing.

- [ ] **Step 1: Add the import and wrapper at the bottom of `web/src/lib/data.ts`**

After the existing `getRankSeries` export, add:

```ts
import { summariseTypes, type MaterialTypeSummary } from "./materials";

// ─── Material type summaries (for the /category/materials landing) ──────────
let _materialTypes: MaterialTypeSummary[] | null = null;

/** All distinct Material types with their item counts and tier ranges. */
export function allMaterialTypes(): MaterialTypeSummary[] {
  if (_materialTypes) return _materialTypes;
  _materialTypes = summariseTypes(enrichedItems);
  return _materialTypes;
}

export type { MaterialTypeSummary };
```

The `import` line goes at the **top** of the file with the other lib imports — move it there during the edit. Lazy memoisation matches the existing pattern used by `ensureChainIndex` and `ensureRankIndex`.

- [ ] **Step 2: Verify nothing broke**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

Run from `web/`: `npm test`
Expected: all tests pass (Task 1's 11 + the existing 31 = 42).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/data.ts
git commit -m "feat(materials): expose allMaterialTypes() summaries"
```

---

## Task 3: Resource tier extraction from `Type`

**Files:**
- Modify: `web/src/lib/data.ts`
- Modify: `web/src/lib/crafting.test.ts` *(only if existing tests already cover tier extraction; otherwise add one new case in the materials test file)*

Today, `extractTier(raw.Name)` looks at the item *name* for "Tier N" — but resource names like "Mongoose Leg Bone" contain no tier. The tier lives in `Type`. We override extraction for resources only.

- [ ] **Step 1: Add a failing test for the override**

Append this `describe` block to `web/src/lib/materials.test.ts`:

```ts
describe("data.ts tier extraction for resources", () => {
  test("a resource item gets its tier from Type, not Name", async () => {
    const { getItemBySlug } = await import("./data");
    // The first Bone item: its name "Mongoose Leg Bone" contains no tier
    // text, but its Type is "Resource (Bone Tier 1)" → tier should be 1.
    const item = getItemBySlug("mongoose-leg-bone");
    expect(item).not.toBeNull();
    expect(item?.tier).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `web/`: `npm test -- materials.test.ts`
Expected: FAIL — `item.tier` is `null` (extracted from name, which has no tier text).

- [ ] **Step 3: Patch the enrichment in `data.ts`**

Find the `enrichedItems` map. The relevant line currently is:

```ts
tier: extractTier(raw.Name),
```

Change it to:

```ts
tier: raw.Type.startsWith("Resource ")
  ? (parseMaterialType(raw.Type).tier ?? null)
  : extractTier(raw.Name),
```

Add `parseMaterialType` to the existing `import { ... } from "./materials"` line at the top.

- [ ] **Step 4: Verify the test passes and nothing else regressed**

Run from `web/`: `npm test`
Expected: all tests pass (Task 1's 11 + this 1 + existing 31 = 43).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/data.ts web/src/lib/materials.test.ts
git commit -m "feat(materials): extract resource tier from Type field"
```

---

## Task 4: `lockedSubtype` prop on `CategoryClient`

**Files:**
- Modify: `web/src/app/category/[slug]/CategoryClient.tsx`

Add an optional prop that, when set, locks the subtype filter and hides its UI. Also forces the default sort to tier-asc on first render.

- [ ] **Step 1: Open `CategoryClient.tsx`. Find the props interface (the function signature accepts a `category` prop and several others). Add `lockedSubtype` to the props.**

In the `CategoryClient` function signature/props type, add an optional field:

```ts
lockedSubtype?: string;
```

Where the function is defined like `export function CategoryClient({ category, items, ... }: ...)`, also destructure `lockedSubtype`.

- [ ] **Step 2: Initialise the subtype filter from `lockedSubtype` when it is set**

Find the existing `subtypeFilter` `useState` initialiser. Replace its initial value with:

```ts
useState<string | "all">(
  () => lockedSubtype ?? searchParams.get("subtype") ?? "all",
);
```

- [ ] **Step 3: When `lockedSubtype` is set, override the per-category default sort to tier-asc**

Find the line that derives `defSort` from `defaultSortFor(category.slug)`. Wrap it:

```ts
const defSort: DefaultSortConfig = lockedSubtype
  ? { primary: { column: "tier", dir: "asc" } }
  : defaultSortFor(category.slug);
```

- [ ] **Step 4: Hide the subtype selector when `lockedSubtype` is set**

Find the JSX block that renders the subtype card grid / dropdown (search for `subtypeFilter` in the JSX). Wrap that block in `{!lockedSubtype && (...)}` so it doesn't render when locked.

Also find the URL-persistence effect that writes `subtype=` to `searchParams`. Add an early return when `lockedSubtype` is set so the URL stays clean (the type is already in the path segment).

- [ ] **Step 5: Type-check + run all tests**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

Run from `web/`: `npm test`
Expected: all 43 tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/category/[slug]/CategoryClient.tsx
git commit -m "feat(materials): CategoryClient accepts lockedSubtype prop"
```

---

## Task 5: `MaterialsLanding` component

**Files:**
- Create: `web/src/app/category/materials/MaterialsLanding.tsx`

This is the two-section card grid: 22 tiered cards in a dense 5-col grid, then a separate "Special" section with the 4 no-tier types. Cards link to `/category/materials/<slug>`.

- [ ] **Step 1: Create the component**

Create `web/src/app/category/materials/MaterialsLanding.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { MaterialTypeSummary } from "@/lib/materials";

interface Props {
  tiered: MaterialTypeSummary[];
  special: MaterialTypeSummary[];
}

export function MaterialsLanding({ tiered, special }: Props) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] mb-4"
      >
        <ChevronLeft size={14} />
        Back to home
      </Link>

      <h1 className="font-[family-name:var(--font-display-loaded)] text-2xl text-[var(--color-fg-1)] mb-6 tracking-wide">
        Materials
      </h1>

      <Section title="Tiered (T1–T30)" cols={5}>
        {tiered.map((t) => (
          <TypeCard key={t.slug} t={t} showCount={false} />
        ))}
      </Section>

      <Section title="Special" cols={4} className="mt-8">
        {special.map((t) => (
          <TypeCard key={t.slug} t={t} showCount accent />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  cols,
  className,
  children,
}: {
  title: string;
  cols: 4 | 5;
  className?: string;
  children: React.ReactNode;
}) {
  const gridCols = cols === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  return (
    <section className={className}>
      <h2 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-3)] mb-2">
        {title}
      </h2>
      <div className={`grid gap-2 ${gridCols}`}>{children}</div>
    </section>
  );
}

function TypeCard({
  t,
  showCount,
  accent,
}: {
  t: MaterialTypeSummary;
  showCount: boolean;
  accent?: boolean;
}) {
  return (
    <Link
      href={`/category/materials/${t.slug}`}
      className={
        "block rounded-md border px-3 py-2.5 transition-colors " +
        (accent
          ? "bg-[color:rgba(207,168,90,0.04)] border-[color:rgba(207,168,90,0.35)] hover:border-[color:rgba(207,168,90,0.6)]"
          : "bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)]")
      }
    >
      <div className="text-sm font-semibold text-[var(--color-fg-1)]">
        {t.name}
      </div>
      {showCount && (
        <div className="text-[11px] font-mono text-[var(--color-fg-3)]">
          {t.count} item{t.count === 1 ? "" : "s"}
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/category/materials/MaterialsLanding.tsx
git commit -m "feat(materials): MaterialsLanding two-section card grid"
```

---

## Task 6: Branch `category/[slug]/page.tsx` for Materials

**Files:**
- Modify: `web/src/app/category/[slug]/page.tsx`

When `slug === "materials"`, render `MaterialsLanding` and skip the standard `CategoryClient` flow.

- [ ] **Step 1: Open `web/src/app/category/[slug]/page.tsx`. After the existing `notFound()` guard but before the `items = allItems().filter(...)` line, add a Materials branch.**

Add these imports at the top (next to existing imports):

```ts
import { allMaterialTypes } from "@/lib/data";
import { MaterialsLanding } from "../materials/MaterialsLanding";
```

After `if (!cat) notFound();`, insert:

```ts
if (slug === "materials") {
  const summaries = allMaterialTypes();
  const tiered = summaries.filter((s) => s.tierRange !== null);
  const special = summaries.filter((s) => s.tierRange === null);
  return <MaterialsLanding tiered={tiered} special={special} />;
}
```

This returns early, so the existing `allItems().filter(...)` and `<CategoryClient ... />` render path stays untouched for every other category.

- [ ] **Step 2: Type-check + run all tests**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

Run from `web/`: `npm test`
Expected: all 43 tests pass.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/category/[slug]/page.tsx
git commit -m "feat(materials): /category/materials renders MaterialsLanding"
```

---

## Task 7: Drilldown route `/category/materials/[type]`

**Files:**
- Create: `web/src/app/category/materials/[type]/page.tsx`

A literal `materials` path segment scopes the nested route to this category only. It resolves the slug → canonical type name, filters items, and hands off to `CategoryClient` with `lockedSubtype`.

- [ ] **Step 1: Create the drilldown page**

Create `web/src/app/category/materials/[type]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { allItems, allMaterialTypes } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { parseMaterialType } from "@/lib/materials";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allMaterialTypes().map((t) => ({ type: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const summary = allMaterialTypes().find((t) => t.slug === type);
  if (!summary) return {};
  return {
    title: `${summary.name} — Materials`,
    description: `Browse all ${summary.count} ${summary.name} materials.`,
  };
}

export default async function MaterialTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const summary = allMaterialTypes().find((t) => t.slug === type);
  if (!summary) notFound();

  const cat = findCategoryBySlug("materials");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) =>
      i.Type.startsWith("Resource ") &&
      parseMaterialType(i.Type).name === summary.name,
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <CategoryClient
      category={catSerializable}
      items={items}
      lockedSubtype={summary.name}
    />
  );
}
```

> If the existing `<CategoryClient ... />` call site in `app/category/[slug]/page.tsx` passes additional props (e.g. `Suspense` wrapper), match that shape. Open the existing call site as a reference before writing this file.

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

If TypeScript complains that `lockedSubtype` is unknown on `CategoryClient`, re-check Task 4 — the prop must be on the component's prop type.

- [ ] **Step 3: Run all tests**

Run from `web/`: `npm test`
Expected: all 43 tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/category/materials/[type]/page.tsx
git commit -m "feat(materials): drilldown route /category/materials/[type]"
```

---

## Task 8: Build + dev-server smoke test

**Files:**
- None modified; this is a verification gate.

- [ ] **Step 1: Re-run the data build pipeline (rebuilds `searchIndex.json` and `itemIndex.json`)**

Run from `web/`: `npm run build:data`
Expected: completes without error; "Tagged N of M items" line still appears with previous counts.

- [ ] **Step 2: Type-check + lint + tests one last time**

Run from `web/`:
- `npx tsc --noEmit` — expected: no output
- `npm run lint` — expected: no output
- `npm test` — expected: all 43 tests pass

- [ ] **Step 3: Start the dev server and click through**

Run from `web/`: `npm run dev`

In a browser at `http://localhost:3000/`:
1. Click the "Materials" category card — should land on `/category/materials` and render the new two-section landing (22 tiered + 4 special).
2. Click "Bone" — should navigate to `/category/materials/bone` and render the standard item table with all 30 Bone items, sorted T1 → T30, no subtype selector visible.
3. Click "Heroic Essence" — should land on `/category/materials/heroic-essence` and render a single-row table.
4. Click an item from the type page — should navigate to its detail page.
5. Use browser back — should return cleanly to the previous page (Materials landing or type page).
6. Visit `/category/materials/nonexistent` — should render the standard Next.js 404.
7. Spot-check another category (e.g. `/category/weapons`) — should render unchanged with the standard `CategoryClient`.

- [ ] **Step 4: If anything's off, fix it before continuing**

If a click-through reveals a bug (wrong sort, missing items, broken layout), fix it as a follow-up commit before marking the plan complete.

- [ ] **Step 5: No commit needed for verification; the feature ships in Tasks 1–7**

---

## Self-review

- **Spec coverage:** Architecture (✓ Tasks 4–7), type extraction (✓ Tasks 1, 3), components (MaterialsLanding ✓ Task 5, drilldown page ✓ Task 7, CategoryClient extension ✓ Task 4), edge cases (404 ✓ Task 7, no-tier types ✓ Task 1 + 5 + 7, single-item types ✓ Task 8 step 3.3), testing (unit tests ✓ Tasks 1, 3 — component snapshot dropped: project has no React Testing Library / jsdom infra; UI is verified at Task 8 step 3 instead, with rationale in the plan header). Out-of-scope items confirmed not implemented.
- **Placeholder scan:** No "TBD", "TODO", "implement later", or vague directions. Every code step shows full code; every test step shows the assertion; every command shows expected output.
- **Type consistency:** `MaterialTypeSummary` defined in Task 1, exported through `data.ts` in Task 2, consumed by `MaterialsLanding` in Task 5 and the drilldown in Task 7. `parseMaterialType` import path consistent across Tasks 1, 3, 7. `lockedSubtype` prop name consistent in Tasks 4 and 7. Sort default `tier asc` consistent in Task 4 and Task 8 verification.
