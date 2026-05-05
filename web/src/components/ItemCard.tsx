import Link from "next/link";
import Image from "next/image";
import type { Item } from "@/lib/types";

const RARITY_BORDER: Record<string, string> = {
  Common: "border-[var(--color-rarity-common)]/30",
  Uncommon: "border-[var(--color-rarity-uncommon)]/40",
  Rare: "border-[var(--color-rarity-rare)]/40",
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

export function ItemCard({ item }: { item: Item }) {
  const borderClass = RARITY_BORDER[item.rarityLabel] ?? RARITY_BORDER.Common;
  const textClass = RARITY_TEXT[item.rarityLabel] ?? RARITY_TEXT.Common;

  return (
    <Link
      href={`/items/${item.slug}`}
      className={`group block bg-[var(--color-bg-2)] border ${borderClass} hover:border-[var(--color-gold-soft)] rounded-md p-3 transition-all`}
    >
      <div className="relative aspect-square bg-[var(--color-bg-3)] rounded mb-2 overflow-hidden">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.Name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            className="object-contain p-2 group-hover:scale-105 transition-transform"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-fg-3)] text-xs">
            no image
          </div>
        )}
      </div>
      <h3 className="text-xs text-[var(--color-fg-1)] line-clamp-2 leading-tight mb-1 group-hover:text-[var(--color-gold)]">
        {item.Name}
      </h3>
      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-fg-3)]">
        <span className={textClass}>{item.rarityLabel}</span>
        {item.Level !== undefined && item.Level !== null && item.Level > 0 && (
          <span>Lv {item.Level}</span>
        )}
      </div>
    </Link>
  );
}
