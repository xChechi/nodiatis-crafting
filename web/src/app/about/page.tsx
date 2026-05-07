import Link from "next/link";
import { Sparkles, ExternalLink } from "lucide-react";
import { totalItemCount, totalRecipeCount } from "@/lib/data";

export const metadata = {
  title: "About",
  description:
    "About the Nodiatis Wiki & Crafting Calculator — a community-built replacement for the tools.nodiatis.com item table.",
};

export default function AboutPage() {
  const itemCount = totalItemCount();
  const recipeCount = totalRecipeCount();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
      <header className="mb-10">
        <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[var(--color-gold)] mb-3 flex items-center gap-2">
          <Sparkles size={12} className="opacity-70" />
          About
        </p>
        <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-5xl text-[var(--color-fg-1)]">
          A wiki built for players
        </h1>
      </header>

      <section className="prose prose-invert max-w-none text-[var(--color-fg-2)] leading-relaxed space-y-5">
        <p>
          The community tool at{" "}
          <a
            href="https://tools.nodiatis.com/neo-items/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-gold)] hover:underline inline-flex items-center gap-1"
          >
            tools.nodiatis.com
            <ExternalLink size={12} />
          </a>{" "}
          serves a 6,000-row table that&apos;s nearly impossible to navigate on
          mobile and offers no way to plan a crafting run across multiple items.
          This site fixes that.
        </p>

        <p>
          Browse {itemCount.toLocaleString()} items by category, view{" "}
          {recipeCount.toLocaleString()} recipes with full base-mat breakdowns,
          save favorites, and add anything to a planner that aggregates a
          single shopping list across every recipe — picking what you want to
          craft from raw or buy as intermediate.
        </p>
      </section>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard title="Stack">
          Next.js 16, React 19, TypeScript, Tailwind v4, Fuse.js for fuzzy
          search, deployed on Vercel.
        </InfoCard>
        <InfoCard title="Storage">
          Favorites and planner are kept in your browser&apos;s localStorage —
          nothing is sent to any server. Cloud sync is on the roadmap.
        </InfoCard>
        <InfoCard title="Data source">
          Item metadata, recipes, and artwork are scraped from{" "}
          <a
            href="https://tools.nodiatis.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-gold)] hover:underline"
          >
            tools.nodiatis.com
          </a>
          . This project is not affiliated with Glitchless or Nodiatis.
        </InfoCard>
        <InfoCard title="Open source">
          The code, scrapers, and data are public. PRs and bug reports welcome.
          <span className="block mt-2">
            <a
              href="https://github.com/xChechi/nodiatis-crafting"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[var(--color-gold)] hover:underline text-sm"
            >
              github.com/xChechi/nodiatis-crafting
              <ExternalLink size={12} />
            </a>
          </span>
        </InfoCard>
      </section>

      <section className="mt-12 border-t border-[var(--color-border)] pt-8">
        <h2 className="font-[family-name:var(--font-display-loaded)] text-xl text-[var(--color-fg-2)] mb-4">
          Credits
        </h2>
        <ul className="text-sm text-[var(--color-fg-2)] space-y-2">
          <li>
            <span className="text-[var(--color-fg-3)]">Built by</span>{" "}
            Stefan Nasev
          </li>
          <li>
            <span className="text-[var(--color-fg-3)]">Original data tool</span>{" "}
            — the maintainers of tools.nodiatis.com
          </li>
          <li>
            <span className="text-[var(--color-fg-3)]">Game</span>{" "}
            <a
              href="https://www.nodiatis.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-gold)] hover:underline"
            >
              Nodiatis
            </a>{" "}
            — © Glitchless
          </li>
        </ul>
      </section>

      <div className="mt-12 text-center">
        <Link
          href="/"
          className="inline-block text-sm text-[var(--color-gold)] hover:underline"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-lg p-5">
      <h3 className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-3)] mb-2">
        {title}
      </h3>
      <div className="text-sm text-[var(--color-fg-2)] leading-relaxed">
        {children}
      </div>
    </div>
  );
}
