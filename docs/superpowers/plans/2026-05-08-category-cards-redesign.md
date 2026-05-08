# Category Cards Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Materials cards-only-landing → drilldown pattern to Potions, Weapons, Armor, Gems, and Other; lock Pets and Tools to flat tables with explicit default sorts.

**Architecture:** New generic helper module `lib/subtypes.ts` produces per-subtype summaries (count + highest-level item's image) for any matcher/extractor pair. New generic `CategoryLanding` component renders the small-card grid (5-col primary, optional 4-col special, optional 4-col shortcuts). Each redesigned category gets a thin wrapper Landing + drilldown route(s). Gems retains its 3-tier flow (color → identity → ranks) plus a cross-color effect-shortcut route. The existing `CategoryClient` accepts an N-crumb breadcrumb so Gems' L3 can show three levels.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, TypeScript 5, Vitest 2.

**Spec:** `docs/superpowers/specs/2026-05-08-category-cards-redesign-design.md`

---

## File map

| File | New / Modify | Purpose |
|---|---|---|
| `web/src/lib/subtypes.ts` | **New** | Generic helpers + per-category public APIs |
| `web/src/lib/subtypes.test.ts` | **New** | Unit tests for the helpers and per-category accessors |
| `web/src/app/_landings/CategoryLanding.tsx` | **New** | Generic landing component (primary / special / shortcuts sections) |
| `web/src/app/category/[slug]/CategoryClient.tsx` | Modify | Extend breadcrumb to N crumbs; lock pets/tools default sort |
| `web/src/app/category/[slug]/page.tsx` | Modify | Switch on `slug` to dispatch each landing |
| `web/src/app/category/weapons/WeaponsLanding.tsx` | **New** | Wraps `<CategoryLanding>` |
| `web/src/app/category/weapons/[subtype]/page.tsx` | **New** | Drilldown route |
| `web/src/app/category/armor/ArmorLanding.tsx` | **New** | Wraps `<CategoryLanding>` |
| `web/src/app/category/armor/[subtype]/page.tsx` | **New** | Drilldown route |
| `web/src/app/category/other/OtherLanding.tsx` | **New** | Wraps `<CategoryLanding>` |
| `web/src/app/category/other/[subtype]/page.tsx` | **New** | Drilldown route |
| `web/src/app/category/potions/PotionsLanding.tsx` | **New** | Wraps `<CategoryLanding>` |
| `web/src/app/category/potions/[subtype]/page.tsx` | **New** | Drilldown route |
| `web/src/app/category/gems/GemsLanding.tsx` | **New** | Wraps `<CategoryLanding>` with shortcuts |
| `web/src/app/category/gems/[color]/page.tsx` | **New** | L2 — gem-identity cards for one color |
| `web/src/app/category/gems/[color]/[identity]/page.tsx` | **New** | L3 — ranks table for one identity |
| `web/src/app/category/gems/effect/[tag]/page.tsx` | **New** | Cross-color effect-tag table |
| `web/src/app/category/materials/MaterialsLanding.tsx` | Modify | Refactor to wrap the new generic `CategoryLanding` (Task 13) |

---

## Subtype counts (from real data, used for test assertions)

- **Weapons:** 11 subtypes — 1H Crush (51), 1H Pierce (49), 1H Slash (60), 1H Whip (60), 2H Crush (37), 2H Pierce (44), 2H Slash (52), 2H Staff (64), Arrow (116), Bow (129), Quiver (131).
- **Armor:** 5 subtypes — Breastplate (163), Helmet (175), Legging (175), Shield (136), Sleeve (180).
- **Other:** 4 subtypes — Purchase (5), Rune (566), Travel Gear (20), Trophy (428).
- **Potions:** 32 subtypes (name-derived). Top counts: Other (24), Armor/Concentration/Intelligence/Mitigation/Potion of Blessings/Potion of Stone/Strength (15 each), …
- **Gems:** 6 colors — Black, Blue, Green, Grey, Red, White. Each color has many gem identities (use `Name.replace(/\s+Rank\s+\d+$/i, "")` for the identity key).

---

## Task 1: Generic helpers in `lib/subtypes.ts`

**Files:**
- Create: `web/src/lib/subtypes.ts`
- Test: `web/src/lib/subtypes.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/src/lib/subtypes.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  typeParensSubtype,
  subtypeSlug,
  summariseSubtypes,
} from "./subtypes";
import type { Item } from "./types";

function fakeItem(over: Partial<Item>): Item {
  return {
    Name: "x",
    Type: "Weapon (1H Slash)",
    Rarity: 0,
    Image: null,
    Description: null,
    Cost: 0,
    Level: 0,
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

describe("typeParensSubtype", () => {
  test("extracts content from parens", () => {
    expect(typeParensSubtype("Weapon (1H Slash)")).toBe("1H Slash");
    expect(typeParensSubtype("Armor (Breastplate)")).toBe("Breastplate");
  });

  test("returns the whole input when no parens", () => {
    expect(typeParensSubtype("Trophy")).toBe("Trophy");
    expect(typeParensSubtype("Shield")).toBe("Shield");
  });

  test("trims whitespace inside parens", () => {
    expect(typeParensSubtype("Weapon (  1H Slash  )")).toBe("1H Slash");
  });
});

describe("subtypeSlug", () => {
  test("lowercases and hyphenates", () => {
    expect(subtypeSlug("1H Slash")).toBe("1h-slash");
    expect(subtypeSlug("Travel Gear")).toBe("travel-gear");
    expect(subtypeSlug("Potion of Blessings")).toBe("potion-of-blessings");
  });

  test("collapses repeated whitespace", () => {
    expect(subtypeSlug("Travel   Gear")).toBe("travel-gear");
  });
});

describe("summariseSubtypes", () => {
  test("groups items, picks highest-level item for image", () => {
    const items = [
      fakeItem({ Name: "Sword L1", Type: "Weapon (1H Slash)", Level: 1, imageUrl: "/img/s1.png" }),
      fakeItem({ Name: "Sword L50", Type: "Weapon (1H Slash)", Level: 50, imageUrl: "/img/s50.png" }),
      fakeItem({ Name: "Sword L20", Type: "Weapon (1H Slash)", Level: 20, imageUrl: "/img/s20.png" }),
      fakeItem({ Name: "Bow L10", Type: "Archery (Bow)", Level: 10, imageUrl: "/img/b10.png" }),
    ];
    const result = summariseSubtypes(
      items,
      (i) => i.Type.startsWith("Weapon") || i.Type.startsWith("Archery"),
      (i) => typeParensSubtype(i.Type),
    );
    expect(result).toEqual([
      { name: "1H Slash", slug: "1h-slash", count: 3, imageUrl: "/img/s50.png" },
      { name: "Bow", slug: "bow", count: 1, imageUrl: "/img/b10.png" },
    ]);
  });

  test("falls back to highest-rarity then first-encountered when levels tie", () => {
    const items = [
      fakeItem({ Name: "A", Type: "Other", Level: 5, Rarity: 1, imageUrl: "/a.png" }),
      fakeItem({ Name: "B", Type: "Other", Level: 5, Rarity: 3, imageUrl: "/b.png" }),
      fakeItem({ Name: "C", Type: "Other", Level: 5, Rarity: 3, imageUrl: "/c.png" }),
    ];
    const result = summariseSubtypes(items, () => true, (i) => typeParensSubtype(i.Type));
    expect(result[0].imageUrl).toBe("/b.png");
  });

  test("imageUrl is null when no item in subtype has an image", () => {
    const items = [
      fakeItem({ Type: "Weapon (Bow)", imageUrl: null }),
      fakeItem({ Type: "Weapon (Bow)", imageUrl: null }),
    ];
    const result = summariseSubtypes(items, () => true, (i) => typeParensSubtype(i.Type));
    expect(result[0].imageUrl).toBeNull();
  });

  test("ignores items where matches() is false", () => {
    const items = [
      fakeItem({ Type: "Weapon (Bow)" }),
      fakeItem({ Type: "Resource (Bone Tier 1)" }),
    ];
    const result = summariseSubtypes(items, (i) => i.Type.startsWith("Weapon"), (i) => typeParensSubtype(i.Type));
    expect(result).toHaveLength(1);
  });

  test("sorts results alphabetically by name", () => {
    const items = [
      fakeItem({ Type: "Weapon (Sword)" }),
      fakeItem({ Type: "Weapon (Axe)" }),
      fakeItem({ Type: "Weapon (Bow)" }),
    ];
    const result = summariseSubtypes(items, () => true, (i) => typeParensSubtype(i.Type));
    expect(result.map((s) => s.name)).toEqual(["Axe", "Bow", "Sword"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `web/`: `npm test -- subtypes.test.ts`
Expected: FAIL — module `./subtypes` not found.

- [ ] **Step 3: Implement `lib/subtypes.ts`**

Create `web/src/lib/subtypes.ts`:

```ts
// Generic subtype-summary helpers used by the cards-only category landings.
// Per-category public APIs (allWeaponSubtypes, etc.) are added in later tasks.

import type { Item } from "./types";

const PARENS_RE = /\(([^)]+)\)/;

