"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Fuse from "fuse.js";
import { Search, X } from "lucide-react";

interface IndexEntry {
  slug: string;
  name: string;
  type: string;
  rarity: number;
  /** Spell-mechanic tags extracted from Description: dot, heal, cure, ... */
  tags?: string[];
}

// Lazy-loaded singletons. The search index JSON (~250KB) and the Fuse module
// (~12KB) are deferred until the user actually opens the dialog, keeping them
// off the initial-load critical path. Subsequent opens reuse the cached fuse.
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

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [fuse, setFuse] = useState<Fuse<IndexEntry> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
    if (open) {
      inputRef.current?.focus();
      if (!fuse) loadFuse().then(setFuse);
    }
  }, [open, fuse]);

  const results = useMemo(() => {
    if (!query.trim() || !fuse) return [];
    return fuse.search(query, { limit: 12 }).map((r) => r.item);
  }, [query, fuse]);

  // Reset highlight when the search query changes. This only runs when
  // `query` actually changes, not on every render, so the cascade-render
  // warning the rule guards against doesn't apply.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdx(0);
  }, [query]);

  // Scroll the active item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLButtonElement>(
      `[data-result-idx="${activeIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  function go(slug: string) {
    setOpen(false);
    setQuery("");
    setActiveIdx(0);
    router.push(`/items/${slug}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIdx];
      if (target) go(target.slug);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(results.length - 1);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open global item search"
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-2)] transition-colors w-48 md:w-64"
      >
        <Search size={14} aria-hidden="true" />
        <span className="flex-1 text-left">Search items...</span>
        <kbd className="text-[10px] px-1.5 py-0.5 border border-[var(--color-border)] rounded font-mono opacity-70">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Item search"
        >
          <div
            className="w-full max-w-xl bg-[var(--color-bg-2)] border border-[var(--color-border-strong)] rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
              <Search size={16} className="text-[var(--color-fg-3)]" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name, type, or tag (dot, heal, aura...)"
                aria-label="Search items"
                aria-controls="search-results"
                aria-activedescendant={
                  results[activeIdx] ? `search-result-${activeIdx}` : undefined
                }
                role="combobox"
                aria-expanded={results.length > 0}
                aria-autocomplete="list"
                className="flex-1 bg-transparent outline-none text-[var(--color-fg-1)] placeholder:text-[var(--color-fg-3)]"
              />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div
              ref={listRef}
              id="search-results"
              role="listbox"
              aria-label="Search results"
              className="max-h-96 overflow-y-auto"
            >
              {query.trim() && results.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--color-fg-3)]">
                  No matches for &quot;{query}&quot;
                </div>
              ) : (
                results.map((r, idx) => {
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={r.slug}
                      id={`search-result-${idx}`}
                      data-result-idx={idx}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => go(r.slug)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-[var(--color-border)] last:border-0 ${
                        isActive ? "bg-[var(--color-bg-3)]" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm truncate ${
                            isActive
                              ? "text-[var(--color-gold)]"
                              : "text-[var(--color-fg-1)]"
                          }`}
                        >
                          {r.name}
                        </div>
                        <div className="text-[11px] text-[var(--color-fg-3)] truncate flex items-center gap-2">
                          <span className="truncate">{r.type}</span>
                          {r.tags && r.tags.length > 0 && (
                            <span className="flex gap-1 shrink-0">
                              {r.tags.slice(0, 4).map((t) => (
                                <span
                                  key={t}
                                  className="px-1 py-px text-[9px] uppercase tracking-wider rounded bg-[var(--color-bg-3)] border border-[var(--color-border)] text-[var(--color-fg-2)]"
                                >
                                  {t}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
              {!query.trim() && (
                <div className="px-4 py-6 text-center text-sm text-[var(--color-fg-3)]">
                  {fuse ? "Start typing to search..." : "Loading search index..."}
                </div>
              )}
            </div>
            {results.length > 0 && (
              <div className="px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-fg-3)] font-mono flex items-center gap-3">
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>esc close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
