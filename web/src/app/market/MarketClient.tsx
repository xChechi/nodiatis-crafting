"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp } from "lucide-react";
import { MarketSparkline } from "@/components/MarketSparkline";

export interface MarketRow {
  slug: string;
  name: string;
  type: string;
  tier: number | null;
  imageUrl: string | null;
  current: number;
  history: number[];
  changePct: number | null;
}

type SortColumn = "name" | "tier" | "current" | "changePct";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortColumn; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Item", align: "left" },
  { key: "tier", label: "Tier", align: "right" },
  { key: "current", label: "Ask", align: "right" },
  { key: "changePct", label: "Δ vs last", align: "right" },
];

export function MarketClient({ rows }: { rows: MarketRow[] }) {
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir }>({
    column: "current",
    dir: "desc",
  });
  const [filter, setFilter] = useState("");

  const sorted = useMemo(() => {
    const filtered = filter
      ? rows.filter((r) =>
          r.name.toLowerCase().includes(filter.toLowerCase()) ||
          r.type.toLowerCase().includes(filter.toLowerCase()),
        )
      : rows;
    const cmp = (a: MarketRow, b: MarketRow) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.column) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "tier":
          return ((a.tier ?? -1) - (b.tier ?? -1)) * dir;
        case "current":
          return (a.current - b.current) * dir;
        case "changePct":
          return ((a.changePct ?? 0) - (b.changePct ?? 0)) * dir;
      }
    };
    return [...filtered].sort(cmp);
  }, [rows, sort, filter]);

  function toggleSort(column: SortColumn) {
    setSort((s) =>
      s.column === column
        ? { column, dir: s.dir === "asc" ? "desc" : "asc" }
        : { column, dir: column === "name" || column === "tier" ? "asc" : "desc" },
    );
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Filter by name or type…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-4 w-full sm:w-80 px-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded text-sm"
      />
      <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-3)]">
            <tr>
              <th className="text-left p-2 w-12"></th>
              {COLUMNS.map((col) => {
                const active = sort.column === col.key;
                const Arrow = active && sort.dir === "desc" ? ArrowDown : ArrowUp;
                return (
                  <th
                    key={col.key}
                    className={`p-2 text-${col.align} uppercase tracking-wider text-[10px] text-[var(--color-fg-3)]`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : "justify-start"} w-full hover:text-[var(--color-fg-1)] transition-colors ${
                        active ? "text-[var(--color-gold)]" : ""
                      }`}
                    >
                      {col.label}
                      {active && <Arrow size={10} />}
                    </button>
                  </th>
                );
              })}
              <th className="p-2 text-right uppercase tracking-wider text-[10px] text-[var(--color-fg-3)] w-24">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.slug}
                className="border-t border-[var(--color-border)]/40 hover:bg-[var(--color-bg-3)] transition-colors [&>td]:py-3"
              >
                <td className="p-1">
                  <Link href={`/items/${row.slug}`} className="block">
                    <div className="w-9 h-9 bg-[var(--color-bg-3)] rounded flex items-center justify-center overflow-hidden">
                      {row.imageUrl ? (
                        <Image
                          src={row.imageUrl}
                          alt=""
                          width={36}
                          height={36}
                          className="object-contain max-w-full max-h-full"
                          unoptimized
                        />
                      ) : (
                        <span className="text-[8px] text-[var(--color-fg-3)] font-mono">--</span>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="p-2 whitespace-nowrap">
                  <Link
                    href={`/items/${row.slug}`}
                    className="text-[var(--color-fg-1)] hover:text-[var(--color-gold)]"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs">
                  {row.tier !== null ? `T${row.tier}` : "—"}
                </td>
                <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs">
                  {row.current.toLocaleString("en-US")}
                </td>
                <td className="p-2 text-right font-mono text-xs">
                  {row.changePct === null ? (
                    <span className="text-[var(--color-fg-3)]">—</span>
                  ) : (
                    <span
                      className={
                        row.changePct > 0
                          ? "text-[var(--color-rose)]"
                          : row.changePct < 0
                            ? "text-[var(--color-emerald)]"
                            : "text-[var(--color-fg-3)]"
                      }
                    >
                      {row.changePct > 0 ? "+" : ""}
                      {row.changePct.toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="p-2 text-right">
                  <MarketSparkline history={row.history} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
