"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { MaterialTypeSummary } from "@/lib/materials";

interface Props {
  tiered: MaterialTypeSummary[];
  special: MaterialTypeSummary[];
}

export function MaterialsLanding({ tiered, special }: Props) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] mb-4"
      >
        <ChevronLeft size={14} />
        Back to home
      </Link>

      <h1 className="font-[family-name:var(--font-display-loaded)] text-2xl text-[var(--color-fg-1)] mb-6 tracking-wide">
        Materials
      </h1>

      <Section title="Tiered (T1–T30)" cols={5}>
        {tiered.map((t) => (
          <TypeCard key={t.slug} t={t} showCount={false} />
        ))}
      </Section>

      <Section title="Special" cols={4} className="mt-8">
        {special.map((t) => (
          <TypeCard key={t.slug} t={t} showCount accent />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  cols,
  className,
  children,
}: {
  title: string;
  cols: 4 | 5;
  className?: string;
  children: React.ReactNode;
}) {
  const gridCols = cols === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  return (
    <section className={className}>
      <h2 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-3)] mb-2">
        {title}
      </h2>
      <div className={`grid gap-2 ${gridCols}`}>{children}</div>
    </section>
  );
}

function TypeCard({
  t,
  showCount,
  accent,
}: {
  t: MaterialTypeSummary;
  showCount: boolean;
  accent?: boolean;
}) {
  return (
    <Link
      href={`/category/materials/${t.slug}`}
      className={
        "block rounded-md border px-3 py-2.5 transition-colors " +
        (accent
          ? "bg-[color:rgba(207,168,90,0.04)] border-[color:rgba(207,168,90,0.35)] hover:border-[color:rgba(207,168,90,0.6)]"
          : "bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)]")
      }
    >
      <div className="text-sm font-semibold text-[var(--color-fg-1)]">
        {t.name}
      </div>
      {showCount && (
        <div className="text-[11px] font-mono text-[var(--color-fg-3)]">
          {t.count} item{t.count === 1 ? "" : "s"}
        </div>
      )}
    </Link>
  );
}
