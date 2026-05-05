"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import searchIndex from "@/data/searchIndex.json";

interface IndexEntry {
  slug: string;
  name: string;
  type: string;
  rarity: number;
}

const ALL_ENTRIES = searchIndex as IndexEntry[];

const fuse = new Fuse(ALL_ENTRIES, {
  keys: [
    { name: "name", weight: 0.7 },
    { name: "type", weight: 0.3 },
  ],
  threshold: 0.35,
  distance: 100,
  minMatchCharLength: 2,
});

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query, { limit: 12 }).map((r) => r.item);
  }, [query]);

  function go(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/items/${slug}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-2)] transition-colors w-48 md:w-64"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search items...</span>
        <kbd className="text-[10px] px-1.5 py-0.5 border border-[var(--color-border)] rounded font-mono opacity-70">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[var(--color-bg-2)] border border-[var(--color-border-strong)] rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
              <Search size={16} className="text-[var(--color-fg-3)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 5,488 items..."
                className="flex-1 bg-transparent outline-none text-[var(--color-fg-1)] placeholder:text-[var(--color-fg-3)]"
              />
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {query.trim() && results.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--color-fg-3)]">
                  No matches for &quot;{query}&quot;
                </div>
              ) : (
                results.map((r) => (
                  <button
                    key={r.slug}
                    onClick={() => go(r.slug)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--color-bg-3)] border-b border-[var(--color-border)] last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--color-fg-1)] truncate">
                        {r.name}
                      </div>
                      <div className="text-[11px] text-[var(--color-fg-3)] truncate">
                        {r.type}
                      </div>
                    </div>
                  </button>
                ))
              )}
              {!query.trim() && (
                <div className="px-4 py-6 text-center text-sm text-[var(--color-fg-3)]">
                  Start typing to search...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
