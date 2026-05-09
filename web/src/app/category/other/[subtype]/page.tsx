import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allOtherSubtypes, typeParensSubtype } from "@/lib/subtypes";
import { isUptierVariant } from "@/lib/uptier";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  // "rune" has its own static route (other/rune/page.tsx) for the family-cards
  // landing — exclude it here to avoid build-time path collision.
  return allOtherSubtypes()
    .filter((s) => s.slug !== "rune")
    .map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allOtherSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Other`,
    description: `Browse all ${summary.count} ${summary.name} items.`,
    alternates: { canonical: `/category/other/${subtype}` },
  };
}

export default async function OtherSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allOtherSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("other");
  if (!cat) notFound();

  // Reuse the category's matches function (it already encodes the inverse-of-other-7 logic)
  const items = allItems().filter(
    (i) =>
      cat.matches(i.Type) &&
      typeParensSubtype(i.Type) === summary.name &&
      !isUptierVariant(i.Name),
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={summary.name}
      />
    </Suspense>
  );
}
