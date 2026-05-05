"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useStorage } from "@/lib/storage";
import { getItemBySlug } from "@/lib/data";
import { ItemCard } from "@/components/ItemCard";
import type { Item } from "@/lib/types";

export default function FavoritesPage() {
  const { favorites, hydrated } = useStorage();

  const items = favorites
    .map((f) => getItemBySlug(f.slug))
    .filter((x): x is Item => Boolean(x));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="mb-8">
        <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl text-[var(--color-fg-1)] mb-1 flex items-center gap-3">
          <Heart size={24} className="text-[var(--color-rust)]" fill="currentColor" />
          Favorites
        </h1>
        <p className="text-sm text-[var(--color-fg-3)] font-mono">
          {items.length} saved {items.length === 1 ? "item" : "items"}
        </p>
      </header>

      {!hydrated ? (
        <div className="text-center py-20 text-[var(--color-fg-3)]">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--color-fg-2)] mb-2">No favorites yet.</p>
          <p className="text-sm text-[var(--color-fg-3)]">
            Click the ♥ on any item page to save it here.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-sm text-[var(--color-gold)] hover:underline"
          >
            Browse items →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((item) => (
            <ItemCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