export interface SubtypeSummary {
  name: string;
  slug: string;
  count: number;
  imageUrl: string | null;
}

/** Extract the content inside parens from a Type string, or return the whole input. */
export function typeParensSubtype(rawType: string): string {
  const m = rawType.match(PARENS_RE);
  return (m ? m[1] : rawType).trim();
}

/** Slug a subtype name for use in URLs. "1H Slash" -> "1h-slash". */
export function subtypeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build per-subtype summaries from a list of items. Items where `matches()`
 * returns false are skipped. Within each subtype, the representative item
 * (used for `imageUrl`) is the highest-level one; ties are broken by highest
 * rarity, then by first-encountered order.
 */
export function summariseSubtypes(
  items: Item[],
  matches: (item: Item) => boolean,
  subtypeOf: (item: Item) => string,
): SubtypeSummary[] {
  interface Bucket {
    count: number;
    repItem: Item;
  }
  const buckets = new Map<string, Bucket>();
  for (const item of items) {
    if (!matches(item)) continue;
    const name = subtypeOf(item);
    const existing = buckets.get(name);
    if (!existing) {
      buckets.set(name, { count: 1, repItem: item });
      continue;
    }
    existing.count += 1;
    const itemLevel = item.Level ?? 0;
    const repLevel = existing.repItem.Level ?? 0;
    if (
      itemLevel > repLevel ||
      (itemLevel === repLevel && (item.Rarity ?? 0) > (existing.repItem.Rarity ?? 0))
    ) {
      existing.repItem = item;
    }
  }
  return Array.from(buckets.entries())
    .map(([name, b]) => ({
      name,
      slug: subtypeSlug(name),
      count: b.count,
      imageUrl: b.repItem.imageUrl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `web/`: `npm test -- subtypes.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/subtypes.ts web/src/lib/subtypes.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(subtypes): generic subtype-summary helpers + tests"
```

---

## Task 2: Per-category accessors for simple categories

**Files:**
- Modify: `web/src/lib/subtypes.ts` (append exports)
- Modify: `web/src/lib/subtypes.test.ts` (append integration tests)

Add four memoised accessors that scan the live item index and produce summaries. These are the "public APIs" used by the landing pages.

- [ ] **Step 1: Append failing integration tests**

Append to `web/src/lib/subtypes.test.ts`:

```ts
describe("per-category accessors", () => {
  test("allWeaponSubtypes returns 11 entries with expected names", async () => {
    const { allWeaponSubtypes } = await import("./subtypes");
    const result = allWeaponSubtypes();
    expect(result).toHaveLength(11);
    expect(result.map((s) => s.name)).toEqual([
      "1H Crush", "1H Pierce", "1H Slash", "1H Whip",
      "2H Crush", "2H Pierce", "2H Slash", "2H Staff",
      "Arrow", "Bow", "Quiver",
    ]);
  });

  test("allArmorSubtypes returns 5 entries", async () => {
    const { allArmorSubtypes } = await import("./subtypes");
    const result = allArmorSubtypes();
    expect(result.map((s) => s.name)).toEqual([
      "Breastplate", "Helmet", "Legging", "Shield", "Sleeve",
    ]);
  });

  test("allOtherSubtypes returns 4 entries", async () => {
    const { allOtherSubtypes } = await import("./subtypes");
    const result = allOtherSubtypes();
    expect(result.map((s) => s.name)).toEqual([
      "Purchase", "Rune", "Travel Gear", "Trophy",
    ]);
  });

  test("allPotionSubtypes contains 'Agility' and 'Other'", async () => {
    const { allPotionSubtypes } = await import("./subtypes");
    const result = allPotionSubtypes();
    const names = result.map((s) => s.name);
    expect(names).toContain("Agility");
    expect(names).toContain("Other");
    // 32 distinct potion subtypes total (per spec).
    expect(result.length).toBe(32);
  });

  test("subtype summaries carry imageUrl from a real item", async () => {
    const { allWeaponSubtypes } = await import("./subtypes");
    const slash = allWeaponSubtypes().find((s) => s.name === "1H Slash");
    expect(slash).toBeDefined();
    // Every weapon-1H-Slash row in the data has a non-null imageUrl, so
    // the picked representative will too.
    expect(typeof slash!.imageUrl).toBe("string");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `web/`: `npm test -- subtypes.test.ts`
Expected: FAIL — accessors not exported yet.

- [ ] **Step 3: Implement the accessors**

Append to `web/src/lib/subtypes.ts`:

```ts
// ─── Per-category accessors (lazy-memoised) ─────────────────────────────────

import { allItems } from "./data";

let _weapons: SubtypeSummary[] | null = null;
let _armor: SubtypeSummary[] | null = null;
let _other: SubtypeSummary[] | null = null;
let _potions: SubtypeSummary[] | null = null;

/** Strip " Rank N" from a potion's name and resolve its display subtype. */
function potionSubtypeOf(name: string): string {
  const noRank = name.replace(/\s+Rank\s+\d+$/i, "").trim();
  const m = noRank.match(/^(.+?)\s+Potion$/);
  if (m) return m[1].trim();
  if (/^Potion of /i.test(noRank)) return noRank;
  return "Other";
}

export function allWeaponSubtypes(): SubtypeSummary[] {
  if (_weapons) return _weapons;
  _weapons = summariseSubtypes(
    allItems(),
    (i) => i.Type.startsWith("Weapon") || i.Type.startsWith("Archery"),
    (i) => typeParensSubtype(i.Type),
  );
  return _weapons;
}

export function allArmorSubtypes(): SubtypeSummary[] {
  if (_armor) return _armor;
  _armor = summariseSubtypes(
    allItems(),
    (i) => i.Type.startsWith("Armor") || i.Type === "Shield",
    (i) => typeParensSubtype(i.Type),
  );
  return _armor;
}

export function allOtherSubtypes(): SubtypeSummary[] {
  if (_other) return _other;
  _other = summariseSubtypes(
    allItems(),
    (i) => {
      const t = i.Type;
      return (
        !t.startsWith("Weapon") &&
        !t.startsWith("Archery") &&
        !t.startsWith("Armor") &&
        t !== "Shield" &&
        t !== "Potion" &&
        !t.startsWith("Gem") &&
        t !== "Pet" &&
        t !== "Pets" &&
        !t.startsWith("Tool") &&
        !t.startsWith("Resource")
      );
    },
    (i) => typeParensSubtype(i.Type),
  );
  return _other;
}

export function allPotionSubtypes(): SubtypeSummary[] {
  if (_potions) return _potions;
  _potions = summariseSubtypes(
    allItems(),
    (i) => i.Type === "Potion",
    (i) => potionSubtypeOf(i.Name),
  );
  return _potions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `web/`: `npm test`
Expected: 14 new tests pass (9 from Task 1 + 5 here); previously-existing 45 still pass; total 59.

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/subtypes.ts web/src/lib/subtypes.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(subtypes): per-category accessors for weapons/armor/other/potions"
```

---

## Task 3: Gem-specific accessors

**Files:**
- Modify: `web/src/lib/subtypes.ts`
- Modify: `web/src/lib/subtypes.test.ts`

Three gem accessors: colors (L1), identities for one color (L2), and effect-tag filter (cross-color).

- [ ] **Step 1: Append failing tests**

```ts
describe("gem accessors", () => {
  test("allGemColors returns the 6 gem colors", async () => {
    const { allGemColors } = await import("./subtypes");
    const result = allGemColors();
    expect(result.map((s) => s.name)).toEqual([
      "Black", "Blue", "Green", "Grey", "Red", "White",
    ]);
  });

  test("gemIdentitiesForColor returns identities for a known color", async () => {
    const { gemIdentitiesForColor } = await import("./subtypes");
    const result = gemIdentitiesForColor("black");
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    // Each identity name has had its " Rank N" suffix stripped.
    for (const id of result!) {
      expect(id.name).not.toMatch(/\s+Rank\s+\d+$/i);
    }
  });

  test("gemIdentitiesForColor returns null for an unknown color", async () => {
    const { gemIdentitiesForColor } = await import("./subtypes");
    expect(gemIdentitiesForColor("octarine")).toBeNull();
  });

  test("gemsByEffectTag returns items tagged with the given mechanic", async () => {
    const { gemsByEffectTag } = await import("./subtypes");
    const heal = gemsByEffectTag("heal");
    expect(heal).not.toBeNull();
    expect(heal!.length).toBeGreaterThan(0);
    for (const item of heal!) {
      expect(item.Type.startsWith("Gem")).toBe(true);
      expect(item.tags).toContain("heal");
    }
  });

  test("gemsByEffectTag returns null for a tag with no matches", async () => {
    const { gemsByEffectTag } = await import("./subtypes");
    expect(gemsByEffectTag("nonexistent-tag")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `web/`: `npm test -- subtypes.test.ts`
Expected: FAIL — accessors not exported yet.

- [ ] **Step 3: Implement gem accessors**

Append to `web/src/lib/subtypes.ts`:

```ts
// ─── Gem accessors ──────────────────────────────────────────────────────────

import type { Item as GemItem } from "./types"; // alias to avoid duplicate-import lint

const RANK_SUFFIX_RE = /\s+Rank\s+\d+$/i;

let _gemColors: SubtypeSummary[] | null = null;
const _gemIdentitiesByColor: Map<string, SubtypeSummary[]> = new Map();
const _gemsByTag: Map<string, GemItem[]> = new Map();

export function allGemColors(): SubtypeSummary[] {
  if (_gemColors) return _gemColors;
  _gemColors = summariseSubtypes(
    allItems(),
    (i) => i.Type.startsWith("Gem"),
    (i) => typeParensSubtype(i.Type),
  );
  return _gemColors;
}

/**
 * Gem identities (name without " Rank N" suffix) for one color. Returns null
 * if the color slug doesn't match a known gem color.
 */
export function gemIdentitiesForColor(colorSlug: string): SubtypeSummary[] | null {
  const cached = _gemIdentitiesByColor.get(colorSlug);
  if (cached) return cached;
  const color = allGemColors().find((c) => c.slug === colorSlug);
  if (!color) return null;
  const result = summariseSubtypes(
    allItems(),
    (i) => i.Type === `Gem (${color.name})`,
    (i) => i.Name.replace(RANK_SUFFIX_RE, "").trim(),
  );
  _gemIdentitiesByColor.set(colorSlug, result);
  return result;
}

/**
 * All Gem items tagged with `tag` (e.g. "heal"). Returns null if no gems
 * have that tag.
 */
export function gemsByEffectTag(tag: string): GemItem[] | null {
  const cached = _gemsByTag.get(tag);
  if (cached) return cached.length === 0 ? null : cached;
  const filtered = allItems().filter(
    (i) => i.Type.startsWith("Gem") && i.tags.includes(tag),
  );
  _gemsByTag.set(tag, filtered);
  return filtered.length === 0 ? null : filtered;
}
```

Note: `import { allItems } from "./data";` and `import type { Item } from "./types";` are already at the top of the file from Task 2. The alias `GemItem` is redundant — replace `GemItem` in this snippet with `Item` from the existing import.

- [ ] **Step 4: Run tests**

Run from `web/`: `npm test`
Expected: 5 new tests pass; total 64 (previously 59).

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/subtypes.ts web/src/lib/subtypes.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(subtypes): gem accessors (colors, identities, by-effect-tag)"
```

---

## Task 4: Generic `CategoryLanding` component

**Files:**
- Create: `web/src/app/_landings/CategoryLanding.tsx`

A reusable client component that renders the small-card grid pattern. Used by all the new landings. The Materials feature does NOT migrate to this component yet (Task 13 handles that).

- [ ] **Step 1: Create the component**

Create `web/src/app/_landings/CategoryLanding.tsx`:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SubtypeSummary } from "@/lib/subtypes";

export interface ShortcutCard {
  slug: string;
  name: string;
  href: string;
  count: number;
  icon: LucideIcon;
}

interface Props {
  category: { slug: string; label: string };
  primary: { title: string; cards: SubtypeSummary[]; basePath: string };
  special?: { title: string; cards: SubtypeSummary[]; basePath: string };
  shortcuts?: { title: string; cards: ShortcutCard[] };
  backHref?: string;
  backLabel?: string;
}

export function CategoryLanding({
  category,
  primary,
  special,
  shortcuts,
  backHref = "/",
  backLabel = "Back to home",
}: Props) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] mb-4"
      >
        <ChevronLeft size={14} />
        {backLabel}
      </Link>

      <h1 className="font-[family-name:var(--font-display-loaded)] text-2xl text-[var(--color-fg-1)] mb-6 tracking-wide">
        {category.label}
      </h1>

      <Section title={primary.title} cols={5}>
        {primary.cards.map((t) => (
          <TypeCard
            key={t.slug}
            t={t}
            href={`${primary.basePath}/${t.slug}`}
            showCount={false}
          />
        ))}
      </Section>

      {special && special.cards.length > 0 && (
        <Section title={special.title} cols={4} className="mt-8">
          {special.cards.map((t) => (
            <TypeCard
              key={t.slug}
              t={t}
              href={`${special.basePath}/${t.slug}`}
              showCount
              accent
            />
          ))}
        </Section>
      )}

      {shortcuts && shortcuts.cards.length > 0 && (
        <Section title={shortcuts.title} cols={4} className="mt-8">
          {shortcuts.cards.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.slug}
                href={s.href}
                className="block rounded-md border bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)] px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={18} className="text-[var(--color-gold-soft)] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--color-fg-1)] truncate">
                      {s.name}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--color-fg-3)]">
                      {s.count} item{s.count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </Section>
      )}
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
  const gridCols = cols === 5
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
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
  href,
  showCount,
  accent,
}: {
  t: SubtypeSummary;
  href: string;
  showCount: boolean;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "block rounded-md border px-3 py-2.5 transition-colors " +
        (accent
          ? "bg-[var(--color-gold-soft)]/5 border-[var(--color-gold-soft)]/40 hover:border-[var(--color-gold-soft)]/70"
          : "bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)]")
      }
    >
      <div className="flex items-center gap-2.5">
        {t.imageUrl ? (
          <Image
            src={t.imageUrl}
            alt=""
            width={36}
            height={36}
            className="shrink-0 bg-[var(--color-bg-3)] rounded p-0.5"
            unoptimized
          />
        ) : (
          <span
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded bg-[var(--color-bg-3)] border border-[var(--color-border)]"
            aria-hidden="true"
          >
            <Package size={18} className="text-[var(--color-fg-3)]/50" />
          </span>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-fg-1)] truncate">
            {t.name}
          </div>
          {showCount && (
            <div className="text-[11px] font-mono text-[var(--color-fg-3)]">
              {t.count} item{t.count === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/_landings/CategoryLanding.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(landings): generic CategoryLanding component"
```

---

## Task 5: CategoryClient — N-crumb breadcrumb + pets/tools default sort

**Files:**
- Modify: `web/src/app/category/[slug]/CategoryClient.tsx`

The current breadcrumb supports `Category › Subtype`. Gems' L3 needs `Gems › <Color> › <Identity>` with three clickable segments. Also lock Pets default sort to `level-asc` and confirm Tools is `rarity-asc` (it already is, but make sure it stays).

- [ ] **Step 1: Find the existing `lockedSubtype` heading**

Open `web/src/app/category/[slug]/CategoryClient.tsx` and locate the JSX block that renders the heading. It looks like:

```tsx
<h1 className="...">
  {lockedSubtype ? (
    <>
      <Link href={`/category/${category.slug}`} className="...">
        {category.label}
      </Link>{" "}
      <span aria-hidden="true" className="...">›</span>{" "}
      {lockedSubtype}
    </>
  ) : (
    category.label
  )}
</h1>
```

- [ ] **Step 2: Add a new `breadcrumbCrumbs` prop and replace the heading body**

Add `breadcrumbCrumbs?: { label: string; href?: string }[]` to the props type and destructuring. Replace the heading JSX with a generic renderer that handles BOTH the old 2-crumb shorthand (driven by `lockedSubtype`) and the new explicit N-crumb mode (driven by `breadcrumbCrumbs`):

```tsx
{breadcrumbCrumbs && breadcrumbCrumbs.length > 0 ? (
  <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-4xl text-[var(--color-fg-1)]">
    {breadcrumbCrumbs.map((c, i) => (
      <span key={i}>
        {i > 0 && (
          <span aria-hidden="true" className="text-[var(--color-fg-3)] font-light">
            {" "}›{" "}
          </span>
        )}
        {c.href ? (
          <Link href={c.href} className="hover:text-[var(--color-gold-soft)] transition-colors">
            {c.label}
          </Link>
        ) : (
          c.label
        )}
      </span>
    ))}
  </h1>
) : (
  <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-4xl text-[var(--color-fg-1)]">
    {lockedSubtype ? (
      <>
        <Link href={`/category/${category.slug}`} className="hover:text-[var(--color-gold-soft)] transition-colors">
          {category.label}
        </Link>{" "}
        <span aria-hidden="true" className="text-[var(--color-fg-3)] font-light">›</span>{" "}
        {lockedSubtype}
      </>
    ) : (
      category.label
    )}
  </h1>
)}
```

The two branches are kept separate so existing consumers (Materials drilldown) need zero changes — they continue to pass `lockedSubtype` and get the 2-crumb form. Only Gems' L3 page (Task 12) will pass `breadcrumbCrumbs`.

- [ ] **Step 3: Lock pets/tools default sort**

Find the `DEFAULT_SORT_BY_CATEGORY` map. Add a `pets` entry alongside the existing `tools`:

```ts
const DEFAULT_SORT_BY_CATEGORY: Record<string, DefaultSortConfig> = {
  tools: { primary: { column: "rarity", dir: "asc" } },
  pets: { primary: { column: "level", dir: "asc" } },
  gems: {
    primary: { column: "name", dir: "asc" },
    secondary: { column: "level", dir: "asc" },
  },
};
```

This makes Pets explicit so a future change to the global default doesn't silently shift it.

- [ ] **Step 4: Type-check, lint, run tests**

Run from `web/`:
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm test` — 64/64 passing

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/[slug]/CategoryClient.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(categories): N-crumb breadcrumb prop + pets default sort lock"
```

---

## Task 6: Wire Weapons (landing + drilldown + slug branch)

**Files:**
- Create: `web/src/app/category/weapons/WeaponsLanding.tsx`
- Create: `web/src/app/category/weapons/[subtype]/page.tsx`
- Modify: `web/src/app/category/[slug]/page.tsx`

- [ ] **Step 1: Create `WeaponsLanding.tsx`**

```tsx
"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  subtypes: SubtypeSummary[];
}

export function WeaponsLanding({ subtypes }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "weapons", label: "Weapons" }}
      primary={{ title: "By weapon type", cards: subtypes, basePath: "/category/weapons" }}
    />
  );
}
```

- [ ] **Step 2: Create `weapons/[subtype]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allWeaponSubtypes, typeParensSubtype } from "@/lib/subtypes";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allWeaponSubtypes().map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allWeaponSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Weapons`,
    description: `Browse all ${summary.count} ${summary.name} weapons.`,
  };
}

export default async function WeaponSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allWeaponSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("weapons");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) =>
      (i.Type.startsWith("Weapon") || i.Type.startsWith("Archery")) &&
      typeParensSubtype(i.Type) === summary.name,
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={summary.name}
      />
    </Suspense>
  );
}
```

- [ ] **Step 3: Wire `[slug]/page.tsx` to dispatch the Weapons landing**

In `web/src/app/category/[slug]/page.tsx`, after the existing `if (slug === "materials")` branch, add:

```tsx
if (slug === "weapons") {
  const subtypes = allWeaponSubtypes();
  return <WeaponsLanding subtypes={subtypes} />;
}
```

Add the imports at the top:

```ts
import { allWeaponSubtypes } from "@/lib/subtypes";
import { WeaponsLanding } from "../weapons/WeaponsLanding";
```

- [ ] **Step 4: Type-check, lint, run tests**

Run from `web/`:
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm test` — 64/64 passing

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/weapons/WeaponsLanding.tsx" "web/src/app/category/weapons/[subtype]/page.tsx" "web/src/app/category/[slug]/page.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(weapons): cards landing + drilldown route"
```

---

## Task 7: Wire Armor (landing + drilldown + slug branch)

**Files:**
- Create: `web/src/app/category/armor/ArmorLanding.tsx`
- Create: `web/src/app/category/armor/[subtype]/page.tsx`
- Modify: `web/src/app/category/[slug]/page.tsx`

- [ ] **Step 1: Create `ArmorLanding.tsx`**

```tsx
"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  subtypes: SubtypeSummary[];
}

export function ArmorLanding({ subtypes }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "armor", label: "Armor" }}
      primary={{ title: "By slot", cards: subtypes, basePath: "/category/armor" }}
    />
  );
}
```

- [ ] **Step 2: Create `armor/[subtype]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allArmorSubtypes, typeParensSubtype } from "@/lib/subtypes";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allArmorSubtypes().map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allArmorSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Armor`,
    description: `Browse all ${summary.count} ${summary.name} items.`,
  };
}

export default async function ArmorSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allArmorSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("armor");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) =>
      (i.Type.startsWith("Armor") || i.Type === "Shield") &&
      typeParensSubtype(i.Type) === summary.name,
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={summary.name}
      />
    </Suspense>
  );
}
```

