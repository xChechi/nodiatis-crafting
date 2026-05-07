import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { CATEGORIES, categoryForType } from "@/lib/categories";
import { allItems, totalItemCount, totalRecipeCount } from "@/lib/data";
import { CategoryIcon } from "@/components/CategoryIcon";
import { RecentlyViewed } from "@/components/RecentlyViewed";

function counts() {
  const map = new Map<string, number>();
  for (const item of allItems()) {
    const cat = categoryForType(item.Type);
    if (cat) map.set(cat.slug, (map.get(cat.slug) ?? 0) + 1);
  }
  return map;
}

export default function HomePage() {
  const itemCount = totalItemCount();
  const recipeCount = totalRecipeCount();
  const byCategory = counts();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
      <section className="text-center mb-16">
        <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[var(--color-gold)] mb-4">
          Nodiatis Wiki
        </p>
        <h1 className="font-[family-name:var(--font-display-loaded)] text-4xl md:text-6xl font-semibold text-[var(--color-fg-1)] mb-4">
          Browse, craft, and plan
        </h1>
        <p className="text-base md:text-lg text-[var(--color-fg-2)] max-w-2xl mx-auto leading-relaxed">
          {itemCount.toLocaleString()} items, {recipeCount.toLocaleString()}{" "}
          recipes, fully searchable. Save favorites, plan crafting sessions,
          get one combined shopping list.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Sparkles size={14} className="text-[var(--color-gold-soft)] opacity-60" />
          <span className="text-xs text-[var(--color-fg-3)] font-mono">
            Press ⌘K to search
          </span>
          <Sparkles size={14} className="text-[var(--color-gold-soft)] opacity-60" />
        </div>
      </section>

      <RecentlyViewed />

      <section>
        <h2 className="font-[family-name:var(--font-display-loaded)] text-xl text-[var(--color-fg-2)] mb-6 tracking-wide">
          Browse by category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => {
            const count = byCategory.get(cat.slug) ?? 0;
            return (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="group relative bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-gold-soft)] rounded-lg p-6 transition-all duration-200 hover:bg-[var(--color-bg-3)]"
              >
                <div className="flex items-start justify-between mb-3">
                  <CategoryIcon
                    name={cat.icon}
                    className="text-[var(--color-gold)] opacity-80 group-hover:opacity-100"
                    size={24}
                  />
                  <ChevronRight
                    size={16}
                    className="text-[var(--color-fg-3)] group-hover:text-[var(--color-gold)] group-hover:translate-x-0.5 transition-all"
                  />
                </div>
                <h3 className="font-[family-name:var(--font-display-loaded)] text-lg text-[var(--color-fg-1)] mb-1">
                  {cat.label}
                </h3>
                <p className="text-xs text-[var(--color-fg-3)] font-mono">
                  {count.toLocaleString()} items
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
