"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calculator,
  X,
  Copy,
  Trash2,
  Plus,
  Minus,
  Layers,
  Share2,
  RotateCcw,
  Package,
} from "lucide-react";
import { useStorage } from "@/lib/storage";
import { useToast } from "@/lib/toast";
import {
  getIndexedItemBySlug,
  type IndexedItem,
} from "@/lib/clientIndex";
import {
  aggregatePlannerForDisplay,
  type AggregatedMatRow,
  type PlannerAggregateResult,
} from "@/lib/plannerActions";

type CraftingDepth = "finished" | "base";

interface PlannerEntry {
  slug: string;
  quantity: number;
}

const URL_PARAM = "p";

/** Encode planner state as `slug-1:5,slug-2:2`. Slugs are URL-safe. */
function encodePlanner(entries: PlannerEntry[]): string {
  return entries
    .filter((e) => e.quantity > 0)
    .map((e) => `${e.slug}:${e.quantity}`)
    .join(",");
}

/** Decode `slug-1:5,slug-2:2` to entries; tolerates malformed input. */
function decodePlanner(encoded: string): PlannerEntry[] {
  if (!encoded) return [];
  return encoded
    .split(",")
    .map((part) => {
      const [slug, qtyRaw] = part.split(":");
      const qty = parseInt(qtyRaw ?? "0", 10);
      if (!slug || !Number.isFinite(qty) || qty <= 0) return null;
      // Reject unknown slugs to avoid polluting state with junk
      if (!getIndexedItemBySlug(slug)) return null;
      return { slug, quantity: qty };
    })
    .filter((x): x is PlannerEntry => x !== null);
}

function plannersEqual(a: PlannerEntry[], b: PlannerEntry[]): boolean {
  if (a.length !== b.length) return false;
  const sortKey = (e: PlannerEntry) => `${e.slug}:${e.quantity}`;
  const aSorted = [...a].map(sortKey).sort();
  const bSorted = [...b].map(sortKey).sort();
  return aSorted.every((v, i) => v === bSorted[i]);
}

const DEPTH_OPTIONS: Array<{
  value: CraftingDepth;
  label: string;
  hint: string;
}> = [
  {
    value: "base",
    label: "Consumable Layer",
    hint: "Consumable-layer items (Dye, Cloth, Dust)",
  },
  {
    value: "finished",
    label: "Base mats",
    hint: "Finished base materials (Plank, Geode, Resin)",
  },
];

const DEBOUNCE_MS = 200;