- [ ] **Step 3: Add the Armor branch in `[slug]/page.tsx`**

After the Weapons branch added in Task 6, add:

```tsx
if (slug === "armor") {
  const subtypes = allArmorSubtypes();
  return <ArmorLanding subtypes={subtypes} />;
}
```

Update imports:
```ts
import { allArmorSubtypes, allWeaponSubtypes } from "@/lib/subtypes";
import { WeaponsLanding } from "../weapons/WeaponsLanding";
import { ArmorLanding } from "../armor/ArmorLanding";
```

- [ ] **Step 4: Type-check, lint, run tests**

Run from `web/`: `npx tsc --noEmit`, `npm run lint`, `npm test`. All clean / 64 passing.

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/armor/ArmorLanding.tsx" "web/src/app/category/armor/[subtype]/page.tsx" "web/src/app/category/[slug]/page.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(armor): cards landing + drilldown route"
```

---

## Task 8: Wire Other (landing + drilldown + slug branch)

**Files:**
- Create: `web/src/app/category/other/OtherLanding.tsx`
- Create: `web/src/app/category/other/[subtype]/page.tsx`
- Modify: `web/src/app/category/[slug]/page.tsx`

- [ ] **Step 1: Create `OtherLanding.tsx`**

```tsx
"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  subtypes: SubtypeSummary[];
}

