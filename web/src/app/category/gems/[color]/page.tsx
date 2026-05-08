import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Package } from "lucide-react";
import { allGemColors, gemIdentitiesForColor } from "@/lib/subtypes";

export function generateStaticParams() {
  return allGemColors().map((c) => ({ color: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ color: string }>;
}) {
  const { color } = await params;
  const summary = allGemColors().find((c) => c.slug === color);
  if (!summary) return {};
  return {
    title: `${summary.name} Gems`,
    description: `Browse all ${summary.count} ${summary.name} gems.`,
  };
}

export default async function GemColorPage({
  params,
}: {
  params: Promise<{ color: string }>;
}) {
  const { color } = await params;
  const colorSummary = allGemColors().find((c) => c.slug === color);
  if (!colorSummary) notFound();
  const identities = gemIdentitiesForColor(color);
  if (!identities) notFound();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href="/category/gems"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)] mb-4"
      >
        <ChevronLeft size={14} />
        Back to Gems
      </Link>

      <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-4xl text-[var(--color-fg-1)] mb-6">
        <Link
          href="/category/gems"
          className="hover:text-[var(--color-gold-soft)] transition-colors"
        >
          Gems
        </Link>{" "}
        <span aria-hidden="true" className="text-[var(--color-fg-3)] font-light">›</span>{" "}
        {colorSummary.name}
      </h1>

      <h2 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-3)] mb-2">
        By gem
      </h2>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {identities.map((id) => (
          <Link
            key={id.slug}
            href={`/category/gems/${color}/${id.slug}`}
            className="block rounded-md border bg-[var(--color-bg-2)] border-[var(--color-border)] hover:border-[var(--color-gold-soft)] px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {id.imageUrl ? (
                <Image
                  src={id.imageUrl}
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
                  {id.name}
                </div>
                <div className="text-[11px] font-mono text-[var(--color-fg-3)]">
                  {id.count} rank{id.count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