export function PlannerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const {
    planner,
    hydrated,
    setPlannerQuantity,
    removeFromPlanner,
    clearPlanner,
    replacePlanner,
  } = useStorage();
  const [depth, setDepth] = useState<CraftingDepth>("base");
  const [importBackup, setImportBackup] = useState<PlannerEntry[] | null>(null);
  const importHandledRef = useRef(false);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("planner.priceOverrides");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("planner.priceOverrides", JSON.stringify(priceOverrides));
    } catch {
      // localStorage full or disabled — silently ignore
    }
  }, [priceOverrides]);

  // ─── Server-side aggregation ─────────────────────────────────────────────
  const [result, setResult] = useState<PlannerAggregateResult | null>(null);
  const [isPending, startTransition] = useTransition();
  // Track the most recent request so we can ignore stale responses if the
  // user changes state again before the previous call resolves.
  const requestIdRef = useRef(0);

  // ─── Import from URL on first mount ──────────────────────────────────────
  useEffect(() => {
    if (!hydrated || importHandledRef.current) return;
    const encoded = searchParams.get(URL_PARAM);
    if (!encoded) {
      importHandledRef.current = true;
      return;
    }
    const incoming = decodePlanner(encoded);
    if (incoming.length === 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(URL_PARAM);
      router.replace(params.toString() ? `?${params.toString()}` : "/planner", {
        scroll: false,
      });
      importHandledRef.current = true;
      return;
    }
    if (!plannersEqual(incoming, planner)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImportBackup(planner);
      replacePlanner(incoming);
    }
    importHandledRef.current = true;
  }, [hydrated, searchParams, planner, replacePlanner, router]);

  // ─── Debounced server-action call on planner/depth change ────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (planner.length === 0) {
      // Use a microtask so React doesn't see a synchronous setState during
      // the effect body (avoids the cascading-renders lint warning).
      queueMicrotask(() => setResult(null));
      return;
    }
    const myId = ++requestIdRef.current;
    const t = setTimeout(() => {
      const input = planner.map((p) => ({
        slug: p.slug,
        quantity: p.quantity,
      }));
      startTransition(async () => {
        try {
          const next = await aggregatePlannerForDisplay(input, depth);
          // Drop response if a newer request has already started
          if (myId !== requestIdRef.current) return;
          setResult(next);
        } catch (err) {
          console.error("planner aggregation failed", err);
          if (myId === requestIdRef.current) {
            toast.push("error", "Couldn't compute the shopping list");
          }
        }
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [hydrated, planner, depth, toast]);

  function undoImport() {
    if (importBackup === null) return;
    replacePlanner(importBackup);
    setImportBackup(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete(URL_PARAM);
    router.replace(params.toString() ? `?${params.toString()}` : "/planner", {
      scroll: false,
    });
  }

  function dismissImportBanner() {
    setImportBackup(null);
  }

  function buildShareUrl(): string {
    if (typeof window === "undefined") return "";
    const encoded = encodePlanner(planner);
    const url = new URL(window.location.origin + "/planner");
    if (encoded) url.searchParams.set(URL_PARAM, encoded);
    return url.toString();
  }

  function copyShareUrl() {
    const url = buildShareUrl();
    if (!url) return;
    void navigator.clipboard?.writeText(url).then(
      () => toast.push("success", "Shareable link copied to clipboard"),
      () => toast.push("error", "Couldn't copy to clipboard"),
    );
  }

  // Display info comes from the slim client index (no full DB).
  const entries = useMemo(
    () =>
      planner
        .map((p) => {
          const item = getIndexedItemBySlug(p.slug);
          return item ? { item, quantity: p.quantity } : null;
        })
        .filter((x): x is { item: IndexedItem; quantity: number } => Boolean(x)),
    [planner],
  );

  const aggregated: AggregatedMatRow[] = useMemo(
    () => result?.aggregated ?? [],
    [result],
  );
  const costSummary = result?.costSummary ?? {
    buyable: 0,
    buyableLines: 0,
    unbuyableLines: 0,
  };

  // Recompute buy cost client-side so price overrides are reflected immediately.
  const effectiveBuyCost = useMemo(() => {
    return aggregated.reduce((sum, mat) => {
      const effectiveUnitCost = priceOverrides[mat.name] ?? mat.unitCost;
      return sum + effectiveUnitCost * mat.qty;
    }, 0);
  }, [aggregated, priceOverrides]);

  const oneLine = aggregated
    .map((m) => `${m.qty} ${m.name} (T${m.tier})`)
    .join(", ");

  function copyShoppingList() {
    void navigator.clipboard?.writeText(oneLine).then(
      () => toast.push("success", "Shopping list copied"),
      () => toast.push("error", "Couldn't copy to clipboard"),
    );
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
            {isPending && (
              <span className="ml-2 text-[var(--color-gold-soft)]">
                computing…
              </span>
            )}
          </p>
        </div>
        {entries.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyShareUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded text-[var(--color-fg-2)] hover:border-[var(--color-gold-soft)] hover:text-[var(--color-gold)]"
              title="Copy a shareable link to this planner state"
            >
              <Share2 size={13} />
              Share
            </button>
            <button
              onClick={() => {
                if (confirm("Clear the planner?")) clearPlanner();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-rust)] border border-[var(--color-border)] rounded"
            >
              <Trash2 size={13} />
              Clear all
            </button>
          </div>
        )}
      </header>

      {importBackup !== null && (
        <div className="mb-6 flex items-center justify-between gap-3 p-3 bg-[var(--color-bg-2)] border border-[var(--color-gold-soft)]/40 rounded-md text-sm">
          <span className="text-[var(--color-fg-2)]">
            Imported a planner from a shared link.{" "}
            <span className="text-[var(--color-fg-3)]">
              Your previous list ({importBackup.length}{" "}
              {importBackup.length === 1 ? "item" : "items"}) was replaced.
            </span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={undoImport}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-[var(--color-fg-1)] hover:border-[var(--color-gold-soft)]"
            >
              <RotateCcw size={11} />
              Restore mine
            </button>
            <button
              onClick={dismissImportBanner}
              className="text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)]"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

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
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="shrink-0 bg-[var(--color-bg-3)] rounded p-1"
                      unoptimized
                    />
                  ) : (
                    <span
                      className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded bg-[var(--color-bg-3)] border border-[var(--color-border)]"
                      title="Image not available upstream"
                      aria-hidden="true"
                    >
                      <Package size={18} className="text-[var(--color-fg-3)]/50" />
                    </span>
                  )}
                  <Link
                    href={`/items/${item.slug}`}
                    className="flex-1 min-w-0 text-[var(--color-fg-1)] hover:text-[var(--color-gold)]"
                  >
                    <div className="text-sm truncate">{item.Name}</div>
                    <div className="text-[10px] font-mono text-[var(--color-fg-3)]">
                      {item.consumableCount} direct mats per craft
                    </div>
                  </Link>
                  <div className="flex items-center bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded shrink-0">
                    <button
                      onClick={() => setPlannerQuantity(item.slug, quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center text-[var(--color-fg-2)] hover:text-[var(--color-fg-1)]"
                      aria-label={`Decrease ${item.Name} quantity`}
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
                      aria-label={`${item.Name} quantity`}
                      className="w-12 text-center text-sm bg-transparent text-[var(--color-fg-1)] focus:outline-none"
                    />
                    <button
                      onClick={() => setPlannerQuantity(item.slug, quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center text-[var(--color-fg-2)] hover:text-[var(--color-fg-1)]"
                      aria-label={`Increase ${item.Name} quantity`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromPlanner(item.slug)}
                    className="text-[var(--color-fg-3)] hover:text-[var(--color-rust)] shrink-0"
                    aria-label={`Remove ${item.Name} from planner`}
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPriceOverrides((prev) => {
                        const next = { ...prev };
                        for (const m of aggregated) delete next[m.name];
                        return next;
                      });
                    }}
                    disabled={Object.keys(priceOverrides).length === 0}
                    className="text-xs px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] hover:border-[var(--color-gold-soft)] disabled:opacity-50"
                  >
                    Reset
                  </button>
                  <button
                    onClick={copyShoppingList}
                    disabled={aggregated.length === 0}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-[var(--color-fg-2)] hover:border-[var(--color-gold-soft)] hover:text-[var(--color-gold)] disabled:opacity-40 disabled:hover:border-[var(--color-border)]"
                    title="Copy one-line version"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
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

              <div className={`max-h-[60vh] overflow-y-auto p-4 space-y-1 ${isPending ? "opacity-60" : ""}`}>
                {aggregated.length === 0 && !isPending && (
                  <p className="text-xs text-[var(--color-fg-3)] text-center py-6">
                    No mats to show.
                  </p>
                )}
                {aggregated.map((mat) => {
                  const effectiveUnitCost = priceOverrides[mat.name] ?? mat.unitCost;
                  const lineCost = effectiveUnitCost * mat.qty;
                  return (
                    <div
                      key={`${mat.name}-${mat.tier}`}
                      className="flex items-center justify-between py-1 text-sm border-b border-[var(--color-border)]/30 last:border-0"
                    >
                      {mat.matSlug ? (
                        <Link
                          href={`/items/${mat.matSlug}`}
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
                        × {mat.qty.toLocaleString("en-US")}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={effectiveUnitCost}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setPriceOverrides((prev) => {
                            const next = { ...prev };
                            if (Number.isFinite(v) && v >= 0) {
                              next[mat.name] = v;
                            } else {
                              delete next[mat.name];
                            }
                            return next;
                          });
                        }}
                        className={
                          "ml-2 w-16 bg-[var(--color-bg-3)] border rounded px-1.5 py-0.5 text-xs font-mono text-right text-[var(--color-fg-2)] focus:outline-none focus:border-[var(--color-gold-soft)] shrink-0 " +
                          (priceOverrides[mat.name] !== undefined
                            ? "border-[var(--color-gold-soft)]"
                            : "border-[var(--color-border)]")
                        }
                        title="Unit price (override merchant default)"
                      />
                      <span
                        className="ml-2 font-mono text-xs shrink-0 w-20 text-right text-[var(--color-fg-3)]"
                        title={
                          lineCost > 0
                            ? `${effectiveUnitCost.toLocaleString("en-US")} gold each`
                            : "Not sold by merchants"
                        }
                      >
                        {lineCost > 0 ? lineCost.toLocaleString("en-US") : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {aggregated.length > 0 && (
                <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-3)]/40">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-fg-3)] uppercase tracking-wider text-[10px]">
                      Buy cost
                    </span>
                    <span className="font-mono text-[var(--color-gold)] text-base">
                      {effectiveBuyCost.toLocaleString("en-US")}{" "}
                      <span className="text-[10px] text-[var(--color-fg-3)] uppercase">
                        gold
                      </span>
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--color-fg-3)] mt-1 leading-snug">
                    Sums merchant prices for {costSummary.buyableLines} of{" "}
                    {aggregated.length} mats.
                    {costSummary.unbuyableLines > 0 && (
                      <>
                        {" "}
                        {costSummary.unbuyableLines} are not sold (gathered or
                        dropped).
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