export function OtherLanding({ subtypes }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "other", label: "Other" }}
      primary={{ title: "By kind", cards: subtypes, basePath: "/category/other" }}
    />
  );
}
```

- [ ] **Step 2: Create `other/[subtype]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allOtherSubtypes, typeParensSubtype } from "@/lib/subtypes";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allOtherSubtypes().map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allOtherSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Other`,
    description: `Browse all ${summary.count} ${summary.name} items.`,
  };
}

export default async function OtherSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allOtherSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("other");
  if (!cat) notFound();

  // Reuse the category's matches function via findCategoryBySlug, then narrow by subtype.
  const items = allItems().filter(
    (i) => cat.matches(i.Type) && typeParensSubtype(i.Type) === summary.name,
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={summary.name}
      />
    </Suspense>
  );
}
```

- [ ] **Step 3: Add the Other branch in `[slug]/page.tsx`**

```tsx
if (slug === "other") {
  const subtypes = allOtherSubtypes();
  return <OtherLanding subtypes={subtypes} />;
}
```

Update imports to add `allOtherSubtypes` and `OtherLanding`.

- [ ] **Step 4: Verify (tsc, lint, tests)**

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/other/OtherLanding.tsx" "web/src/app/category/other/[subtype]/page.tsx" "web/src/app/category/[slug]/page.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(other): cards landing + drilldown route"
```

---

## Task 9: Wire Potions (landing + drilldown + slug branch)

**Files:**
- Create: `web/src/app/category/potions/PotionsLanding.tsx`
- Create: `web/src/app/category/potions/[subtype]/page.tsx`
- Modify: `web/src/app/category/[slug]/page.tsx`

Same shape as the prior tasks, but the subtype is name-derived. The drilldown uses `potionSubtypeOf` (name-based) for filtering instead of `typeParensSubtype`.

- [ ] **Step 1: Create `PotionsLanding.tsx`**

```tsx
"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  subtypes: SubtypeSummary[];
}

