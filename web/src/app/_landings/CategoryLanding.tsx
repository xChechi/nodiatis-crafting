"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SubtypeSummary } from "@/lib/subtypes";

export interface ShortcutCard {
  slug: string;
  name: string;
  href: string;
  count: number;
  icon: LucideIcon;
}

interface Props {
  category: { slug: string; label: string };
  primary: { title: string; cards: SubtypeSummary[]; basePath: string };
  special?: { title: string; cards: SubtypeSummary[]; basePath: string };
  shortcuts?: { title: string; cards: ShortcutCard[] };
  backHref?: string;
  backLabel?: string;
}

export function CategoryLanding({
  category,
  primary,
  special,
  shortcuts,
  backHref = "/",
  backLabel = "Back to home",
}: Props) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] mb-4"
      >
        <ChevronLeft size={14} />
        {backLabel}
      </Link>

      <h1 className="font-[family-name:var(--font-display-loaded)] text-2xl text-[var(--color-fg-1)] mb-6 tracking-wide">
        {category.label}
      </h1>

      <Section title={primary.title} cols={5}>
        {primary.cards.map((t) => (
          <TypeCard
            key={t.slug}
            t={t}
            href={`${primary.basePath}/${t.slug}`}
            showCount={false}
          />
        ))}
      </Section>

      {special && special.cards.length > 0 && (
        <Section title={special.title} cols={4} className="mt-8">
          {special.cards.map((t) => (
            <TypeCard
              key={t.slug}
              t={t}
              href={`${special.basePath}/${t.slug}`}
              showCount
              accent
            />
          ))}
        </Section>
      )}

      {shortcuts && shortcuts.cards.length > 0 && (
        <Section title={shortcuts.title} cols={4} className="mt-8">
          {shortcuts.cards.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.slug}
                href={s.href}
                className="block rounded-md border bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)] px-3 py-2.5 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={18} className="text-[var(--color-gold-soft)] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--color-fg-1)] truncate">
                      {s.name}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--color-fg-3)]">
                      {s.count} item{s.count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </Section>
      )}
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
  const gridCols = cols === 5
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
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
  href,
  showCount,
  accent,
}: {
  t: SubtypeSummary;
  href: string;
  showCount: boolean;
  accent?: boolean;
}) {
  return (
    <div className="relative group">
      <Link
        href={href}
        className={
          "block rounded-md border px-3 py-2.5 transition-colors " +
          (accent
            ? "bg-[var(--color-gold-soft)]/5 border-[var(--color-gold-soft)]/40 hover:border-[var(--color-gold-soft)]/70"
            : "bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)]")
        }
      >
        <div className="flex items-center gap-2.5">
          {t.imageUrl ? (
            <Image
              src={t.imageUrl}
              alt=""
              width={36}
              height={36}
              className="shrink-0 w-9 h-9 object-contain bg-[var(--color-bg-3)] rounded p-0.5"
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
        </div>
      </Link>

      {t.description && (
        <div
          role="tooltip"
          className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 max-w-[calc(100vw-2rem)] pointer-events-none rounded-md border border-[var(--color-gold-soft)]/40 bg-[var(--color-bg-3)] px-3 py-2 text-xs leading-relaxed text-[var(--color-fg-2)] shadow-lg shadow-black/50"
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-gold)] mb-1">
            {t.name}
          </p>
          <p>{t.description}</p>
          <span
            aria-hidden="true"
            className="absolute top-full left-1/2 -translate-x-1/2 -mt-px h-2 w-2 rotate-45 border-r border-b border-[var(--color-gold-soft)]/40 bg-[var(--color-bg-3)]"
          />
        </div>
      )}
    </div>
  );
}
