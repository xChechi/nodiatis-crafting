import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { CATEGORIES, categoryForType } from "@/lib/categories";
import { allItems, totalItemCount, totalRecipeCount } from "@/lib/data";
import { CategoryIcon } from "@/components/CategoryIcon";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SupportCard } from "@/components/SupportCard";

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
    <div className="max-w-[1600px] mx-auto px-6 py-6 md:py-10 lg:py-14">
      <section className="text-center mb-10 lg:mb-12">
        <p className="font-mono text-[11px] lg:text-xs tracking-[0.4em] uppercase text-[var(--color-gold)] mb-3">
          Nodiatis Wiki
        </p>
        <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-semibold text-[var(--color-fg-1)] mb-4">
          Browse, craft, and plan
        </h1>
        <p className="text-sm md:text-base lg:text-lg text-[var(--color-fg-2)] max-w-3xl mx-auto leading-relaxed">
          {itemCount.toLocaleString("en-US")} items, {recipeCount.toLocaleString("en-US")}{" "}
          recipes, fully searchable. Save favorites, plan crafting sessions,
          get one combined shopping list.
        </p>
        <div className="flex items-center justify-center gap-3 mt-5">
          <Sparkles size={14} className="text-[var(--color-gold-soft)] opacity-60" />
          <span className="text-xs lg:text-sm text-[var(--color-fg-3)] font-mono">
            Press ⌘K to search
          </span>
          <Sparkles size={14} className="text-[var(--color-gold-soft)] opacity-60" />
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display-loaded)] text-base lg:text-lg text-[var(--color-fg-2)] mb-4 tracking-wide">
          Browse by category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-5">
          {CATEGORIES.map((cat) => {
            const count = byCategory.get(cat.slug) ?? 0;
            return (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="group relative bg-[var(--color-bg-2)] border border-[var(--color-border)] hover:border-[var(--color-gold-soft)] rounded-lg p-4 lg:p-6 transition-all duration-200 hover:bg-[var(--color-bg-3)]"
              >
                <div className="flex items-start justify-between mb-2 lg:mb-3">
                  <CategoryIcon
                    name={cat.icon}
                    className="text-[var(--color-gold)] opacity-80 group-hover:opacity-100"
                    size={22}
                  />
                  <ChevronRight
                    size={14}
                    className="text-[var(--color-fg-3)] group-hover:text-[var(--color-gold)] group-hover:translate-x-0.5 transition-all"
                  />
                </div>
                <h3 className="font-[family-name:var(--font-display-loaded)] text-base lg:text-xl text-[var(--color-fg-1)] leading-tight">
                  {cat.label}
                </h3>
                <p className="text-[10px] lg:text-xs text-[var(--color-fg-3)] font-mono mt-0.5 lg:mt-1">
                  {count.toLocaleString("en-US")} items
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-6 lg:mt-8">
        <RecentlyViewed />
      </div>

      <section className="mt-10 lg:mt-14">
        <figure className="max-w-3xl mx-auto mb-8 lg:mb-10 px-5 lg:px-6 py-4 lg:py-5 border-l-2 border-[var(--color-gold-soft)] bg-[var(--color-bg-2)]/50 rounded-r-md">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[var(--color-gold)] mb-2">
            Why this exists
          </p>
          <blockquote className="text-base lg:text-lg text-[var(--color-fg-2)] leading-relaxed font-[family-name:var(--font-display-loaded)] italic">
            The community tool at{" "}
            <a
              href="https://tools.nodiatis.com/neo-items/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-fg-1)] hover:text-[var(--color-gold)] not-italic"
            >
              tools.nodiatis.com
            </a>{" "}
            serves a 6,000-row table that&apos;s nearly impossible to navigate
            on mobile and offers no way to plan a crafting run across
            multiple items.{" "}
            <span className="text-[var(--color-gold)] not-italic font-semibold">
              This site fixes that.
            </span>
          </blockquote>
        </figure>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          <FeedbackForm />
          <SupportCard />
        </div>
      </section>
    </div>
  );
}