export function PotionsLanding({ subtypes }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "potions", label: "Potions" }}
      primary={{ title: "By effect", cards: subtypes, basePath: "/category/potions" }}
    />
  );
}
```

- [ ] **Step 2: Create `potions/[subtype]/page.tsx`**

The filter needs the same `potionSubtypeOf` logic that `summariseSubtypes` used. Re-export it from `lib/subtypes.ts`:

In `web/src/lib/subtypes.ts`, change `function potionSubtypeOf(name: string): string` to `export function potionSubtypeOf(name: string): string` (single keyword change, no other edit needed).

Then create `potions/[subtype]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allPotionSubtypes, potionSubtypeOf } from "@/lib/subtypes";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allPotionSubtypes().map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allPotionSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Potions`,
    description: `Browse all ${summary.count} ${summary.name} potions.`,
  };
}

export default async function PotionSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allPotionSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("potions");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) => i.Type === "Potion" && potionSubtypeOf(i.Name) === summary.name,
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={summary.name}
      />
    </Suspense>
  );
}
```

- [ ] **Step 3: Add the Potions branch in `[slug]/page.tsx`**

```tsx
if (slug === "potions") {
  const subtypes = allPotionSubtypes();
  return <PotionsLanding subtypes={subtypes} />;
}
```

Update imports.

