"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Item } from "@/lib/types";
import type {
  SortColumn,
  SortState,
} from "@/app/category/[slug]/CategoryClient";

const RARITY_TEXT: Record<string, string> = {
  Common: "text-[var(--color-rarity-common)]",
  Uncommon: "text-[var(--color-rarity-uncommon)]",
  Rare: "text-[var(--color-rarity-rare)]",
  Epic: "text-[var(--color-rarity-epic)]",
  Legendary: "text-[var(--color-rarity-legendary)]",
};

interface SortableHeaderProps {
  label: string;
  column: SortColumn;
  sort?: SortState;
  onSortChange?: (column: SortColumn) => void;
  align?: "left" | "right";
  className?: string;
}

function SortableHeader({
  label,
  column,
  sort,
  onSortChange,
  align = "left",
  className,
}: SortableHeaderProps) {
  const active = sort?.column === column;
  const Arrow = sort?.dir === "desc" ? ArrowDown : ArrowUp;
  const justify = align === "right" ? "justify-end" : "justify-start";
  const ariaSort: "ascending" | "descending" | "none" = active
    ? sort?.dir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <th
      aria-sort={ariaSort}
      className={`p-2 text-${align} ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={() => onSortChange?.(column)}
        aria-label={`Sort by ${label}${active ? `, currently ${ariaSort}` : ""}`}
        className={`flex items-center gap-1 ${justify} w-full uppercase tracking-wider text-[10px] hover:text-[var(--color-fg-1)] transition-colors ${
          active ? "text-[var(--color-gold)]" : "text-[var(--color-fg-3)]"
        }`}
      >
        {label}
        {active && <Arrow size={10} />}
      </button>
    </th>
  );
}

export function ItemTable({
  items,
  sort,
  onSortChange,
}: {
  items: Item[];
  sort?: SortState;
  onSortChange?: (column: SortColumn) => void;
}) {
  // Decide which optional columns to show based on what's actually populated
  const hasDamage = items.some((i) => i.Damage);
  const hasArmor = items.some((i) => i.ArmorClass);
  const hasStats = items.some((i) => i.Stats);
  const hasVirtues = items.some((i) => i.Virtues);

  return (
    <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-3)]">
            <tr>
              <th className="text-left p-2 w-12"></th>
              <SortableHeader label="Name" column="name" sort={sort} onSortChange={onSortChange} />
              <SortableHeader label="Rarity" column="rarity" sort={sort} onSortChange={onSortChange} className="w-24" />
              <SortableHeader label="Lv" column="level" sort={sort} onSortChange={onSortChange} align="right" className="w-16" />
              <SortableHeader label="Tier" column="tier" sort={sort} onSortChange={onSortChange} align="right" className="w-16" />
              {hasDamage && (
                <SortableHeader label="Damage" column="damage" sort={sort} onSortChange={onSortChange} className="w-24" />
              )}
              {hasArmor && (
                <SortableHeader label="Armor" column="armor" sort={sort} onSortChange={onSortChange} align="right" className="w-16" />
              )}
              <SortableHeader label="Cost" column="cost" sort={sort} onSortChange={onSortChange} align="right" className="w-28" />
              <SortableHeader label="Weight" column="weight" sort={sort} onSortChange={onSortChange} align="right" className="w-20" />
              <th className="text-left p-2 w-40 uppercase tracking-wider text-[10px] text-[var(--color-fg-3)]">
                Prereq
              </th>
              {hasStats && (
                <th className="text-left p-2 uppercase tracking-wider text-[10px] text-[var(--color-fg-3)]">
                  Stats
                </th>
              )}
              {hasVirtues && (
                <th className="text-left p-2 w-40 uppercase tracking-wider text-[10px] text-[var(--color-fg-3)]">
                  Virtues
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.slug}
                className="border-t border-[var(--color-border)]/40 hover:bg-[var(--color-bg-3)] transition-colors"
              >
                <td className="p-1">
                  <Link href={`/items/${item.slug}`} className="block">
                    <div className="w-9 h-9 bg-[var(--color-bg-3)] rounded flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
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
                <td className="p-2">
                  <Link
                    href={`/items/${item.slug}`}
                    className="text-[var(--color-fg-1)] hover:text-[var(--color-gold)] block leading-snug"
                  >
                    {item.Name}
                  </Link>
                </td>
                <td className={`p-2 text-xs ${RARITY_TEXT[item.rarityLabel] ?? ""}`}>
                  {item.rarityLabel}
                </td>
                <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs">
                  {item.Level !== undefined && item.Level > 0 ? item.Level : "—"}
                </td>
                <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs">
                  {item.tier !== null ? `T${item.tier}` : "—"}
                </td>
                {hasDamage && (
                  <td className="p-2 text-[var(--color-fg-2)] font-mono text-xs">
                    {item.Damage ?? "—"}
                  </td>
                )}
                {hasArmor && (
                  <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs">
                    {item.ArmorClass ?? "—"}
                  </td>
                )}
                <td className="p-2 text-right text-[var(--color-fg-2)] font-mono text-xs">
                  {item.Cost && item.Cost > 0 ? item.Cost.toLocaleString() : "—"}
                </td>
                <td className="p-2 text-right text-[var(--color-fg-3)] font-mono text-xs">
                  {item.Weight && item.Weight > 0 ? item.Weight : "—"}
                </td>
                <td className="p-2 text-xs text-[var(--color-fg-2)] truncate max-w-[10rem]">
                  {item.Prereq && item.Prereq !== "None" ? item.Prereq : "—"}
                </td>
                {hasStats && (
                  <td className="p-2 text-xs text-[var(--color-fg-2)] font-mono truncate max-w-[14rem]">
                    {item.Stats ?? "—"}
                  </td>
                )}
                {hasVirtues && (
                  <td className="p-2 text-xs text-[var(--color-violet)] truncate max-w-[10rem]">
                    {item.Virtues ?? "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile compact list */}
      <div className="md:hidden divide-y divide-[var(--color-border)]/40">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`/items/${item.slug}`}
            className="flex items-center gap-2 p-2 hover:bg-[var(--color-bg-3)]"
          >
            <div className="w-9 h-9 bg-[var(--color-bg-3)] rounded flex items-center justify-center overflow-hidden shrink-0">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
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
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[var(--color-fg-1)] truncate leading-tight">
                {item.Name}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--color-fg-3)]">
                <span className={RARITY_TEXT[item.rarityLabel] ?? ""}>
                  {item.rarityLabel}
                </span>
                {item.Level !== undefined && item.Level > 0 && (
                  <span>Lv {item.Level}</span>
                )}
                {item.tier !== null && <span>T{item.tier}</span>}
                {item.Cost && item.Cost > 0 && (
                  <span>{item.Cost.toLocaleString()}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
