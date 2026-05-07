"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Wand2, Plus, X, AlertCircle } from "lucide-react";
import { allItems, getItemByName } from "@/lib/data";
import type { Item, Mat } from "@/lib/types";

interface InventoryEntry {
  /** Resolved canonical item name. */
  name: string;
  qty: number;
}

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
Thistleberry Dye: 8
Garden Cloth, 4
3 Stickboard
`;

/** Loose parser: accepts comma- or newline-separated entries.
 *  Each entry is "name:qty", "name, qty", "qty name", or "name qty".
 *  Unknown names are returned as warnings. */
function parseInventory(input: string): {
  entries: InventoryEntry[];
  warnings: string[];
} {
  const entries: InventoryEntry[] = [];
  const warnings: string[] = [];
  const merged = new Map<string, number>();

  const parts = input
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    let name: string | null = null;
    let qty: number | null = null;

    // Try "name : qty" first
    const colonMatch = part.match(/^(.+?)\s*:\s*(\d+)\s*$/);
    if (colonMatch) {
      name = colonMatch[1].trim();
      qty = parseInt(colonMatch[2], 10);
    }

    // Try "qty name"
    if (name === null) {
      const leadingQty = part.match(/^(\d+)\s+(.+)$/);
      if (leadingQty) {
        qty = parseInt(leadingQty[1], 10);
        name = leadingQty[2].trim();
      }
    }

    // Try "name qty"
    if (name === null) {
      const trailingQty = part.match(/^(.+?)\s+(\d+)$/);
      if (trailingQty) {
        name = trailingQty[1].trim();
        qty = parseInt(trailingQty[2], 10);
      }
    }

    if (!name || qty === null || qty <= 0) {
      warnings.push(`Couldn't parse "${part}"`);
      continue;
    }

    const item = getItemByName(name);
    if (!item) {
      warnings.push(`Unknown item: "${name}"`);
      continue;
    }

    merged.set(item.Name, (merged.get(item.Name) ?? 0) + qty);
  }

  for (const [name, qty] of merged) {
    entries.push({ name, qty });
  }
  return { entries, warnings };
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
    const have = inventory.get(mat.name) ?? 0;
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
    canCraft: canCraft === Infinity ? 0 : canCraft,
    covered,
    total: consumable.length,
    missing,
  };
}

export function CraftableClient() {
  const [input, setInput] = useState("");
  const [committed, setCommitted] = useState("");

  const { entries, warnings } = useMemo(
    () => parseInventory(committed),
    [committed],
  );

  const inventoryMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.name, e.qty);
    return m;
  }, [entries]);

  const matches = useMemo<RecipeMatch[]>(() => {
    if (entries.length === 0) return [];
    const out: RecipeMatch[] = [];
    for (const item of allItems()) {
      if (!item.recipe) continue;
      const m = evaluateRecipe(item, item.recipe.consumable, inventoryMap);
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
    return out.slice(0, 50);
  }, [entries.length, inventoryMap]);

  const fullyCraftable = matches.filter((m) => m.canCraft > 0);
  const partial = matches.filter((m) => m.canCraft === 0);

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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder={PLACEHOLDER}
          aria-label="Your inventory — one mat per line or comma-separated"
          className="w-full px-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded text-sm font-mono focus:outline-none focus:border-[var(--color-gold-soft)] text-[var(--color-fg-1)] placeholder:text-[var(--color-fg-3)]"
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
          <div className="space-y-2">
            {fullyCraftable.map((m) => (
              <RecipeMatchRow key={m.item.slug} match={m} />
            ))}
          </div>
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
          <div className="space-y-2">
            {partial.slice(0, 20).map((m) => (
              <RecipeMatchRow key={m.item.slug} match={m} />
            ))}
          </div>
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
            ×{canCraft.toLocaleString()}
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