- [ ] **Step 4: Verify (tsc, lint, tests)**

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/potions/PotionsLanding.tsx" "web/src/app/category/potions/[subtype]/page.tsx" "web/src/app/category/[slug]/page.tsx" web/src/lib/subtypes.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(potions): cards landing + drilldown route"
```

---

## Task 10: Wire Gems L1 + L2 (landing + color route + slug branch)

**Files:**
- Create: `web/src/app/category/gems/GemsLanding.tsx`
- Create: `web/src/app/category/gems/[color]/page.tsx`
- Modify: `web/src/app/category/[slug]/page.tsx`

L1 (`/category/gems`) shows 6 color cards plus 5 effect-shortcut cards. L2 (`/category/gems/<color>`) shows gem-identity cards.

- [ ] **Step 1: Create `GemsLanding.tsx` with shortcuts**

```tsx
"use client";

import { Flame, Heart, Skull, Sparkles, Zap } from "lucide-react";
import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

const EFFECT_SHORTCUTS = [
  { tag: "dd", label: "DD", icon: Zap },
  { tag: "dot", label: "DoT", icon: Flame },
  { tag: "aura", label: "Aura", icon: Sparkles },
  { tag: "heal", label: "Heal", icon: Heart },
  { tag: "debuff", label: "Debuff", icon: Skull },
] as const;

interface Props {
  colors: SubtypeSummary[];
  effectCounts: Record<string, number>;
}

