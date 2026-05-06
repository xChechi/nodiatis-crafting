"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Filter, X } from "lucide-react";
import Link from "next/link";
import type { Item, RarityLabel } from "@/lib/types";

interface CategorySerializable {
  slug: string;
  label: string;
  icon: string;
}
import { ItemTable } from "@/components/ItemTable";
import { CategoryIcon } from "@/components/CategoryIcon";

type SortOption = "name-asc" | "name-desc" | "level-asc" | "level-desc" | "rarity-asc";

const RARITY_OPTIONS: RarityLabel[] = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

export function CategoryClient({
  category,
  items,
}: {
  category: CategorySerializable;
  items: Item[];
}) {
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<RarityLabel | "all">("all");
  const [levelMin, setLevelMin] = useState("");
  const [levelMax, setLevelMax] = useState("");
  const [tierMin, setTierMin] = useState("");
  const [tierMax, setTierMax] = useState("");
  const [sort, setSort] = useState<SortOption>("name-asc");
  const [showFilters, setShowFilters] = useState(false);

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
    switch (sort) {
      case "name-asc":
        sorted.sort((a, b) => a.Name.localeCompare(b.Name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.Name.localeCompare(a.Name));
        break;
      case "level-asc":
        sorted.sort((a, b) => (a.Level ?? 0) - (b.Level ?? 0));
        break;
      case "level-desc":
        sorted.sort((a, b) => (b.Level ?? 0) - (a.Level ?? 0));
        break;
      case "rarity-asc":
        sorted.sort((a, b) => (a.Rarity ?? 0) - (b.Rarity ?? 0));
        break;
    }
    return sorted;
  }, [items, search, rarityFilter, levelMin, levelMax, tierMin, tierMax, sort]);

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
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full px-3 py-1.5 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-gold-soft)]"
              >
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="level-asc">Level (low → high)</option>
                <option value="level-desc">Level (high → low)</option>
                <option value="rarity-asc">Rarity (common → leg.)</option>
              </select>
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
            <ItemTable items={filtered} />
          )}
        </div>
      </div>
    </div>
  );
}
