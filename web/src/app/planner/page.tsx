"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Calculator, X, Copy, Trash2, Plus, Minus, Layers } from "lucide-react";
import { useStorage } from "@/lib/storage";
import { getItemBySlug, getItemByName } from "@/lib/data";
import { aggregatePlannerMats, type CraftingDepth } from "@/lib/crafting";
import type { Item } from "@/lib/types";

const DEPTH_OPTIONS: Array<{
  value: CraftingDepth;
  label: string;
  hint: string;
}> = [
  {
    value: "consumable",
    label: "Direct",
    hint: "Just the immediate craft inputs (1 dye + 1 cloth)",
  },
  {
    value: "finished",
    label: "Finished",
    hint: "Nodiatis's stock breakdown — partial expansion",
  },
  {
    value: "base",
    label: "Base mats",
    hint: "Recursive — everything gathered from raw (cloth → thread → silk → ...)",
  },
];

export default function PlannerPage() {
  const { planner, hydrated, setPlannerQuantity, removeFromPlanner, clearPlanner } =
    useStorage();
  const [depth, setDepth] = useState<CraftingDepth>("base");

  const entries = useMemo(
    () =>
      planner
        .map((p) => {
          const item = getItemBySlug(p.slug);
          return item ? { item, quantity: p.quantity } : null;
        })
        .filter((x): x is { item: Item; quantity: number } => Boolean(x)),
    [planner],
  );

  const aggregated = useMemo(
    () => aggregatePlannerMats(entries, depth),
    [entries, depth],
  );

  const oneLine = aggregated
    .map((m) => `${m.qty} ${m.name} (T${m.tier})`)
    .join(", ");

  function copyShoppingList() {
    void navigator.clipboard?.writeText(oneLine);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl text-[var(--color-fg-1)] mb-1 flex items-center gap-3">
            <Calculator size={24} className="text-[var(--color-gold)]" />
            Crafting Planner
          </h1>
          <p className="text-sm text-[var(--color-fg-3)] font-mono">
            {entries.length} {entries.length === 1 ? "recipe" : "recipes"} ·{" "}
            {aggregated.length} unique mats
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Clear the planner?")) clearPlanner();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-rust)] border border-[var(--color-border)] rounded"
          >
            <Trash2 size={13} />
            Clear all
          </button>
        )}
      </header>

      {!hydrated ? (
        <div className="text-center py-20 text-[var(--color-fg-3)]">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--color-fg-2)] mb-2">Planner is empty.</p>
          <p className="text-sm text-[var(--color-fg-3)]">
            Open any craftable item page and use the +/− to add it.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-sm text-[var(--color-gold)] hover:underline"
          >
            Browse items →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* Left: planned items */}
          <section>
            <h2 className="font-[family-name:var(--font-display-loaded)] text-lg text-[var(--color-fg-2)] mb-3">
              Planned items
            </h2>
            <div className="space-y-2">
              {entries.map(({ item, quantity }) => (
                <div
                  key={item.slug}
                  className="flex items-center gap-3 p-3 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md"
                >
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="shrink-0 bg-[var(--color-bg-3)] rounded p-1"
                      unoptimized
                    />
                  )}
                  <Link
                    href={`/items/${item.slug}`}
                    className="flex-1 min-w-0 text-[var(--color-fg-1)] hover:text-[var(--color-gold)]"
                  >
                    <div className="text-sm truncate">{item.Name}</div>
                    <div className="text-[10px] font-mono text-[var(--color-fg-3)]">
                      {item.recipe?.consumable.length ?? 0} direct mats per craft
                    </div>
                  </Link>
                  <div className="flex items-center bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded shrink-0">
                    <button
                      onClick={() => setPlannerQuantity(item.slug, quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center text-[var(--color-fg-2)] hover:text-[var(--color-fg-1)]"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={quantity}
                      onChange={(e) =>
                        setPlannerQuantity(item.slug, parseInt(e.target.value, 10) || 0)
                      }
                      className="w-12 text-center text-sm bg-transparent text-[var(--color-fg-1)] focus:outline-none"
                    />
                    <button
                      onClick={() => setPlannerQuantity(item.slug, quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center text-[var(--color-fg-2)] hover:text-[var(--color-fg-1)]"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromPlanner(item.slug)}
                    className="text-[var(--color-fg-3)] hover:text-[var(--color-rust)] shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Right: aggregated shopping list */}
          <aside>
            <div className="sticky top-20 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md">
              <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                <h2 className="font-[family-name:var(--font-display-loaded)] text-lg text-[var(--color-fg-2)]">
                  Shopping list
                </h2>
                <button
                  onClick={copyShoppingList}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-[var(--color-fg-2)] hover:border-[var(--color-gold-soft)] hover:text-[var(--color-gold)]"
                  title="Copy one-line version"
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>

              {/* Depth toggle */}
              <div className="px-4 pt-3 pb-2 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-3)]">
                  <Layers size={11} />
                  Calculation depth
                </div>
                <div className="flex gap-1">
                  {DEPTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDepth(opt.value)}
                      title={opt.hint}
                      className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                        depth === opt.value
                          ? "bg-[var(--color-bg-3)] border-[var(--color-gold-soft)] text-[var(--color-gold)]"
                          : "bg-transparent border-[var(--color-border)] text-[var(--color-fg-3)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg-2)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--color-fg-3)] mt-1.5 leading-snug">
                  {DEPTH_OPTIONS.find((o) => o.value === depth)?.hint}
                </p>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-1">
                {aggregated.map((mat) => {
                  const matItem = getItemByName(mat.name);
                  return (
                    <div
                      key={`${mat.name}-${mat.tier}`}
                      className="flex items-center justify-between py-1 text-sm border-b border-[var(--color-border)]/30 last:border-0"
                    >
                      {matItem ? (
                        <Link
                          href={`/items/${matItem.slug}`}
                          className="flex-1 min-w-0 truncate text-[var(--color-fg-1)] hover:text-[var(--color-gold)]"
                        >
                          {mat.name}
                        </Link>
                      ) : (
                        <span className="flex-1 min-w-0 truncate text-[var(--color-fg-2)]">
                          {mat.name}
                        </span>
                      )}
                      <span className="font-mono text-xs text-[var(--color-fg-3)] shrink-0">
                        T{mat.tier}
                      </span>
                      <span className="ml-3 text-[var(--color-gold)] font-mono shrink-0 w-16 text-right">
                        × {mat.qty.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