export function GemsLanding({ colors, effectCounts }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "gems", label: "Gems" }}
      primary={{ title: "By color", cards: colors, basePath: "/category/gems" }}
      shortcuts={{
        title: "By effect",
        cards: EFFECT_SHORTCUTS.map((eff) => ({
          slug: eff.tag,
          name: eff.label,
          href: `/category/gems/effect/${eff.tag}`,
          count: effectCounts[eff.tag] ?? 0,
          icon: eff.icon,
        })),
      }}
    />
  );
}
```

- [ ] **Step 2: Create `gems/[color]/page.tsx` (L2 — identity cards)**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Package } from "lucide-react";
import { allGemColors, gemIdentitiesForColor } from "@/lib/subtypes";

export function generateStaticParams() {
  return allGemColors().map((c) => ({ color: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ color: string }>;
}) {
  const { color } = await params;
  const summary = allGemColors().find((c) => c.slug === color);
  if (!summary) return {};
  return {
    title: `${summary.name} Gems`,
    description: `Browse all ${summary.count} ${summary.name} gems.`,
  };
}

export default async function GemColorPage({
  params,
}: {
  params: Promise<{ color: string }>;
}) {
  const { color } = await params;
  const colorSummary = allGemColors().find((c) => c.slug === color);
  if (!colorSummary) notFound();
  const identities = gemIdentitiesForColor(color);
  if (!identities) notFound();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href="/category/gems"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] mb-4"
      >
        <ChevronLeft size={14} />
        Back to Gems
      </Link>

      <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-4xl text-[var(--color-fg-1)] mb-6">
        <Link
          href="/category/gems"
          className="hover:text-[var(--color-gold-soft)] transition-colors"
        >
          Gems
        </Link>{" "}
        <span aria-hidden="true" className="text-[var(--color-fg-3)] font-light">›</span>{" "}
        {colorSummary.name}
      </h1>

      <h2 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-3)] mb-2">
        By gem
      </h2>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {identities.map((id) => (
          <Link
            key={id.slug}
            href={`/category/gems/${color}/${id.slug}`}
            className="block rounded-md border bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)] px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {id.imageUrl ? (
                <Image
                  src={id.imageUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="shrink-0 bg-[var(--color-bg-3)] rounded p-0.5"
                  unoptimized
                />
              ) : (
                <span
                  className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded bg-[var(--color-bg-3)] border border-[var(--color-border)]"
                  aria-hidden="true"
                >
                  <Package size={18} className="text-[var(--color-fg-3)]/50" />
                </span>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--color-fg-1)] truncate">
                  {id.name}
                </div>
                <div className="text-[11px] font-mono text-[var(--color-fg-3)]">
                  {id.count} rank{id.count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the Gems branch in `[slug]/page.tsx`**

```tsx
if (slug === "gems") {
  const colors = allGemColors();
  // Effect counts: how many gem items match each tag.
  const tags = ["dd", "dot", "aura", "heal", "debuff"] as const;
  const effectCounts = Object.fromEntries(
    tags.map((t) => [t, gemsByEffectTag(t)?.length ?? 0]),
  ) as Record<string, number>;
  return <GemsLanding colors={colors} effectCounts={effectCounts} />;
}
```

Update imports to include `allGemColors`, `gemsByEffectTag`, and `GemsLanding`.

- [ ] **Step 4: Verify (tsc, lint, tests)**

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/gems/GemsLanding.tsx" "web/src/app/category/gems/[color]/page.tsx" "web/src/app/category/[slug]/page.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(gems): L1 cards landing + L2 color route"
```

---

## Task 11: Wire Gems L3 — identity → ranks table

**Files:**
- Create: `web/src/app/category/gems/[color]/[identity]/page.tsx`

Three-segment breadcrumb: `Gems › <Color> › <Identity>`.

- [ ] **Step 1: Create `gems/[color]/[identity]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allGemColors, gemIdentitiesForColor } from "@/lib/subtypes";
import { CategoryClient } from "../../../[slug]/CategoryClient";

export function generateStaticParams() {
  const params: { color: string; identity: string }[] = [];
  for (const color of allGemColors()) {
    const identities = gemIdentitiesForColor(color.slug) ?? [];
    for (const id of identities) {
      params.push({ color: color.slug, identity: id.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ color: string; identity: string }>;
}) {
  const { color, identity } = await params;
  const colorSummary = allGemColors().find((c) => c.slug === color);
  const idSummary = colorSummary
    ? gemIdentitiesForColor(color)?.find((i) => i.slug === identity)
    : undefined;
  if (!colorSummary || !idSummary) return {};
  return {
    title: `${idSummary.name} — ${colorSummary.name} Gems`,
    description: `All ${idSummary.count} ranks of ${idSummary.name}.`,
  };
}

export default async function GemIdentityPage({
  params,
}: {
  params: Promise<{ color: string; identity: string }>;
}) {
  const { color, identity } = await params;
  const colorSummary = allGemColors().find((c) => c.slug === color);
  if (!colorSummary) notFound();
  const idList = gemIdentitiesForColor(color);
  if (!idList) notFound();
  const idSummary = idList.find((i) => i.slug === identity);
  if (!idSummary) notFound();

  const cat = findCategoryBySlug("gems");
  if (!cat) notFound();

  // Items: the same gem identity (name-without-rank) and same color.
  const items = allItems().filter(
    (i) =>
      i.Type === `Gem (${colorSummary.name})` &&
      i.Name.replace(/\s+Rank\s+\d+$/i, "").trim() === idSummary.name,
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={idSummary.name}
        breadcrumbCrumbs={[
          { label: "Gems", href: "/category/gems" },
          { label: colorSummary.name, href: `/category/gems/${color}` },
          { label: idSummary.name },
        ]}
      />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify (tsc, lint, tests)**

- [ ] **Step 3: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/gems/[color]/[identity]/page.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(gems): L3 identity ranks table with 3-segment breadcrumb"
```

---

## Task 12: Wire Gems effect shortcut route

**Files:**
- Create: `web/src/app/category/gems/effect/[tag]/page.tsx`

`/category/gems/effect/heal` → flat ItemTable showing all gems tagged "heal" across all colors.

