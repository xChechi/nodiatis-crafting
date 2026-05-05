"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Plus, Minus, Coins, Weight, MapPin } from "lucide-react";
import type { Item } from "@/lib/types";
import { getItemByName, getItemBySlug } from "@/lib/data";
import { useStorage } from "@/lib/storage";

const RARITY_BORDER: Record<string, string> = {
  Common: "border-[var(--color-rarity-common)]/30",
  Uncommon: "border-[var(--color-rarity-uncommon)]/40",
  Rare: "border-[var(--color-rarity-rare)]/50",
  Epic: "border-[var(--color-rarity-epic)]/50",
  Legendary: "border-[var(--color-rarity-legendary)]/60",
};

const RARITY_TEXT: Record<string, string> = {
  Common: "text-[var(--color-rarity-common)]",
  Uncommon: "text-[var(--color-rarity-uncommon)]",
  Rare: "text-[var(--color-rarity-rare)]",
  Epic: "text-[var(--color-rarity-epic)]",
  Legendary: "text-[var(--color-rarity-legendary)]",
};

export function ItemDetailClient({ item }: { item: Item }) {
  const { isFavorite, toggleFavorite, plannerQuantity, setPlannerQuantity } = useStorage();
  const fav = isFavorite(item.slug);
  const qty = plannerQuantity(item.slug);

  const borderClass = RARITY_BORDER[item.rarityLabel] ?? RARITY_BORDER.Common;
  const textClass = RARITY_TEXT[item.rarityLabel] ?? RARITY_TEXT.Common;

  const usedIn = item.usedInSlugs
    .map((slug) => getItemBySlug(slug))
    .filter((x): x is Item => Boolean(x));

  const stats = [
    item.Damage && { label: "Damage", value: item.Damage },
    item.ArmorClass && { label: "Armor", value: item.ArmorClass.toString() },
    item.Energy && { label: "Energy", value: item.Energy.toString() },
    item.Mana && { label: "Mana", value: item.Mana.toString() },
    item.Delay && { label: "Delay", value: item.Delay },
    item.Accuracy && { label: "Accuracy", value: item.Accuracy.toString() },
    item.RangeHaste && { label: "Range Haste", value: item.RangeHaste.toString() },
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className={`bg-[var(--color-bg-2)] border ${borderClass} rounded-lg overflow-hidden`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-6 p-6 border-b border-[var(--color-border)]">
          <div className="shrink-0 self-start mx-auto md:mx-0">
            <div className="w-32 h-32 md:w-40 md:h-40 bg-[var(--color-bg-3)] rounded-md flex items-center justify-center overflow-hidden border border-[var(--color-border)]">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.Name}
                  width={160}
                  height={160}
                  className="object-contain p-3"
                  unoptimized
                />
              ) : (
                <span className="text-xs text-[var(--color-fg-3)]">no image</span>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-xs font-mono uppercase tracking-wider mb-1 ${textClass}`}>
              {item.rarityLabel} · {item.Type}
            </p>
            <h1 className="font-[family-name:var(--font-display-loaded)] text-2xl md:text-3xl text-[var(--color-fg-1)] mb-3">
              {item.Name}
            </h1>

            {item.Description && (
              <p className="text-sm text-[var(--color-fg-2)] leading-relaxed mb-4 italic">
                {item.Description}
              </p>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              {item.Level !== undefined && item.Level > 0 && (
                <span className="text-[var(--color-fg-2)]">
                  <span className="text-[var(--color-fg-3)]">Level </span>
                  {item.Level}
                </span>
              )}
              {item.tier !== null && (
                <span className="text-[var(--color-fg-2)]">
                  <span className="text-[var(--color-fg-3)]">Tier </span>
                  {item.tier}
                </span>
              )}
              {item.Prereq && (
                <span className="text-[var(--color-fg-2)]">
                  <span className="text-[var(--color-fg-3)]">Prereq </span>
                  {item.Prereq}
                </span>
              )}
              {item.Cost !== undefined && item.Cost > 0 && (
                <span className="flex items-center gap-1 text-[var(--color-fg-2)]">
                  <Coins size={11} className="text-[var(--color-gold-soft)]" />
                  {item.Cost.toLocaleString()}
                  {item.Resell !== undefined && (
                    <span className="text-[var(--color-fg-3)]">
                      ({item.Resell.toLocaleString()})
                    </span>
                  )}
                </span>
              )}
              {item.Weight !== undefined && item.Weight > 0 && (
                <span className="flex items-center gap-1 text-[var(--color-fg-2)]">
                  <Weight size={11} className="text-[var(--color-fg-3)]" />
                  {item.Weight}
                </span>
              )}
              {item.Location && (
                <span className="flex items-center gap-1 text-[var(--color-fg-2)]">
                  <MapPin size={11} className="text-[var(--color-fg-3)]" />
                  {item.Location}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-5">
              <button
                onClick={() => toggleFavorite(item.slug)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm border transition-colors ${
                  fav
                    ? "bg-[var(--color-rust)]/15 border-[var(--color-rust)]/50 text-[var(--color-rust)]"
                    : "bg-[var(--color-bg-3)] border-[var(--color-border)] text-[var(--color-fg-2)] hover:border-[var(--color-rust)]/50"
                }`}
              >
                <Heart size={14} fill={fav ? "currentColor" : "none"} />
                {fav ? "Favorited" : "Favorite"}
              </button>

              <div className="flex items-center bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded">
                <button
                  onClick={() => setPlannerQuantity(item.slug, Math.max(0, qty - 1))}
                  disabled={qty === 0}
                  className="w-7 h-7 flex items-center justify-center text-[var(--color-fg-2)] hover:text-[var(--color-fg-1)] disabled:opacity-30"
                >
                  <Minus size={12} />
                </button>
                <input
                  type="number"
                  min={0}
                  value={qty}
                  onChange={(e) =>
                    setPlannerQuantity(item.slug, parseInt(e.target.value, 10) || 0)
                  }
                  className="w-12 text-center text-sm bg-transparent text-[var(--color-fg-1)] focus:outline-none"
                />
                <button
                  onClick={() => setPlannerQuantity(item.slug, qty + 1)}
                  className="w-7 h-7 flex items-center justify-center text-[var(--color-fg-2)] hover:text-[var(--color-fg-1)]"
                >
                  <Plus size={12} />
                </button>
              </div>
              <span className="text-xs text-[var(--color-fg-3)] self-center">
                in planner
              </span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        {(stats.length > 0 || item.Stats || item.Virtues) && (
          <div className="p-6 border-b border-[var(--color-border)]">
            <h2 className="font-[family-name:var(--font-display-loaded)] text-lg text-[var(--color-fg-2)] mb-3">
              Stats
            </h2>
            {stats.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded px-3 py-2"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-3)]">
                      {s.label}
                    </div>
                    <div className="text-[var(--color-fg-1)]">{s.value}</div>
                  </div>
                ))}
              </div>
            )}
            {item.Stats && (
              <p className="mt-3 text-sm text-[var(--color-fg-2)] font-mono">
                {item.Stats}
              </p>
            )}
            {item.Virtues && (
              <p className="mt-2 text-sm text-[var(--color-violet)]">
                Virtues: {item.Virtues}
              </p>
            )}
          </div>
        )}

        {/* Recipe */}
        {item.recipe && (
          <div className="p-6 border-b border-[var(--color-border)]">
            <h2 className="font-[family-name:var(--font-display-loaded)] text-lg text-[var(--color-fg-2)] mb-3">
              How to craft
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs uppercase tracking-wider text-[var(--color-fg-3)] mb-2">
                  Consumable layer (1 craft)
                </h3>
                <ul className="space-y-1.5">
                  {item.recipe.consumable.map((mat, i) => (
                    <MatRow key={i} mat={mat} />
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-xs uppercase tracking-wider text-[var(--color-fg-3)] mb-2">
                  Full breakdown to base mats
                </h3>
                <ul className="space-y-1.5">
                  {item.recipe.finished.map((mat, i) => (
                    <MatRow key={i} mat={mat} />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Used in recipes */}
        {usedIn.length > 0 && (
          <div className="p-6">
            <h2 className="font-[family-name:var(--font-display-loaded)] text-lg text-[var(--color-fg-2)] mb-3">
              Used in {usedIn.length} {usedIn.length === 1 ? "recipe" : "recipes"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {usedIn.map((u) => (
                <Link
                  key={u.slug}
                  href={`/items/${u.slug}`}
                  className="text-xs px-2 py-1 rounded bg-[var(--color-bg-3)] border border-[var(--color-border)] text-[var(--color-fg-2)] hover:border-[var(--color-gold-soft)] hover:text-[var(--color-gold)]"
                >
                  {u.Name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MatRow({ mat }: { mat: { name: string; tier: number; qty: number } }) {
  const matItem = getItemByName(mat.name);
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      {matItem ? (
        <Link
          href={`/items/${matItem.slug}`}
          className="text-[var(--color-fg-1)] hover:text-[var(--color-gold)] flex items-center gap-2 flex-1 min-w-0"
        >
          {matItem.imageUrl && (
            <Image
              src={matItem.imageUrl}
              alt=""
              width={20}
              height={20}
              className="shrink-0"
              unoptimized
            />
          )}
          <span className="truncate">{mat.name}</span>
        </Link>
      ) : (
        <span className="text-[var(--color-fg-2)] flex-1 min-w-0 truncate">
          {mat.name}
        </span>
      )}
      <span className="text-xs text-[var(--color-fg-3)] font-mono shrink-0">
        T{mat.tier} × {mat.qty}
      </span>
    </li>
  );
}

