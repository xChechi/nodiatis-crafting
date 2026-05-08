"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Package } from "lucide-react";
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
        "flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors " +
        (accent
          ? "bg-[var(--color-gold-soft)]/5 border-[var(--color-gold-soft)]/40 hover:border-[var(--color-gold-soft)]/70"
          : "bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)]")
      }
    >
      {t.imageUrl ? (
        <Image
          src={t.imageUrl}
          alt=""
          width={36}
          height={36}
          className="shrink-0 bg-[var(--color-bg-3)] rounded p-0.5"
          unoptimized
        />
      ) : (
        <span
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded bg-[var(--color-bg-3)] border border-[var(--color-border)]"
          aria-hidden="true"
        >
          <Package size={18} className="text-[var(--color-fg-3)]/50" />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--color-fg-1)] truncate">
          {t.name}
        </div>
        {showCount && (
          <div className="text-[11px] font-mono text-[var(--color-fg-3)]">
            {t.count} item{t.count === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </Link>
  );
}
