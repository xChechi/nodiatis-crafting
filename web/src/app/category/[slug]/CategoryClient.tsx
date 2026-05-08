"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Flame,
  Heart,
  Skull,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Item, RarityLabel } from "@/lib/types";

interface CategorySerializable {
  slug: string;
  label: string;
  icon: string;
}
import { ItemTable } from "@/components/ItemTable";
import { CategoryIcon } from "@/components/CategoryIcon";

export type SortColumn =
  | "name"
  | "rarity"
  | "level"
  | "tier"
  | "damage"
  | "armor"
  | "cost"
  | "weight";
export type SortDir = "asc" | "desc";
export interface SortState {
  column: SortColumn;
  dir: SortDir;
}

const RARITY_OPTIONS: RarityLabel[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const SORT_COLUMNS: SortColumn[] = [
  "name",
  "rarity",
  "level",
  "tier",
  "damage",
  "armor",
  "cost",
  "weight",
];
interface DefaultSortConfig {
  primary: SortState;
  secondary?: SortState;
}

// Level-asc is the most useful default for game items (browse from low to
// high). The sort selector / column headers / URL `?sort=` still override.
const DEFAULT_SORT: DefaultSortConfig = { primary: { column: "level", dir: "asc" } };

// Per-category default-sort overrides. Tools have many one-off items where
// rarity is more useful than level for browsing. Gems have many recurring
// names across ranks — sort by name and tiebreak by level so each gem's
// rank progression reads top-to-bottom. Materials use tier for browsing.
const DEFAULT_SORT_BY_CATEGORY: Record<string, DefaultSortConfig> = {
  tools: { primary: { column: "rarity", dir: "asc" } },
  pets: { primary: { column: "level", dir: "asc" } },
  materials: { primary: { column: "tier", dir: "asc" } },
  gems: {
    primary: { column: "name", dir: "asc" },
    secondary: { column: "level", dir: "asc" },
  },
};

function defaultSortFor(categorySlug: string): DefaultSortConfig {
  return DEFAULT_SORT_BY_CATEGORY[categorySlug] ?? DEFAULT_SORT;
}

function sortStateEquals(a: SortState | null, b: SortState | null | undefined): boolean {
  if (!a || !b) return a == null && b == null;
  return a.column === b.column && a.dir === b.dir;
}

// Effect shortcuts shown on the gems landing card view (under the gem-color
// cards, after a separator). Tag values match the consolidated TAG_RULES in
// lib/tags.ts.
interface EffectShortcut {
  tag: string;
  label: string;
  icon: LucideIcon;
}

const GEM_EFFECT_SHORTCUTS: ReadonlyArray<EffectShortcut> = [
  { tag: "dd", label: "DD", icon: Zap },
  { tag: "dot", label: "DoT", icon: Flame },
  { tag: "aura", label: "Aura", icon: Sparkles },
  { tag: "heal", label: "Heal", icon: Heart },
  { tag: "debuff", label: "Debuff", icon: Skull },
];

function isRarityLabel(v: string | null): v is RarityLabel {
  return v !== null && (RARITY_OPTIONS as string[]).includes(v);
}
function isSortColumn(v: string | null): v is SortColumn {
  return v !== null && (SORT_COLUMNS as string[]).includes(v);
}
function isSortDir(v: string | null): v is SortDir {
  return v === "asc" || v === "desc";
}

function damageMid(d: string | undefined): number {
  if (!d) return 0;
  const m = d.match(/(\d+)\s*-\s*(\d+)/);
  if (m) return (parseInt(m[1], 10) + parseInt(m[2], 10)) / 2;
  const n = parseInt(d, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extract a short, user-friendly sub-type label from a raw `Type` string.
 * "Armor (Sleeve)" → "Sleeve"
 * "Weapon (1H Slash)" → "1H Slash"
 * "Shield" → "Shield"  (no parens)
 * "Potion" → "Potion"
 */
function subtypeLabel(rawType: string): string {
  const m = rawType.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : rawType.trim();
}

/**
 * Derive a sub-type from a potion's NAME (Type field is always just "Potion").
 * Recognized patterns:
 *   "Agility Potion Rank 5"     → "Agility"
 *   "Armor Potion"              → "Armor"
 *   "Potion of Blessings Rank 3"→ "Potion of Blessings"
 *   "Jackopot Rank 9"           → "Jackopot"
 *   "Gate" / "Recall"           → "Other" (single-instance singletons grouped)
 */
function potionSubtype(name: string): string {
  // Strip " Rank N" suffix first
  const noRank = name.replace(/\s+Rank\s+\d+$/i, "").trim();
  // "Foo Potion" → "Foo"  ;  "Potion of Foo" stays as-is
  const m = noRank.match(/^(.+?)\s+Potion$/);
  if (m) return m[1].trim();
  if (/^Potion of /i.test(noRank)) return noRank;
  // Singletons (Gate, Recall) — group under "Other"
  return "Other";
}

/**
 * Pick a grouping key for an item based on the category we're in.
 * Categories whose `Type` field is uninformative (Potions: all "Potion")
 * derive the group from the name pattern instead.
 */
function groupKeyFor(item: Item, categorySlug: string): string {
  if (categorySlug === "potions") return potionSubtype(item.Name);
  return subtypeLabel(item.Type);
}

/**
 * Optional second-level grouping. For gems we want a 3-tier flow:
 *   color → gem-type → ranks
 * Returns null for categories that don't need a second level.
 */
function secondaryGroupKeyFor(
  item: Item,
  categorySlug: string,
): string | null {
  if (categorySlug === "gems") {
    // Strip " Rank N" suffix to get the gem identity (singletons return as-is).
    return item.Name.replace(/\s+Rank\s+\d+$/i, "").trim();
  }
  return null;
}

// Natural-sort name compare — "Rank 3" comes before "Rank 10"
const cmpName = (x: Item, y: Item) =>
  x.Name.localeCompare(y.Name, undefined, {
    numeric: true,
    sensitivity: "base",
  });

function compareSingle(a: Item, b: Item, sort: SortState): number {
  const dir = sort.dir === "asc" ? 1 : -1;
  switch (sort.column) {
    case "name":
      return cmpName(a, b) * dir;
    case "rarity":
      return ((a.Rarity ?? 0) - (b.Rarity ?? 0)) * dir;
    case "level":
      return ((a.Level ?? 0) - (b.Level ?? 0)) * dir;
    case "tier":
      return ((a.tier ?? 0) - (b.tier ?? 0)) * dir;
    case "damage":
      return (damageMid(a.Damage) - damageMid(b.Damage)) * dir;
    case "armor":
      return ((a.ArmorClass ?? 0) - (b.ArmorClass ?? 0)) * dir;
    case "cost":
      return ((a.Cost ?? 0) - (b.Cost ?? 0)) * dir;
    case "weight":
      return ((a.Weight ?? 0) - (b.Weight ?? 0)) * dir;
  }
}

/**
 * Compare two items by primary sort, then by secondary sort as a tiebreak.
 * Falls back to natural-sort name if both sort columns produce a tie.
 */
function compareItems(
  a: Item,
  b: Item,
  primary: SortState,
  secondary: SortState | null,
): number {
  const p = compareSingle(a, b, primary);
  if (p !== 0) return p;
  if (secondary && secondary.column !== primary.column) {
    const s = compareSingle(a, b, secondary);
    if (s !== 0) return s;
  }
  return cmpName(a, b);
}

export function CategoryClient({
  category,
  items,
  lockedSubtype,
  breadcrumbCrumbs,
}: {
  category: CategorySerializable;
  items: Item[];
  lockedSubtype?: string;
  breadcrumbCrumbs?: { label: string; href?: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize from URL — runs once. State is the source of truth thereafter
  // (writing back to the URL via useEffect below). Lazy init avoids re-reading
  // searchParams on every render.
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [rarityFilter, setRarityFilter] = useState<RarityLabel | "all">(() => {
    const v = searchParams.get("rarity");
    return isRarityLabel(v) ? v : "all";
  });
  const [levelMin, setLevelMin] = useState(() => searchParams.get("lmin") ?? "");
  const [levelMax, setLevelMax] = useState(() => searchParams.get("lmax") ?? "");
  const [tierMin, setTierMin] = useState(() => searchParams.get("tmin") ?? "");
  const [tierMax, setTierMax] = useState(() => searchParams.get("tmax") ?? "");
  const [subtypeFilter, setSubtypeFilter] = useState<string | "all">(
    () => (lockedSubtype ? "all" : searchParams.get("st") ?? "all"),
  );
  // Secondary (level-2) filter — currently only used for gems
  // (color → gem-type → ranks). URL: `?gem=<gem-name>`.
  const [secondaryFilter, setSecondaryFilter] = useState<string | "all">(
    () => searchParams.get("gem") ?? "all",
  );
  // Spell-mechanic tag filter (heal, dot, cure, aura, ...). URL: `?tag=heal`
  const [tagFilter, setTagFilter] = useState<string | "all">(
    () => searchParams.get("tag") ?? "all",
  );
  const defSort: DefaultSortConfig = useMemo(
    () => defaultSortFor(category.slug),
    [category.slug],
  );
  const [sort, setSort] = useState<SortState>(() => {
    const fallback = defSort.primary;
    const col = searchParams.get("sort");
    const dir = searchParams.get("dir");
    return {
      column: isSortColumn(col) ? col : fallback.column,
      dir: isSortDir(dir) ? dir : fallback.dir,
    };
  });
  // Optional secondary sort applied as a tiebreak. URL: `?sort2=...&dir2=...`.
  // Falls back to the per-category default secondary when no URL param is set
  // (e.g. gems default to name → level).
  const [sort2, setSort2] = useState<SortState | null>(() => {
    const col = searchParams.get("sort2");
    const dir = searchParams.get("dir2");
    if (isSortColumn(col)) {
      return { column: col, dir: isSortDir(dir) ? dir : "asc" };
    }
    return defSort.secondary ?? null;
  });
  // showFilters is UI-only — not synced to URL
  const [showFilters, setShowFilters] = useState(false);
  // When true, the user explicitly opted out of the sub-category card view
  // for this session and wants to see all items in one flat list.
  const [forceFlatList, setForceFlatList] = useState(false);

  // Sync state → URL. Only includes non-default values to keep the URL clean.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search);
    if (rarityFilter !== "all") params.set("rarity", rarityFilter);
    if (levelMin) params.set("lmin", levelMin);
    if (levelMax) params.set("lmax", levelMax);
    if (tierMin) params.set("tmin", tierMin);
    if (tierMax) params.set("tmax", tierMax);
    if (!lockedSubtype && subtypeFilter !== "all") params.set("st", subtypeFilter);
    if (secondaryFilter !== "all") params.set("gem", secondaryFilter);
    if (tagFilter !== "all") params.set("tag", tagFilter);
    if (sort.column !== defSort.primary.column) params.set("sort", sort.column);
    if (sort.dir !== defSort.primary.dir) params.set("dir", sort.dir);
    if (sort2 && !sortStateEquals(sort2, defSort.secondary ?? null)) {
      params.set("sort2", sort2.column);
      if (sort2.dir !== "asc") params.set("dir2", sort2.dir);
    }

    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    const current = searchParams.toString();
    const currentUrl = current ? `${pathname}?${current}` : pathname;
    if (next !== currentUrl) {
      router.replace(next, { scroll: false });
    }
  }, [
    search,
    rarityFilter,
    levelMin,
    levelMax,
    tierMin,
    tierMax,
    subtypeFilter,
    secondaryFilter,
    tagFilter,
    sort,
    sort2,
    defSort,
    lockedSubtype,
    pathname,
    router,
    searchParams,
  ]);

  // Available sub-types in this category. Some categories (potions) derive
  // the sub-type from the item NAME instead of the Type field — see
  // `groupKeyFor`. Only show the filter when there's more than one group.
  const subtypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) {
      const label = groupKeyFor(i, category.slug);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, n]) => ({ label, count: n }));
  }, [items, category.slug]);
  // Only enable the sub-category card view when there's enough density to be
  // useful. Tools, for example, has 41 items spread across 30 sub-types — that
  // would produce 30 nearly-empty cards. Skip when items-per-subtype < 5.
  const itemsPerSubtype = subtypes.length > 0 ? items.length / subtypes.length : 0;
  const showSubtypeFilter = subtypes.length > 1 && itemsPerSubtype >= 5;

  // Level-2 groups within the currently selected subtype (e.g. for gems,
  // gem-types within the selected color). Empty unless category supports
  // a secondary key AND a primary subtype is selected.
  const secondaryGroups = useMemo(() => {
    if (subtypeFilter === "all") return [];
    const filteredItems = items.filter(
      (i) => groupKeyFor(i, category.slug) === subtypeFilter,
    );
    if (filteredItems.length === 0) return [];
    if (secondaryGroupKeyFor(filteredItems[0], category.slug) === null)
      return [];
    const counts = new Map<string, number>();
    for (const i of filteredItems) {
      const k = secondaryGroupKeyFor(i, category.slug);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, n]) => ({ label, count: n }));
  }, [items, subtypeFilter, category.slug]);
  const showSecondaryCards =
    secondaryGroups.length > 1 && secondaryFilter === "all" && !forceFlatList;

  // Available spell-mechanic tags in this category. Sorted by frequency (most
  // common first) so the most useful chips lead. Hidden when nothing tags.
  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) {
      for (const t of i.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, n]) => ({ label, count: n }));
  }, [items]);

  const filtered = useMemo(() => {
    let r = items;

    if (search.trim()) {
      const q = search.toLowerCase();
      // Match name, type, OR description so users can find items by spell
      // mechanic (typing "heal", "dot", "cure", "aura", etc. catches the
      // matching descriptions). Stats and Virtues are covered too — useful
      // for "+Str", "Cognizance", etc.
      r = r.filter(
        (i) =>
          i.Name.toLowerCase().includes(q) ||
          i.Type.toLowerCase().includes(q) ||
          (i.Description?.toLowerCase().includes(q) ?? false) ||
          (i.Stats?.toLowerCase().includes(q) ?? false) ||
          (i.Virtues?.toLowerCase().includes(q) ?? false),
      );
    }
    if (rarityFilter !== "all") {
      r = r.filter((i) => i.rarityLabel === rarityFilter);
    }
    if (subtypeFilter !== "all") {
      r = r.filter((i) => groupKeyFor(i, category.slug) === subtypeFilter);
    }
    if (secondaryFilter !== "all") {
      r = r.filter(
        (i) => secondaryGroupKeyFor(i, category.slug) === secondaryFilter,
      );
    }
    if (tagFilter !== "all") {
      r = r.filter((i) => i.tags.includes(tagFilter));
    }
    const lMin = levelMin ? parseInt(levelMin, 10) : null;
    const lMax = levelMax ? parseInt(levelMax, 10) : null;
    if (lMin !== null) r = r.filter((i) => (i.Level ?? 0) >= lMin);
    if (lMax !== null) r = r.filter((i) => (i.Level ?? 0) <= lMax);

    const tMin = tierMin ? parseInt(tierMin, 10) : null;
    const tMax = tierMax ? parseInt(tierMax, 10) : null;
    if (tMin !== null) r = r.filter((i) => (i.tier ?? 0) >= tMin);
    if (tMax !== null) r = r.filter((i) => (i.tier ?? 0) <= tMax);

    const sorted = [...r];
    sorted.sort((a, b) => compareItems(a, b, sort, sort2));
    return sorted;
  }, [items, category.slug, search, rarityFilter, subtypeFilter, secondaryFilter, tagFilter, levelMin, levelMax, tierMin, tierMax, sort, sort2]);

  // Toggle sort: clicking the active column flips direction; clicking a new
  // column starts at the natural direction (asc for text, desc for numbers).
  const handleSortChange = (column: SortColumn) => {
    setSort((curr) => {
      if (curr.column === column) {
        return { column, dir: curr.dir === "asc" ? "desc" : "asc" };
      }
      const numeric: SortColumn[] = [
        "level",
        "tier",
        "damage",
        "armor",
        "cost",
        "weight",
      ];
      return { column, dir: numeric.includes(column) ? "desc" : "asc" };
    });
  };

  const hasActiveFilters =
    search.trim() ||
    (!lockedSubtype && subtypeFilter !== "all") ||
    secondaryFilter !== "all" ||
    tagFilter !== "all" ||
    rarityFilter !== "all" ||
    levelMin ||
    levelMax ||
    tierMin ||
    tierMax;

  // Show the subcategory landing-card view when the category has sub-types
  // and the user hasn't picked one yet (and isn't actively filtering anything else).
  const showSubcategoryCards =
    showSubtypeFilter &&
    subtypeFilter === "all" &&
    !forceFlatList &&
    !search.trim() &&
    rarityFilter === "all" &&
    !levelMin &&
    !levelMax &&
    !tierMin &&
    !tierMax;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] mb-6"
      >
        <ChevronLeft size={14} />
        All categories
      </Link>

      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <CategoryIcon
              name={category.icon}
              size={28}
              className="text-[var(--color-gold)]"
            />
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
                    <Link
                      href={`/category/${category.slug}`}
                      className="hover:text-[var(--color-gold-soft)] transition-colors"
                    >
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
          </div>
          <p className="text-sm text-[var(--color-fg-3)] font-mono">
            {showSubcategoryCards
              ? `${subtypes.length} sub-categories · ${items.length.toLocaleString("en-US")} items total`
              : `${filtered.length.toLocaleString("en-US")} of ${items.length.toLocaleString("en-US")} items`}
          </p>
        </div>

        {!showSubcategoryCards && (
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="md:hidden flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md text-sm"
          >
            <Filter size={14} />
            {showFilters ? "Hide" : "Filter"}
          </button>
        )}
      </header>

      {showSubcategoryCards && (
        <section>
          <h2 className="font-[family-name:var(--font-display-loaded)] text-xl text-[var(--color-fg-2)] mb-6 tracking-wide">
            Browse by type
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {subtypes.map((st) => (
              <button
                key={st.label}
                onClick={() => {
                  setSubtypeFilter(st.label);
                  setSecondaryFilter("all");
                  setForceFlatList(false);
                  const def = defaultSortFor(category.slug);
                  setSort(def.primary);
                  setSort2(def.secondary ?? null);
                }}
                className="group relative text-left bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-gold-soft)] rounded-lg p-6 transition-all duration-200 hover:bg-[var(--color-bg-3)]"
              >
                <div className="flex items-start justify-between mb-3">
                  <CategoryIcon
                    name={category.icon}
                    className="text-[var(--color-gold)] opacity-80 group-hover:opacity-100"
                    size={24}
                  />
                  <ChevronRight
                    size={16}
                    className="text-[var(--color-fg-3)] group-hover:text-[var(--color-gold)] group-hover:translate-x-0.5 transition-all"
                  />
                </div>
                <h3 className="font-[family-name:var(--font-display-loaded)] text-lg text-[var(--color-fg-1)] mb-1">
                  {st.label}
                </h3>
                <p className="text-xs text-[var(--color-fg-3)] font-mono">
                  {st.count.toLocaleString("en-US")} items
                </p>
              </button>
            ))}
          </div>
          {category.slug === "gems" && (
            <>
              <div className="mt-10 mb-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] font-mono">
                  Or browse by effect
                </span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {GEM_EFFECT_SHORTCUTS.map((eff) => {
                  const count = items.reduce(
                    (n, i) => (i.tags.includes(eff.tag) ? n + 1 : n),
                    0,
                  );
                  if (count === 0) return null;
                  const Icon = eff.icon;
                  return (
                    <button
                      key={eff.tag}
                      onClick={() => {
                        setSubtypeFilter("all");
                        setSecondaryFilter("all");
                        setTagFilter(eff.tag);
                        setForceFlatList(true);
                        const def = defaultSortFor(category.slug);
                        setSort(def.primary);
                        setSort2(def.secondary ?? null);
                      }}
                      className="group relative text-left bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-gold-soft)] rounded-lg p-5 transition-all duration-200 hover:bg-[var(--color-bg-3)]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Icon
                          size={20}
                          className="text-[var(--color-gold)] opacity-80 group-hover:opacity-100"
                        />
                        <ChevronRight
                          size={14}
                          className="text-[var(--color-fg-3)] group-hover:text-[var(--color-gold)] group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                      <h3 className="font-[family-name:var(--font-display-loaded)] text-base text-[var(--color-fg-1)] mb-1 leading-tight">
                        {eff.label}
                      </h3>
                      <p className="text-[10px] text-[var(--color-fg-3)] font-mono">
                        {count.toLocaleString("en-US")} items
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setForceFlatList(true);
                const def = defaultSortFor(category.slug);
                setSort(def.primary);
                setSort2(def.secondary ?? null);
              }}
              className="text-xs text-[var(--color-fg-3)] hover:text-[var(--color-gold)] underline-offset-2 hover:underline"
            >
              Or show all {items.length.toLocaleString("en-US")} items in one list →
            </button>
          </div>
        </section>
      )}

      {!lockedSubtype && !showSubcategoryCards && showSecondaryCards && (
        <section>
          <button
            onClick={() => {
              setSubtypeFilter("all");
              setSecondaryFilter("all");
            }}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-3)] hover:text-[var(--color-gold)] mb-4"
          >
            <ChevronLeft size={12} />
            Back to {category.label.toLowerCase()} types
          </button>
          <h2 className="font-[family-name:var(--font-display-loaded)] text-xl text-[var(--color-fg-2)] mb-1 tracking-wide">
            {subtypeFilter}
          </h2>
          <p className="text-sm text-[var(--color-fg-3)] font-mono mb-6">
            {secondaryGroups.length} types · {filtered.length.toLocaleString("en-US")} items
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {secondaryGroups.map((g) => (
              <button
                key={g.label}
                onClick={() => {
                  setSecondaryFilter(g.label);
                  const def = defaultSortFor(category.slug);
                  setSort(def.primary);
                  setSort2(def.secondary ?? null);
                }}
                className="group relative text-left bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-gold-soft)] rounded-lg p-5 transition-all duration-200 hover:bg-[var(--color-bg-3)]"
              >
                <div className="flex items-start justify-between mb-2">
                  <CategoryIcon
                    name={category.icon}
                    className="text-[var(--color-gold)] opacity-70 group-hover:opacity-100"
                    size={20}
                  />
                  <ChevronRight
                    size={14}
                    className="text-[var(--color-fg-3)] group-hover:text-[var(--color-gold)] group-hover:translate-x-0.5 transition-all"
                  />
                </div>
                <h3 className="font-[family-name:var(--font-display-loaded)] text-base text-[var(--color-fg-1)] mb-1 leading-tight">
                  {g.label}
                </h3>
                <p className="text-[10px] text-[var(--color-fg-3)] font-mono">
                  {g.count} {g.count === 1 ? "rank" : "ranks"}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setForceFlatList(true);
                const def = defaultSortFor(category.slug);
                setSort(def.primary);
                setSort2(def.secondary ?? null);
              }}
              className="text-xs text-[var(--color-fg-3)] hover:text-[var(--color-gold)] underline-offset-2 hover:underline"
            >
              Or show all {filtered.length.toLocaleString("en-US")} items in one list →
            </button>
          </div>
        </section>
      )}

      {!showSubcategoryCards && !showSecondaryCards && (
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Filters */}
        <aside
          className={`${showFilters ? "block" : "hidden md:block"} space-y-4 self-start md:sticky md:top-20`}
        >
          <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] mb-1.5">
                Search
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, effect, virtue, stat..."
                className="w-full px-3 py-1.5 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-gold-soft)]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] mb-1.5">
                Sort
              </label>
              <select
                value={`${sort.column}-${sort.dir}`}
                onChange={(e) => {
                  const [col, dir] = e.target.value.split("-") as [SortColumn, SortDir];
                  setSort({ column: col, dir });
                }}
                className="w-full px-3 py-1.5 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-gold-soft)]"
              >
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="level-asc">Level (low → high)</option>
                <option value="level-desc">Level (high → low)</option>
                <option value="rarity-asc">Rarity (common → leg.)</option>
                <option value="rarity-desc">Rarity (leg. → common)</option>
                <option value="tier-asc">Tier (low → high)</option>
                <option value="tier-desc">Tier (high → low)</option>
                <option value="cost-asc">Cost (low → high)</option>
                <option value="cost-desc">Cost (high → low)</option>
                <option value="damage-desc">Damage (high → low)</option>
                <option value="armor-desc">Armor (high → low)</option>
                <option value="weight-asc">Weight (light → heavy)</option>
              </select>
              <p className="text-[10px] text-[var(--color-fg-3)] mt-1.5">
                Or click any column header in the table.
              </p>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] mb-1.5">
                Then by
              </label>
              <select
                value={sort2 ? `${sort2.column}-${sort2.dir}` : ""}
                onChange={(e) => {
                  if (e.target.value === "") {
                    setSort2(null);
                    return;
                  }
                  const [col, dir] = e.target.value.split("-") as [
                    SortColumn,
                    SortDir,
                  ];
                  setSort2({ column: col, dir });
                }}
                className="w-full px-3 py-1.5 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-gold-soft)]"
              >
                <option value="">— none —</option>
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="level-asc">Level (low → high)</option>
                <option value="level-desc">Level (high → low)</option>
                <option value="rarity-asc">Rarity (common → leg.)</option>
                <option value="rarity-desc">Rarity (leg. → common)</option>
                <option value="tier-asc">Tier (low → high)</option>
                <option value="tier-desc">Tier (high → low)</option>
                <option value="cost-asc">Cost (low → high)</option>
                <option value="cost-desc">Cost (high → low)</option>
              </select>
              <p className="text-[10px] text-[var(--color-fg-3)] mt-1.5">
                Tiebreak when primary sort is equal.
              </p>
            </div>

            {!lockedSubtype && showSubtypeFilter && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] mb-1.5">
                  Type
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => {
                      // "All" chip: drop the type filter only. Stay on the
                      // list view (don't bounce back to cards) and keep any
                      // other filters the user has set.
                      setSubtypeFilter("all");
                      setSecondaryFilter("all");
                      setForceFlatList(true);
                    }}
                    className={`px-2 py-1 text-[11px] rounded border ${
                      subtypeFilter === "all"
                        ? "bg-[var(--color-bg-3)] border-[var(--color-gold-soft)] text-[var(--color-gold)]"
                        : "bg-transparent border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    All
                  </button>
                  {subtypes.map((st) => (
                    <button
                      key={st.label}
                      onClick={() => {
                        const next =
                          st.label === subtypeFilter ? "all" : st.label;
                        setSubtypeFilter(next);
                        setSecondaryFilter("all");
                        // User is using the chip filter, not navigating —
                        // commit to flat-list view so we don't bounce them
                        // into the level-2 card screen.
                        setForceFlatList(next !== "all");
                      }}
                      title={`${st.count} items`}
                      className={`px-2 py-1 text-[11px] rounded border ${
                        subtypeFilter === st.label
                          ? "bg-[var(--color-bg-3)] border-[var(--color-gold-soft)] text-[var(--color-gold)]"
                          : "bg-transparent border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] mb-1.5">
                Rarity
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setRarityFilter("all")}
                  className={`px-2 py-1 text-[11px] rounded border ${
                    rarityFilter === "all"
                      ? "bg-[var(--color-bg-3)] border-[var(--color-gold-soft)] text-[var(--color-gold)]"
                      : "bg-transparent border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  All
                </button>
                {RARITY_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRarityFilter(r === rarityFilter ? "all" : r)}
                    className={`px-2 py-1 text-[11px] rounded border ${
                      rarityFilter === r
                        ? "bg-[var(--color-bg-3)] border-[var(--color-gold-soft)] text-[var(--color-gold)]"
                        : "bg-transparent border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {availableTags.length > 0 && (
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] mb-1.5">
                  Effect
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setTagFilter("all")}
                    className={`px-2 py-1 text-[11px] rounded border ${
                      tagFilter === "all"
                        ? "bg-[var(--color-bg-3)] border-[var(--color-gold-soft)] text-[var(--color-gold)]"
                        : "bg-transparent border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    All
                  </button>
                  {availableTags.map((t) => (
                    <button
                      key={t.label}
                      onClick={() =>
                        setTagFilter(t.label === tagFilter ? "all" : t.label)
                      }
                      title={`${t.count} items`}
                      className={`px-2 py-1 text-[11px] rounded border uppercase tracking-wider ${
                        tagFilter === t.label
                          ? "bg-[var(--color-bg-3)] border-[var(--color-gold-soft)] text-[var(--color-gold)]"
                          : "bg-transparent border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] mb-1.5">
                Level
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="min"
                  value={levelMin}
                  onChange={(e) => setLevelMin(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-gold-soft)]"
                />
                <input
                  type="number"
                  placeholder="max"
                  value={levelMax}
                  onChange={(e) => setLevelMax(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-gold-soft)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-fg-3)] mb-1.5">
                Tier
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="min"
                  value={tierMin}
                  onChange={(e) => setTierMin(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-gold-soft)]"
                />
                <input
                  type="number"
                  placeholder="max"
                  value={tierMax}
                  onChange={(e) => setTierMax(e.target.value)}
                  className="w-full px-2 py-1 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-gold-soft)]"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setRarityFilter("all");
                  setSubtypeFilter(lockedSubtype ?? "all");
                  setSecondaryFilter("all");
                  setTagFilter("all");
                  setSort(defSort.primary);
                  setSort2(defSort.secondary ?? null);
                  setLevelMin("");
                  setLevelMax("");
                  setTierMin("");
                  setTierMax("");
                }}
                className="w-full flex items-center justify-center gap-1 text-xs py-1.5 text-[var(--color-fg-3)] hover:text-[var(--color-rust)] border border-[var(--color-border)] rounded"
              >
                <X size={12} />
                Clear filters
              </button>
            )}
          </div>
        </aside>

        {/* Items grid */}
        <div>
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-[var(--color-fg-3)]">
              No items match your filters.
            </div>
          ) : (
            <ItemTable items={filtered} sort={sort} onSortChange={handleSortChange} />
          )}
        </div>
      </div>
      )}
    </div>
  );
}