- [ ] **Step 1: Create `gems/effect/[tag]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findCategoryBySlug } from "@/lib/categories";
import { gemsByEffectTag } from "@/lib/subtypes";
import { CategoryClient } from "../../../[slug]/CategoryClient";

const EFFECT_LABELS: Record<string, string> = {
  dd: "DD",
  dot: "DoT",
  aura: "Aura",
  heal: "Heal",
  debuff: "Debuff",
};

export function generateStaticParams() {
  return Object.keys(EFFECT_LABELS).map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const label = EFFECT_LABELS[tag];
  const items = gemsByEffectTag(tag);
  if (!label || !items) return {};
  return {
    title: `${label} Gems`,
    description: `${items.length} gems tagged ${label}.`,
  };
}

export default async function GemsByEffectPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const label = EFFECT_LABELS[tag];
  if (!label) notFound();
  const items = gemsByEffectTag(tag);
  if (!items) notFound();

  const cat = findCategoryBySlug("gems");
  if (!cat) notFound();

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={label}
        breadcrumbCrumbs={[
          { label: "Gems", href: "/category/gems" },
          { label: "Effect" },
          { label },
        ]}
      />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify (tsc, lint, tests)**

- [ ] **Step 3: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/gems/effect/[tag]/page.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(gems): cross-color effect shortcut route /category/gems/effect/[tag]"
```

---

## Task 13: Refactor `MaterialsLanding` to wrap `CategoryLanding`

**Files:**
- Modify: `web/src/app/category/materials/MaterialsLanding.tsx`

Final consolidation. `MaterialsLanding` becomes a thin adapter from `MaterialTypeSummary` (Materials' shape) to the props `CategoryLanding` expects.

- [ ] **Step 1: Replace the body of `MaterialsLanding.tsx`**

```tsx
"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { MaterialTypeSummary } from "@/lib/data";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  tiered: MaterialTypeSummary[];
  special: MaterialTypeSummary[];
}

function toSubtype(s: MaterialTypeSummary): SubtypeSummary {
  return { name: s.name, slug: s.slug, count: s.count, imageUrl: s.imageUrl };
}

export function MaterialsLanding({ tiered, special }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "materials", label: "Materials" }}
      primary={{
        title: "Tiered (T1–T30)",
        cards: tiered.map(toSubtype),
        basePath: "/category/materials",
      }}
      special={{
        title: "Special",
        cards: special.map(toSubtype),
        basePath: "/category/materials",
      }}
      backHref="/"
      backLabel="All categories"
    />
  );
}
```

The old internal `Section` and `TypeCard` components in this file become unused — delete them.

- [ ] **Step 2: Verify (tsc, lint, tests)**

Run from `web/`: `npx tsc --noEmit`, `npm run lint`, `npm test`.

- [ ] **Step 3: Visual sanity check**

The Materials landing should look IDENTICAL to before. The card density, accent colors, image placement, and "Back to home" link should all behave the same. If you can run the dev server, compare `/category/materials` before and after — there should be no visual diff. If something looks off, revert this task and ship without the consolidation (the spec acknowledges the consolidation is desirable but not required for correctness).

- [ ] **Step 4: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add "web/src/app/category/materials/MaterialsLanding.tsx"
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "refactor(materials): MaterialsLanding wraps generic CategoryLanding"
```

---

## Task 14: Build pipeline + dev-server smoke test

**Files:**
- None modified; verification gate.

- [ ] **Step 1: Re-run the data build pipeline**

Run from `web/`: `npm run build:data`
Expected: completes without error.

- [ ] **Step 2: Final sweep**

Run from `web/`:
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm test` — 64/64 passing (or higher if implementer added more tests)

- [ ] **Step 3: Dev-server click-through**

Run from `web/`: `npm run dev`. Visit each in a browser:

1. `/category/weapons` — 11 cards (1H Crush, …, Quiver) with images.
2. `/category/weapons/1h-slash` — drilldown with 60 items, breadcrumb "Weapons › 1H Slash" (Weapons clickable).
3. `/category/armor` — 5 cards.
4. `/category/armor/breastplate` — 163 items, breadcrumb "Armor › Breastplate".
5. `/category/other` — 4 cards.
6. `/category/other/rune` — 566 items, breadcrumb "Other › Rune".
7. `/category/potions` — 32 cards (Agility, Armor, … Other).
8. `/category/potions/agility` — items, breadcrumb "Potions › Agility".
9. `/category/gems` — 6 color cards + 5 effect shortcut cards (DD/DoT/Aura/Heal/Debuff with item counts).
10. `/category/gems/black` — gem-identity cards, breadcrumb "Gems › Black".
11. `/category/gems/black/<some-identity>` — ranks table, 3-segment breadcrumb "Gems › Black › <Identity>".
12. `/category/gems/effect/heal` — flat table of heal-tagged gems, breadcrumb "Gems › Effect › Heal".
13. `/category/materials` — looks identical to pre-Task-13.
14. `/category/pets` — flat table (no landing redesign).
15. `/category/tools` — flat table, default sort rarity-asc.
16. `/category/weapons/nonexistent` — 404.
17. `/category/gems/octarine` — 404.
18. `/category/gems/effect/notatag` — 404.

- [ ] **Step 4: Fix anything off as follow-up commits, then mark plan complete.**

---

## Self-review

- **Spec coverage:**
  - Generic helpers (`subtypes.ts`, `summariseSubtypes`, `subtypeSlug`, `typeParensSubtype`) ✓ Task 1
  - Per-category accessors (Weapons/Armor/Other/Potions) ✓ Task 2
  - Gem accessors (colors, identities, by-tag) ✓ Task 3
  - Generic `CategoryLanding` ✓ Task 4
  - CategoryClient breadcrumb extension + Pets/Tools default sort ✓ Task 5
  - Per-category landing + drilldown for the simple categories ✓ Tasks 6–9
  - Gems 3-tier ✓ Tasks 10–11
  - Gems effect shortcut route ✓ Task 12
  - MaterialsLanding refactor ✓ Task 13
  - Build + dev smoke ✓ Task 14
- **Placeholder scan:** No "TBD", "TODO", "implement later", or vague guidance. Every code step shows the full code; every test step has assertions; every commit has the exact message.
- **Type consistency:** `SubtypeSummary` defined Task 1, consumed by the per-category accessors (Tasks 2–3), `CategoryLanding` (Task 4), every per-category landing (Tasks 6–10), and finally adapted from `MaterialTypeSummary` in Task 13. `breadcrumbCrumbs` shape (Task 5) consumed by the Gems L3 page (Task 11) and effect page (Task 12). `lockedSubtype` continues to be a string everywhere.
