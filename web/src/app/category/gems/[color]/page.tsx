import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TypeCard } from "@/app/_landings/CategoryLanding";
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
    alternates: { canonical: `/category/gems/${color}` },
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
          <TypeCard
            key={id.slug}
            t={id}
            href={`/category/gems/${color}/${id.slug}`}
            showCount
            countNoun="rank"
          />
        ))}
      </div>
    </div>
  );
}
