"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Wand2, Plus, X, AlertCircle } from "lucide-react";
import { allItems, getItemByName } from "@/lib/data";
import { generateSuggestions, parseInventory } from "@/lib/inventory";
import { expandToBaseMats } from "@/lib/crafting";
import { parseMaterialType } from "@/lib/materials";
import type { Item, Mat } from "@/lib/types";
import { SuggestionList } from "./SuggestionList";
import { categoryForType, CATEGORIES } from "@/lib/categories";

interface RecipeMatch {
  item: Item;
  /** How many crafts the user can complete (min of available/required across mats). */
  canCraft: number;
  /** Number of distinct mats fully covered by the inventory. */
  covered: number;
  total: number;
  missing: Array<{ name: string; tier: number; need: number; have: number }>;
}

const PLACEHOLDER = `e.g.
6 t30 dyes
t1-30 dye
red t5 gem
Mongoose Leg Bone: 12
`;

function formatCanCraft(n: number): string {
  return n === Infinity ? "∞" : n.toLocaleString("en-US");
}

function evaluateRecipe(
  item: Item,
  consumable: Mat[],
  inventory: Map<string, number>,
): RecipeMatch | null {
  if (consumable.length === 0) return null;
  let canCraft = Infinity;
  let covered = 0;
  const missing: RecipeMatch["missing"] = [];
  for (const mat of consumable) {
    const have = inventory.get(`${mat.name}:${mat.tier}`) ?? inventory.get(mat.name) ?? 0;
    if (have >= mat.qty) {
      covered += 1;
      canCraft = Math.min(canCraft, Math.floor(have / mat.qty));
    } else {
      missing.push({ name: mat.name, tier: mat.tier, need: mat.qty, have });
      canCraft = 0;
    }
  }
  if (covered === 0) return null;
  return {
    item,
    canCraft,
    covered,
    total: consumable.length,
    missing,
  };
}

function getActiveLine(
  text: string,
  cursor: number,
): { line: string; start: number; end: number } {
  const start = text.lastIndexOf("\n", cursor - 1) + 1;
  const endNl = text.indexOf("\n", cursor);
  const end = endNl === -1 ? text.length : endNl;
  return { line: text.slice(start, end), start, end };
}

function groupByCategory(matches: RecipeMatch[]): Map<string, RecipeMatch[]> {
  const grouped = new Map<string, RecipeMatch[]>();
  for (const m of matches) {
    const cat = categoryForType(m.item.Type);
    const key = cat?.slug ?? "other";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }
  return grouped;
}

