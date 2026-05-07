"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import { useStorage } from "@/lib/storage";
import { getIndexedItemBySlug, type IndexedItem } from "@/lib/clientIndex";

export function RecentlyViewed() {
  const { recent, hydrated } = useStorage();
  if (!hydrated || recent.length === 0) return null;

  const items = recent
    .map((s) => getIndexedItemBySlug(s))
    .filter((x): x is IndexedItem => Boolean(x))
    .slice(0, 8);

  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--color-fg-3)] mb-3">
        <Clock size={12} className="text-[var(--color-gold-soft)]" />
        Recently viewed
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`/items/${item.slug}`}
            title={item.Name}
            className="shrink-0 group flex flex-col items-center gap-1 w-20 p-2 rounded bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-gold-soft)] transition-colors"
          >
            <div className="w-12 h-12 bg-[var(--color-bg-3)] rounded flex items-center justify-center overflow-hidden">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="object-contain max-w-full max-h-full"
                  unoptimized
                />
              ) : (
                <span className="text-[8px] text-[var(--color-fg-3)] font-mono">--</span>
              )}
            </div>
            <span className="text-[10px] text-[var(--color-fg-2)] line-clamp-2 leading-tight text-center group-hover:text-[var(--color-gold)]">
              {item.Name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
