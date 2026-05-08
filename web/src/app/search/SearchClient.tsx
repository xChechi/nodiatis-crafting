"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type Fuse from "fuse.js";
import { Search } from "lucide-react";
import { ItemCard } from "@/components/ItemCard";
import { getIndexedItemBySlug, type IndexedItem } from "@/lib/clientIndex";

interface IndexEntry {
  slug: string;
  name: string;
  type: string;
  rarity: number;
  tags?: string[];
}

let _fusePromise: Promise<Fuse<IndexEntry>> | null = null;
function loadFuse(): Promise<Fuse<IndexEntry>> {
  if (_fusePromise) return _fusePromise;
  _fusePromise = (async () => {
    const [{ default: FuseCtor }, { default: searchIndex }] = await Promise.all([
      import("fuse.js"),
      import("@/data/searchIndex.json"),
    ]);
    const entries = searchIndex as IndexEntry[];
    return new FuseCtor(entries, {
      keys: [
        { name: "name", weight: 0.6 },
        { name: "type", weight: 0.2 },
        { name: "tags", weight: 0.2 },
      ],
      threshold: 0.35,
      distance: 100,
      minMatchCharLength: 2,
    });
  })();
  return _fusePromise;
}

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [fuse, setFuse] = useState<Fuse<IndexEntry> | null>(null);
  const [craftableOnly, setCraftableOnly] = useState(false);

  // Kick off lazy index load on mount.
  useEffect(() => {
    loadFuse().then(setFuse);
  }, []);

  // Keep URL in sync (debounced).
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set("q", query);
      else params.delete("q");
      const qs = params.toString();
      const next = qs ? `/search?${qs}` : "/search";
      router.replace(next, { scroll: false });
    }, 300);
    return () => window.clearTimeout(handle);
    // searchParams is intentionally omitted — we only want to write, not loop on read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, router]);

  const results: IndexedItem[] = useMemo(() => {
    if (!query.trim() || !fuse) return [];
    const hits = fuse.search(query, { limit: 100 }).map((r) => r.item);
    const items = hits
      .map((h) => getIndexedItemBySlug(h.slug))
      .filter((x): x is IndexedItem => Boolean(x));
    return craftableOnly ? items.filter((i) => i.craftable) : items;
  }, [query, fuse, craftableOnly]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl text-[var(--color-fg-1)] mb-3 flex items-center gap-3">
          <Search size={24} className="text-[var(--color-gold)]" />
          Search
        </h1>
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md focus-within:border-[var(--color-gold-soft)] max-w-2xl">
          <Search size={14} className="text-[var(--color-fg-3)]" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, type, or tag (dot, heal, aura...)"
            aria-label="Search query"
            className="flex-1 bg-transparent outline-none text-[var(--color-fg-1)] placeholder:text-[var(--color-fg-3)]"
          />
        </div>

        <div className="flex items-center gap-3 mt-3 text-xs">
          <label className="flex items-center gap-1.5 text-[var(--color-fg-3)] cursor-pointer">
            <input
              type="checkbox"
              checked={craftableOnly}
              onChange={(e) => setCraftableOnly(e.target.checked)}
              className="accent-[var(--color-gold)]"
            />
            Craftable only
          </label>
          {query.trim() && (
            <span className="font-mono text-[var(--color-fg-3)]">
              {!fuse
                ? "Loading…"
                : `${results.length.toLocaleString("en-US")} ${results.length === 1 ? "match" : "matches"}`}
            </span>
          )}
        </div>
      </header>

      {!query.trim() ? (
        <p className="text-center py-20 text-[var(--color-fg-3)]">
          Type in the box to search across all items.
        </p>
      ) : !fuse ? (
        <p className="text-center py-20 text-[var(--color-fg-3)]">
          Loading search index…
        </p>
      ) : results.length === 0 ? (
        <p className="text-center py-20 text-[var(--color-fg-3)]">
          No matches for &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {results.map((item) => (
            <ItemCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