function GroupedMatches({ matches }: { matches: RecipeMatch[] }) {
  if (matches.length === 0) return null;
  const grouped = groupByCategory(matches);
  return (
    <div className="space-y-6">
      {CATEGORIES.map((cat) => {
        const rows = grouped.get(cat.slug);
        if (!rows || rows.length === 0) return null;
        return (
          <section key={cat.slug}>
            <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-3)] mb-2">
              {cat.label} <span className="font-mono">({rows.length})</span>
            </h3>
            <div className="space-y-1.5">
              {rows.map((m) => (
                <RecipeMatchRow key={m.item.slug} match={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function CraftableClient() {
  const [input, setInput] = useState("");
  const [committed, setCommitted] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);

  const { entries, warnings } = useMemo(
    () => parseInventory(committed),
    [committed],
  );

  const inventoryMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      const item = getItemByName(e.name);
      if (!item) continue;
      if (item.Type.startsWith("Resource (")) {
        const parsed = parseMaterialType(item.Type);
        if (parsed.tier !== null) {
          m.set(`${parsed.name}:${parsed.tier}`, e.qty);
          continue;
        }
      }
      // Non-resource OR no-tier resource: key by canonical name (legacy path)
      m.set(e.name, e.qty);
    }
    return m;
  }, [entries]);

  const matches = useMemo<RecipeMatch[]>(() => {
    if (entries.length === 0) return [];
    const out: RecipeMatch[] = [];
    for (const item of allItems()) {
      if (!item.recipe) continue;
      const baseMats = expandToBaseMats(item.recipe.consumable);
      const m = evaluateRecipe(item, baseMats, inventoryMap);
      if (m) out.push(m);
    }
    // Rank: fully-craftable first (canCraft desc), then partial by % covered desc
    out.sort((a, b) => {
      if (a.canCraft !== b.canCraft) return b.canCraft - a.canCraft;
      const aPct = a.covered / a.total;
      const bPct = b.covered / b.total;
      if (aPct !== bPct) return bPct - aPct;
      return a.item.Name.localeCompare(b.item.Name);
    });
    return out.slice(0, 500);
  }, [entries.length, inventoryMap]);

  const fullyCraftable = matches.filter((m) => m.canCraft > 0);
  const partial = matches.filter((m) => m.canCraft === 0);

  const activeLine = useMemo(
    () => getActiveLine(input, cursorPos),
    [input, cursorPos],
  );
  const suggestions = useMemo(
    () => (showSuggestions ? generateSuggestions(activeLine.line) : []),
    [showSuggestions, activeLine.line],
  );

  function acceptSuggestion(s: string) {
    const before = input.slice(0, activeLine.start);
    const after = input.slice(activeLine.end);
    const newText = `${before}${s}${after}`;
    const newCursor = before.length + s.length;
    setInput(newText);
    setCursorPos(newCursor);
    setShowSuggestions(false);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
      textareaRef.current?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      acceptSuggestion(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCommitted(input);
  }

  function clearAll() {
    setInput("");
    setCommitted("");
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-8">
        <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl text-[var(--color-fg-1)] mb-1 flex items-center gap-3">
          <Wand2 size={24} className="text-[var(--color-gold)]" />
          What can I craft?
        </h1>
        <p className="text-sm text-[var(--color-fg-3)]">
          Paste your inventory below — we&apos;ll find every recipe you have
          enough mats for.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-8">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setCursorPos(e.target.selectionStart ?? e.target.value.length);
            setActiveIdx(0);
            setShowSuggestions(true);
          }}
          onKeyUp={(e) => {
            setCursorPos(
              (e.target as HTMLTextAreaElement).selectionStart ??
                input.length,
            );
          }}
          onClick={(e) => {
            setCursorPos(
              (e.target as HTMLTextAreaElement).selectionStart ??
                input.length,
            );
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          onKeyDown={handleKeyDown}
          rows={6}
          placeholder={PLACEHOLDER}
          aria-label="Your inventory — one mat per line or comma-separated"
          className="w-full px-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded text-sm font-mono focus:outline-none focus:border-[var(--color-gold-soft)] text-[var(--color-fg-1)] placeholder:text-[var(--color-fg-3)]"
        />
        <SuggestionList
          suggestions={suggestions}
          activeIndex={activeIdx}
          onSelect={acceptSuggestion}
        />
        <div className="flex items-center gap-2 mt-3">
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--color-bg-3)] border border-[var(--color-gold-soft)] rounded text-[var(--color-gold)] hover:bg-[var(--color-bg-2)]"
          >
            <Plus size={14} />
            Find recipes
          </button>
          {(input || committed) && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] border border-[var(--color-border)] rounded"
            >
              <X size={13} />
              Clear
            </button>
          )}
          {entries.length > 0 && (
            <span className="text-xs text-[var(--color-fg-3)] ml-2">
              Parsed {entries.length} mats
            </span>
          )}
        </div>
      </form>

      {warnings.length > 0 && (
        <div className="mb-6 p-3 bg-[var(--color-bg-2)] border border-[var(--color-rust)]/40 rounded-md">
          <p className="text-xs text-[var(--color-rust)] flex items-center gap-2 mb-2">
            <AlertCircle size={12} />
            Couldn&apos;t parse {warnings.length}{" "}
            {warnings.length === 1 ? "entry" : "entries"}:
          </p>
          <ul className="text-xs text-[var(--color-fg-3)] space-y-0.5 ml-5 list-disc">
            {warnings.slice(0, 8).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {warnings.length > 8 && <li>…and {warnings.length - 8} more</li>}
          </ul>
        </div>
      )}

      {committed && entries.length === 0 && (
        <div className="text-center py-12 text-[var(--color-fg-3)]">
          No valid mats parsed yet. Try formats like{" "}
          <code className="font-mono text-[var(--color-fg-2)]">Wood: 50</code>{" "}
          or <code className="font-mono text-[var(--color-fg-2)]">50 Wood</code>
          .
        </div>
      )}

      {fullyCraftable.length > 0 && (
        <section className="mb-8">
          <h2 className="font-[family-name:var(--font-display-loaded)] text-xl text-[var(--color-emerald)] mb-3 flex items-center gap-2">
            Fully craftable
            <span className="text-xs text-[var(--color-fg-3)] font-mono">
              {fullyCraftable.length}
            </span>
          </h2>
          <GroupedMatches matches={fullyCraftable} />
        </section>
      )}

      {partial.length > 0 && (
        <section>
          <h2 className="font-[family-name:var(--font-display-loaded)] text-xl text-[var(--color-fg-2)] mb-3 flex items-center gap-2">
            Almost there
            <span className="text-xs text-[var(--color-fg-3)] font-mono">
              partial coverage
            </span>
          </h2>
          <GroupedMatches matches={partial} />
        </section>
      )}
    </div>
  );
}

function RecipeMatchRow({ match }: { match: RecipeMatch }) {
  const { item, canCraft, covered, total, missing } = match;
  return (
    <Link
      href={`/items/${item.slug}`}
      className="flex items-center justify-between gap-3 p-3 bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-gold-soft)] rounded-md transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--color-fg-1)] truncate">
          {item.Name}
          <span className="text-[10px] text-[var(--color-fg-3)] font-mono ml-2">
            {item.Type}
          </span>
        </div>
        {missing.length > 0 && (
          <div className="text-[10px] text-[var(--color-fg-3)] truncate mt-0.5">
            Missing:{" "}
            {missing
              .slice(0, 4)
              .map(
                (m) => `${m.need - m.have} ${m.name} (T${m.tier})`,
              )
              .join(", ")}
            {missing.length > 4 && ` +${missing.length - 4} more`}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        {canCraft > 0 ? (
          <div className="text-sm text-[var(--color-emerald)] font-mono">
            ×{formatCanCraft(canCraft)}
          </div>
        ) : (
          <div className="text-xs text-[var(--color-fg-3)] font-mono">
            {covered}/{total}
          </div>
        )}
      </div>
    </Link>
  );
}
