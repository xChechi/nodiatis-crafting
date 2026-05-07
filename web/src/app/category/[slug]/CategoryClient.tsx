"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Filter, X } from "lucide-react";
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
const DEFAULT_SORT: SortState = { column: "name", dir: "asc" };

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

function compareItems(a: Item, b: Item, sort: SortState): number {
  const dir = sort.dir === "asc" ? 1 : -1;
  // Natural-sort name fallback so "Rank 3" comes before "Rank 10"
  const cmpName = (x: Item, y: Item) =>
    x.Name.localeCompare(y.Name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  switch (sort.column) {
    case "name":
      return cmpName(a, b) * dir;
    case "rarity":
      return ((a.Rarity ?? 0) - (b.Rarity ?? 0)) * dir || cmpName(a, b);
    case "level":
      return ((a.Level ?? 0) - (b.Level ?? 0)) * dir || cmpName(a, b);
    case "tier":
      return ((a.tier ?? 0) - (b.tier ?? 0)) * dir || cmpName(a, b);
    case "damage":
      return (damageMid(a.Damage) - damageMid(b.Damage)) * dir || cmpName(a, b);
    case "armor":
      return ((a.ArmorClass ?? 0) - (b.ArmorClass ?? 0)) * dir || cmpName(a, b);
    case "cost":
      return ((a.Cost ?? 0) - (b.Cost ?? 0)) * dir || cmpName(a, b);
    case "weight":
      return ((a.Weight ?? 0) - (b.Weight ?? 0)) * dir || cmpName(a, b);
  }
}

export function CategoryClient({
  category,
  items,
}: {
  category: CategorySerializable;
  items: Item[];
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
  const [sort, setSort] = useState<SortState>(() => {
    const col = searchParams.get("sort");
    const dir = searchParams.get("dir");
    return {
      column: isSortColumn(col) ? col : DEFAULT_SORT.column,
      dir: isSortDir(dir) ? dir : DEFAULT_SORT.dir,
    };
  });
  // showFilters is UI-only — not synced to URL
  const [showFilters, setShowFilters] = useState(false);

  // Sync state → URL. Only includes non-default values to keep the URL clean.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search);
    if (rarityFilter !== "all") params.set("rarity", rarityFilter);
    if (levelMin) params.set("lmin", levelMin);
    if (levelMax) params.set("lmax", levelMax);
    if (tierMin) params.set("tmin", tierMin);
    if (tierMax) params.set("tmax", tierMax);
    if (sort.column !== DEFAULT_SORT.column) params.set("sort", sort.column);
    if (sort.dir !== DEFAULT_SORT.dir) params.set("dir", sort.dir);

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
    sort,
    pathname,
    router,
    searchParams,
  ]);

  const filtered = useMemo(() => {
    let r = items;

    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((i) => i.Name.toLowerCase().includes(q));
    }
    if (rarityFilter !== "all") {
      r = r.filter((i) => i.rarityLabel === rarityFilter);
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
    sorted.sort((a, b) => compareItems(a, b, sort));
    return sorted;
  }, [items, search, rarityFilter, levelMin, levelMax, tierMin, tierMax, sort]);

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
    rarityFilter !== "all" ||
    levelMin ||
    levelMax ||
    tierMin ||
    tierMax;

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
            <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-4xl text-[var(--color-fg-1)]">
              {category.label}
            </h1>
          </div>
          <p className="text-sm text-[var(--color-fg-3)] font-mono">
            {filtered.length.toLocaleString()} of {items.length.toLocaleString()} items
          </p>
        </div>

        <button
          onClick={() => setShowFilters((s) => !s)}
          className="md:hidden flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md text-sm"
        >
          <Filter size={14} />
          {showFilters ? "Hide" : "Filter"}
        </button>
      </header>

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
                placeholder="Filter by name..."
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
    </div>
  );
}
